/**
 * Card 8 — Forecast (previsão de fechamento do mês).
 *
 * GET /api/forecast
 *
 * Forecast = negócios ABERTOS, em QUALQUER etapa dos dois funis, cuja Data de
 * fechamento esperada (`expected_close_date`) cai no mês corrente. Busca todos
 * os negócios abertos da conta (paginado, como o card de Fechamentos faz com os
 * ganhos) e recorta por funil e data em memória — de propósito NÃO filtra por
 * etapa, senão os negócios em negociação avançada, que são os que têm previsão
 * de fechamento, ficariam de fora. Os nomes das etapas vêm de /v1/stages.
 *
 * Sem parâmetros usa o mês corrente; aceita ?inicio=&fim= como os demais cards.
 * ?debug=1 devolve um diagnóstico (contagens e amostra de datas) para conferir
 * de onde sai o número sem expor dados sensíveis.
 */

import { NextResponse } from 'next/server';
import { PIPELINE_TO_FUNNEL, type FunnelKey } from '@/lib/config';
import { hoje, primeiroDiaDoMes, ultimoDiaDoMes } from '@/lib/dates';
import { resolverForecast, zeroPorFunil } from '@/lib/metrics';
import { buscarEtapas, buscarNegociosAbertos } from '@/lib/pipedrive';
import type { ForecastResposta, ItemForecast } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const { searchParams } = new URL(req.url);
    const ref = hoje();
    const inicio = searchParams.get('inicio') || primeiroDiaDoMes(ref);
    const fim = searchParams.get('fim') || ultimoDiaDoMes(ref);

    const [negocios, etapas] = await Promise.all([buscarNegociosAbertos(), buscarEtapas()]);

    // Diagnóstico temporário: /api/forecast?debug=1 — mostra por que o forecast
    // tem o tamanho que tem, sem vazar dado sensível (só contagens e datas).
    if (searchParams.get('debug') === '1') {
      const nosFunis = negocios.filter((d) => PIPELINE_TO_FUNNEL[d.pipeline_id]);
      const comData = nosFunis.filter(
        (d) => (d as { expected_close_date?: string | null }).expected_close_date
      );
      const noMes = resolverForecast(negocios, { inicio, fim }, etapas);
      return NextResponse.json({
        periodo: { inicio, fim },
        etapas_carregadas: etapas.size,
        abertos_total: negocios.length,
        abertos_nos_2_funis: nosFunis.length,
        com_data_prevista: comData.length,
        previstos_no_mes: noMes.length,
        amostra_datas: comData
          .slice(0, 15)
          .map((d) => (d as { expected_close_date?: string | null }).expected_close_date),
      });
    }

    const itens = resolverForecast(negocios, { inicio, fim }, etapas);

    const porFunil = zeroPorFunil();
    const valorPorFunil = zeroPorFunil();
    const mapaEtapa = new Map<
      string,
      { funil: FunnelKey; etapaId: number; etapa: string; total: number; valor: number }
    >();

    for (const it of itens) {
      porFunil[it.funil] += 1;
      valorPorFunil[it.funil] += it.valor;

      const chave = it.funil + ':' + it.etapaId;
      const cur =
        mapaEtapa.get(chave) ??
        { funil: it.funil, etapaId: it.etapaId, etapa: it.etapa, total: 0, valor: 0 };
      cur.total += 1;
      cur.valor += it.valor;
      mapaEtapa.set(chave, cur);
    }

    const itensResp: ItemForecast[] = itens.map((it) => ({
      negocioId: it.negocio.id,
      titulo: it.negocio.title,
      funil: it.funil,
      etapaId: it.etapaId,
      etapa: it.etapa,
      valor: it.valor,
    }));

    const resposta: ForecastResposta = {
      periodo: { inicio, fim },
      total: itens.length,
      valor: itens.reduce((s, it) => s + it.valor, 0),
      porFunil,
      valorPorFunil,
      porEtapa: [...mapaEtapa.values()].sort((a, b) => b.valor - a.valor),
      itens: itensResp,
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
