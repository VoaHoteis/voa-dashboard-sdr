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
 */

import { NextResponse } from 'next/server';
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
    const itens = resolverForecast(negocios, { inicio, fim }, etapas);

    const porFunil = zeroPorFunil();
    const valorPorFunil = zeroPorFunil();
    for (const it of itens) {
      porFunil[it.funil] += 1;
      valorPorFunil[it.funil] += it.valor;
    }

    const itensResp: ItemForecast[] = itens.map((it) => ({
      negocioId: it.negocio.id,
      titulo: it.negocio.title,
      funil: it.funil,
      etapaId: it.etapaId,
      etapa: it.etapa,
      proprietario: it.proprietario,
      valor: it.valor,
    }));

    const resposta: ForecastResposta = {
      periodo: { inicio, fim },
      total: itens.length,
      valor: itens.reduce((s, it) => s + it.valor, 0),
      porFunil,
      valorPorFunil,
      itens: itensResp,
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
