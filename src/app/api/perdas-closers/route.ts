import { NextResponse } from 'next/server';
import { CLOSERS, PIPELINES, PIPELINE_TO_FUNNEL, STAGES, type FunnelKey } from '@/lib/config';
import { hoje, primeiroDiaDoMes, ultimoDiaDoMes } from '@/lib/dates';
import {
  buscarEtapasDoPipeline,
  buscarNegociosPerdidos,
  donoDoNegocio,
  type EtapaPipeline,
} from '@/lib/pipedrive';
import type { PerdasClosersResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

const FUNIS: FunnelKey[] = ['novosNegocios', 'salabim'];
const ETAPAS_OCULTAS: Record<FunnelKey, number[]> = {
  salabim: [70],
  novosNegocios: [
    ...STAGES.novosNegocios.preQualificacao,
    ...STAGES.novosNegocios.emContato,
    ...STAGES.novosNegocios.reagendamento,
    ...STAGES.novosNegocios.apresentacaoAgendada,
  ],
};

function motivoDoNegocio(negocio: { [campo: string]: unknown }): string {
  const bruto = negocio.lost_reason;
  if (typeof bruto === 'string' && bruto.trim()) return bruto.trim();
  if (bruto && typeof bruto === 'object') {
    const objeto = bruto as { label?: unknown; value?: unknown; name?: unknown };
    for (const valor of [objeto.label, objeto.value, objeto.name]) {
      if (typeof valor === 'string' && valor.trim()) return valor.trim();
    }
  }
  return 'Sem motivo informado';
}

function etapaVisivel(funil: FunnelKey) {
  return (etapa: EtapaPipeline) => !ETAPAS_OCULTAS[funil].includes(etapa.id);
}

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const hojeIso = hoje();
    const periodo = { inicio: primeiroDiaDoMes(hojeIso), fim: ultimoDiaDoMes(hojeIso) };

    const [negocios, etapasNovos, etapasSalabim] = await Promise.all([
      buscarNegociosPerdidos(periodo),
      buscarEtapasDoPipeline(PIPELINES.novosNegocios),
      buscarEtapasDoPipeline(PIPELINES.salabim),
    ]);

    const etapasPorFunil: Record<FunnelKey, EtapaPipeline[]> = {
      novosNegocios: etapasNovos.filter(etapaVisivel('novosNegocios')),
      salabim: etapasSalabim.filter(etapaVisivel('salabim')),
    };
    const idsClosers = new Set(CLOSERS.map((closer) => closer.userId));
    const negociosDosClosers = negocios.filter((negocio) => {
      const funil = PIPELINE_TO_FUNNEL[negocio.pipeline_id];
      return (
        funil !== undefined &&
        idsClosers.has(donoDoNegocio(negocio) ?? -1) &&
        !ETAPAS_OCULTAS[funil].includes(negocio.stage_id)
      );
    });
    const motivos = [...new Set(negociosDosClosers.map(motivoDoNegocio))].sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    );
    const etapas: PerdasClosersResposta['etapas'] = [];

    for (const funil of FUNIS) {
      const pipelineId = PIPELINES[funil];
      for (const etapa of etapasPorFunil[funil]) {
        const perdasDaEtapa = negociosDosClosers.filter(
          (negocio) => negocio.pipeline_id === pipelineId && negocio.stage_id === etapa.id
        );
        const porMotivo = Object.fromEntries(motivos.map((motivo) => [motivo, 0]));
        for (const negocio of perdasDaEtapa) {
          const motivo = motivoDoNegocio(negocio);
          porMotivo[motivo] = (porMotivo[motivo] ?? 0) + 1;
        }
        etapas.push({
          funil,
          etapaId: etapa.id,
          etapa: etapa.nome,
          ordem: etapa.ordem,
          total: perdasDaEtapa.length,
          porMotivo,
        });
      }
    }

    const resposta: PerdasClosersResposta = {
      periodo,
      motivos,
      total: negociosDosClosers.length,
      etapas,
    };
    return NextResponse.json(resposta);
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
