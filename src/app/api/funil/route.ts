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
import { ETAPAS_ORDEM, SDRS, STAGES, type EtapaKey, type FunnelKey } from '@/lib/config';
import { hoje } from '@/lib/dates';
import { resumirFunil } from '@/lib/metrics';
import { buscarNegociosDaEtapa, donoDoNegocio, type Negocio } from '@/lib/pipedrive';
import type { FunilResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

const FUNIS: FunnelKey[] = ['novosNegocios', 'salabim'];

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const hojeIso = hoje();

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
          funis[funil] = resumirFunil(meus, hojeIso);
        }

        return { sdr: s.key, nome: s.nome, funis };
      }),
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
