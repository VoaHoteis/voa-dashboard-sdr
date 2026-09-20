/**
 * Card 4 — Funil por SDR.
 *
 * GET /api/funil
 *
 * O prototipo pedia ao sub-agente para "levantar todos os negocios abertos" sem
 * escopo, o que estourava o orcamento de tokens e devolvia o card zerado. Aqui
 * sao consultas direcionadas (uma por stage_id), so de negocios abertos, e a
 * quebra por SDR e feita em memoria.
 *
 * Atencao: aqui a SDR e o **proprietario** do negocio, nao o campo personalizado
 * "SDR". Nas etapas iniciais o negocio ainda esta com a SDR; depois da reuniao
 * ele passa para um closer, e ai o campo personalizado e que preserva quem
 * originou. Por isso os dois cards usam campos diferentes, de proposito.
 */

import { NextResponse } from 'next/server';
import {
  ETAPAS_ORDEM,
  PIPELINE_TO_FUNNEL,
  SDRS,
  STAGES,
  type EtapaKey,
  type FunnelKey,
} from '@/lib/config';
import { hoje, primeiroDiaDoMes, ultimoDiaDoMes } from '@/lib/dates';
import { resumirFunil } from '@/lib/metrics';
import {
  buscarNegociosDaEtapa,
  buscarNegociosPerdidos,
  donoDoNegocio,
  type Negocio,
} from '@/lib/pipedrive';
import type { FunilResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

const FUNIS: FunnelKey[] = ['novosNegocios', 'salabim'];

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const hojeIso = hoje();

    // Perdas so fazem sentido dentro de uma janela; o funil e mensal como os
    // demais cards de meta, entao contamos os perdidos do mes corrente pela
    // Data de perda (`lost_time`), atribuidos pelo proprietario do negocio.
    const periodoPerdidos = { inicio: primeiroDiaDoMes(hojeIso), fim: ultimoDiaDoMes(hojeIso) };
    const perdidos = await buscarNegociosPerdidos(periodoPerdidos);

    // Agrega uma vez: por funil e por dono (userId). Perda em pipeline fora dos
    // dois funis acompanhados nao entra, mantendo o mesmo universo das etapas.
    const perdidosPorSdr = { novosNegocios: {}, salabim: {} } as Record<
      FunnelKey,
      Record<number, number>
    >;
    for (const d of perdidos) {
      const funil = PIPELINE_TO_FUNNEL[d.pipeline_id];
      if (!funil) continue;
      const dono = donoDoNegocio(d);
      if (dono === null) continue;
      perdidosPorSdr[funil][dono] = (perdidosPorSdr[funil][dono] ?? 0) + 1;
    }

    // Uma consulta por stage_id. Etapas com mais de um stage (o "Em Contato" do
    // Salabim soma 77 e 71) viram uma lista so.
    const porFunilEtapa = {} as Record<FunnelKey, Record<EtapaKey, Negocio[]>>;

    for (const funil of FUNIS) {
      porFunilEtapa[funil] = {} as Record<EtapaKey, Negocio[]>;
      for (const etapa of ETAPAS_ORDEM) {
        const listas = await Promise.all(
          STAGES[funil][etapa].map((stageId) => buscarNegociosDaEtapa(stageId))
        );
        porFunilEtapa[funil][etapa] = listas.flat();
      }
    }

    const resposta: FunilResposta = {
      periodoPerdidos,
      porSdr: SDRS.map((s) => {
        const funis = {} as FunilResposta['porSdr'][number]['funis'];

        for (const funil of FUNIS) {
          const meus = {} as Record<EtapaKey, Negocio[]>;
          for (const etapa of ETAPAS_ORDEM) {
            // Pelo proprietario, nao pelo campo SDR: no funil quem detem o
            // negocio e a propria SDR. (Nos agendamentos e o contrario -- ver a
            // nota em CardsAgendamentos.)
            meus[etapa] = porFunilEtapa[funil][etapa].filter(
              (d) => donoDoNegocio(d) === s.userId
            );
          }

          // Hoteis perdidos deste funil e desta SDR, pela mesma atribuicao por
          // proprietario. `PIPELINE_TO_FUNNEL` mantem o recorte nos dois funis
          // acompanhados; perda em outro pipeline nao entra.
          const perdidos = perdidosPorSdr[funil][s.userId] ?? 0;

          funis[funil] = { ...resumirFunil(meus, hojeIso), perdidos };
        }

        return { sdr: s.key, nome: s.nome, funis };
      }),
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
