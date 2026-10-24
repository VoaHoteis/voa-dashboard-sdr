import { NextResponse } from 'next/server';
import { CLOSERS, PIPELINES, PIPELINE_TO_FUNNEL, type FunnelKey } from '@/lib/config';
import { hoje, primeiroDiaDoMes, ultimoDiaDoMes } from '@/lib/dates';
import {
  buscarEtapasDoPipeline,
  buscarNegociosPerdidos,
  donoDoNegocio,
} from '@/lib/pipedrive';
import type { PerdasClosersResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

const FUNIS: FunnelKey[] = ['salabim', 'novosNegocios'];
const ETAPAS_PERDAS: Record<FunnelKey, string[]> = {
  salabim: ['Contrato', 'Em Negociação', 'Apresentação Agendada'],
  novosNegocios: [
    'Contrato',
    'Pausa Operacional',
    'Negociação',
    'Apresentação de Proposta',
    'Apresentação Realizada',
  ],
};

function normalizarEtapa(nome: string): string {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

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

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const { searchParams } = new URL(req.url);
    const hojeIso = hoje();
    const periodo = {
      inicio: searchParams.get('inicio') || primeiroDiaDoMes(hojeIso),
      fim: searchParams.get('fim') || ultimoDiaDoMes(hojeIso),
    };

    const [negocios, etapasNovos, etapasSalabim] = await Promise.all([
      buscarNegociosPerdidos(periodo),
      buscarEtapasDoPipeline(PIPELINES.novosNegocios),
      buscarEtapasDoPipeline(PIPELINES.salabim),
    ]);
    const etapasPorFunil = { novosNegocios: etapasNovos, salabim: etapasSalabim };
    const idsClosers = new Set(CLOSERS.map((closer) => closer.userId));
    const negociosDosClosers = negocios.filter((negocio) => {
      const funil = PIPELINE_TO_FUNNEL[negocio.pipeline_id];
      return funil !== undefined && idsClosers.has(donoDoNegocio(negocio) ?? -1);
    });
    const porFunil = {} as PerdasClosersResposta['porFunil'];

    for (const funil of FUNIS) {
      const idsPorNome = new Map<string, number[]>();
      for (const etapa of etapasPorFunil[funil]) {
        const chave = normalizarEtapa(etapa.nome);
        idsPorNome.set(chave, [...(idsPorNome.get(chave) ?? []), etapa.id]);
      }

      const etapasPermitidas = ETAPAS_PERDAS[funil].map((etapa) => ({
        etapa,
        ids: idsPorNome.get(normalizarEtapa(etapa)) ?? [],
      }));
      const idsPermitidos = new Set(etapasPermitidas.flatMap(({ ids }) => ids));
      const pipelineId = PIPELINES[funil];
      const perdasDoFunil = negociosDosClosers.filter(
        (negocio) => negocio.pipeline_id === pipelineId && idsPermitidos.has(negocio.stage_id)
      );
      const porMotivo = new Map<string, number>();
      for (const negocio of perdasDoFunil) {
        const motivo = motivoDoNegocio(negocio);
        porMotivo.set(motivo, (porMotivo.get(motivo) ?? 0) + 1);
      }

      porFunil[funil] = {
        total: perdasDoFunil.length,
        etapas: etapasPermitidas.map(({ etapa, ids }) => ({
          etapa,
          total: perdasDoFunil.filter((negocio) => ids.includes(negocio.stage_id)).length,
        })),
        motivos: [...porMotivo.entries()]
          .map(([motivo, total]) => ({ motivo, total }))
          .sort((a, b) => a.motivo.localeCompare(b.motivo, 'pt-BR')),
      };
    }

    const resposta: PerdasClosersResposta = { periodo, porFunil };
    return NextResponse.json(resposta);
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
