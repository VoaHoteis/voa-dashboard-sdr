/**
 * Card 8 — Forecast (negócios abertos).
 *
 * GET /api/forecast
 *
 * Previsão do mês: negócios `open` nas 4 etapas acompanhadas dos dois funis
 * cuja Data de fechamento esperada (`expected_close_date`) cai no mês corrente.
 * Mesma estratégia do card de Funil — uma consulta por `stage_id`, nunca por
 * `pipeline_id` (a v1 ignora o pipeline em silêncio) — mas sem quebrar por SDR:
 * aqui interessa a previsão do time inteiro, com nome, valor, funil e etapa.
 *
 * O recorte por `expected_close_date` roda em memória, como o card de
 * Fechamentos faz com `won_time`: a v1 traz a data em cada negócio e nós
 * filtramos aqui. Sem parâmetros, usa o mês corrente — o recorte natural de uma
 * previsão mensal, alinhado aos demais cards de meta.
 */

import { NextResponse } from 'next/server';
import { ETAPAS_ORDEM, STAGES, type EtapaKey, type FunnelKey } from '@/lib/config';
import { hoje, primeiroDiaDoMes, ultimoDiaDoMes } from '@/lib/dates';
import { resolverForecast, zeroPorFunil } from '@/lib/metrics';
import { buscarNegociosDaEtapa, type Negocio } from '@/lib/pipedrive';
import type { ForecastResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

const FUNIS: FunnelKey[] = ['novosNegocios', 'salabim'];

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const { searchParams } = new URL(req.url);
    const ref = hoje();
    const inicio = searchParams.get('inicio') || primeiroDiaDoMes(ref);
    const fim = searchParams.get('fim') || ultimoDiaDoMes(ref);

    // Uma consulta por stage_id. A etapa "Em Contato" do Salabim soma 77 e 71,
    // então vira uma lista só — igual ao card de Funil.
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

    const itens = resolverForecast(porFunilEtapa, { inicio, fim });

    const porFunil = zeroPorFunil();
    const valorPorFunil = zeroPorFunil();
    const mapaEtapa = new Map<string, { funil: FunnelKey; etapa: EtapaKey; total: number; valor: number }>();

    for (const it of itens) {
      porFunil[it.funil] += 1;
      valorPorFunil[it.funil] += it.valor;

      const chave = it.funil + ':' + it.etapa;
      const cur = mapaEtapa.get(chave) ?? { funil: it.funil, etapa: it.etapa, total: 0, valor: 0 };
      cur.total += 1;
      cur.valor += it.valor;
      mapaEtapa.set(chave, cur);
    }

    const resposta: ForecastResposta = {
      periodo: { inicio, fim },
      total: itens.length,
      valor: itens.reduce((s, i) => s + i.valor, 0),
      porFunil,
      valorPorFunil,
      porEtapa: [...mapaEtapa.values()],
      itens: itens.map((i) => ({
        negocioId: i.negocio.id,
        titulo: i.negocio.title,
        funil: i.funil,
        etapa: i.etapa,
        valor: i.valor,
      })),
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
