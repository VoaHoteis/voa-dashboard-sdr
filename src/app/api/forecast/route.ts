/**
 * Card 8 — Forecast (negócios abertos).
 *
 * GET /api/forecast
 *
 * Fotografia da carteira aberta agora: todos os negócios `open` nas 4 etapas
 * acompanhadas dos dois funis. Mesma estratégia do card de Funil — uma consulta
 * por `stage_id`, nunca por `pipeline_id` (a v1 ignora o pipeline em silêncio) —
 * mas sem quebrar por SDR: aqui interessa a carteira inteira, com nome, valor,
 * funil e etapa de cada negócio.
 *
 * Não é uma métrica de período: negócio aberto é estado atual, não algo que
 * "aconteceu no mês", então esta rota ignora qualquer filtro de data.
 */

import { NextResponse } from 'next/server';
import { ETAPAS_ORDEM, STAGES, type EtapaKey, type FunnelKey } from '@/lib/config';
import { resolverForecast, zeroPorFunil } from '@/lib/metrics';
import { buscarNegociosDaEtapa, type Negocio } from '@/lib/pipedrive';
import type { ForecastResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

const FUNIS: FunnelKey[] = ['novosNegocios', 'salabim'];

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);

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

    const itens = resolverForecast(porFunilEtapa);

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
