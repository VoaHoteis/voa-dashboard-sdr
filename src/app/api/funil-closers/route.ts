import { NextResponse } from 'next/server';
import { PIPELINES } from '@/lib/config';
import { buscarEtapasDoPipeline, buscarNegociosAbertos } from '@/lib/pipedrive';
import type { FunilClosersResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const pipelineId = PIPELINES.salabim;
    const [negocios, etapasPipeline] = await Promise.all([
      buscarNegociosAbertos(),
      buscarEtapasDoPipeline(pipelineId),
    ]);
    const negociosSalabim = negocios.filter(
      (negocio) => negocio.status === 'open' && negocio.pipeline_id === pipelineId
    );
    const porEtapa = new Map(etapasPipeline.map((etapa) => [etapa.id, 0]));

    for (const negocio of negociosSalabim) {
      porEtapa.set(negocio.stage_id, (porEtapa.get(negocio.stage_id) ?? 0) + 1);
    }

    const etapas = etapasPipeline.map((etapa) => ({
      ...etapa,
      total: porEtapa.get(etapa.id) ?? 0,
    }));

    for (const [etapaId, total] of porEtapa) {
      if (etapasPipeline.some((etapa) => etapa.id === etapaId)) continue;
      etapas.push({ id: etapaId, nome: `Etapa ${etapaId}`, ordem: Number.MAX_SAFE_INTEGER, total });
    }

    const resposta: FunilClosersResposta = {
      funil: 'Salabim',
      total: negociosSalabim.length,
      etapas: etapas.sort((a, b) => a.ordem - b.ordem),
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
