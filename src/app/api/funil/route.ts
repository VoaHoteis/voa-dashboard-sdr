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
  SDRS_ATIVOS,
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

    // Perdas e etapas sao independentes. Dispare as consultas juntas; o limite
    // compartilhado em pipedrive.ts continua controlando a concorrencia externa.
    const periodoPerdidos = { inicio: primeiroDiaDoMes(hojeIso), fim: ultimoDiaDoMes(hojeIso) };
    // Uma consulta por stage_id; etapas com mais de um stage viram uma lista só.
    const etapas = FUNIS.flatMap((funil) => ETAPAS_ORDEM.map((etapa) => ({ funil, etapa })));
    const [perdidos, resultadosEtapas] = await Promise.all([
      buscarNegociosPerdidos(periodoPerdidos),
      Promise.all(
        etapas.map(async ({ funil, etapa }) => {
          const listas = await Promise.all(
            STAGES[funil][etapa].map((stageId) => buscarNegociosDaEtapa(stageId))
          );
          return { funil, etapa, negocios: listas.flat() };
        })
      ),
    ]);

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

    const porFunilEtapa = Object.fromEntries(
      FUNIS.map((funil) => [funil, {}])
    ) as Record<FunnelKey, Record<EtapaKey, Negocio[]>>;
    for (const { funil, etapa, negocios } of resultadosEtapas) {
      porFunilEtapa[funil][etapa] = negocios;
    }

    const resposta: FunilResposta = {
      periodoPerdidos,
      porSdr: SDRS_ATIVOS.map((s) => {
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
