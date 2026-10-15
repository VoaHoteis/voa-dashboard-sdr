import { NextResponse } from 'next/server';
import { CLOSERS, FUNNEL_LABEL, PIPELINES, STAGES, type FunnelKey } from '@/lib/config';
import {
  buscarEtapasDoPipeline,
  buscarNegociosAbertos,
  donoDoNegocio,
  nomeDoProprietario,
} from '@/lib/pipedrive';
import type { FunilClosersResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

/**
 * "Disparo Enviado" so existe no Salabim: e repositorio de leads, fica fora do grafico.
 * No Novos Negocios, as etapas de pre-venda (SDR) ficam fora da visao do Closer.
 */
const ETAPAS_OCULTAS: Record<FunnelKey, number[]> = {
  salabim: [70],
  novosNegocios: [
    ...STAGES.novosNegocios.preQualificacao,
    ...STAGES.novosNegocios.emContato,
    ...STAGES.novosNegocios.reagendamento,
    ...STAGES.novosNegocios.apresentacaoAgendada,
  ],
};

function lerFunil(req: Request): FunnelKey {
  const valor = new URL(req.url).searchParams.get('funil');
  return valor === 'novosNegocios' ? 'novosNegocios' : 'salabim';
}

/** Recorte opcional por closer (proprietario do negocio). Chave desconhecida = funil inteiro. */
function lerCloser(req: Request) {
  const chave = new URL(req.url).searchParams.get('closer');
  return chave ? CLOSERS.find((c) => c.key === chave) : undefined;
}

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const funil = lerFunil(req);
    const pipelineId = PIPELINES[funil];
    const ocultas = ETAPAS_OCULTAS[funil];
    const [negocios, etapasPipeline] = await Promise.all([
      buscarNegociosAbertos(),
      buscarEtapasDoPipeline(pipelineId),
    ]);
    const closer = lerCloser(req);
    const negociosDoFunil = negocios.filter(
      (negocio) =>
        negocio.status === 'open' &&
        negocio.pipeline_id === pipelineId &&
        (!closer || donoDoNegocio(negocio) === closer.userId)
    );
    const etapasVisiveis = etapasPipeline.filter((etapa) => !ocultas.includes(etapa.id));
    const porEtapa = new Map(etapasVisiveis.map((etapa) => [etapa.id, 0]));
    const negociosPorEtapa = new Map<number, FunilClosersResposta['etapas'][number]['negocios']>();

    for (const negocio of negociosDoFunil) {
      if (ocultas.includes(negocio.stage_id)) continue;
      porEtapa.set(negocio.stage_id, (porEtapa.get(negocio.stage_id) ?? 0) + 1);
      const lista = negociosPorEtapa.get(negocio.stage_id) ?? [];
      lista.push({
        negocioId: negocio.id,
        titulo: negocio.title,
        proprietario: nomeDoProprietario(negocio),
      });
      negociosPorEtapa.set(negocio.stage_id, lista);
    }

    const etapas = etapasVisiveis.map((etapa) => ({
      ...etapa,
      total: porEtapa.get(etapa.id) ?? 0,
      negocios: negociosPorEtapa.get(etapa.id) ?? [],
    }));

    for (const [etapaId, total] of porEtapa) {
      if (etapasVisiveis.some((etapa) => etapa.id === etapaId)) continue;
      etapas.push({
        id: etapaId,
        nome: `Etapa ${etapaId}`,
        ordem: Number.MAX_SAFE_INTEGER,
        total,
        negocios: negociosPorEtapa.get(etapaId) ?? [],
      });
    }

    const resposta: FunilClosersResposta = {
      funil: FUNNEL_LABEL[funil],
      total: negociosDoFunil.length,
      etapas: etapas.sort((a, b) => a.ordem - b.ordem),
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
