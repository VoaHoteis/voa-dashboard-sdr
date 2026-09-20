/**
 * Card 6 — Atividades por semana.
 *
 * GET /api/atividades
 *
 * Unico card atribuido pelo executor da atividade (user_id do Pipedrive), e nao
 * pelo campo SDR do negocio: aqui a pergunta e "quanto esforco esta pessoa fez",
 * nao "de quem e a carteira".
 */

import { NextResponse } from 'next/server';
import {
  PIPELINE_TO_FUNNEL,
  SDRS,
  TIPO_LIGACAO,
  TIPOS_ESFORCO,
  type FunnelKey,
} from '@/lib/config';
import { addDias, hoje, primeiroDiaDoMes, semanasDoMes, ultimoDiaDoMes } from '@/lib/dates';
import {
  type Atividade,
  buscarAtividades,
  buscarNegociosPorIds,
  dataConclusao,
} from '@/lib/pipedrive';
import type { AtividadesResposta, EscopoAtividade, SerieSemana } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

const ESCOPOS: EscopoAtividade[] = ['total', 'salabim', 'novosNegocios'];

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const ref = hoje();
    const inicio = primeiroDiaDoMes(ref);
    const fim = ultimoDiaDoMes(ref);
    const semanas = semanasDoMes(ref);
    const tipos = TIPOS_ESFORCO.map((t) => t.key);
    const tiposSet = new Set<string>(tipos);

    // A busca da API filtra por data MARCADA (due_date), mas contamos por data de
    // CONCLUSÃO. Alargamos a janela ~35 dias para trás para pegar atividades
    // concluídas neste mês que estavam marcadas no mês anterior; o recorte fino
    // por semana (abaixo) usa a data de conclusão e descarta o excedente.
    const janelaInicio = addDias(inicio, -35);

    // Busca as atividades das duas SDRs primeiro, junta os negócios de todas e
    // resolve o funil de cada um numa única chamada em lote (v2), em vez de uma
    // consulta por SDR — mesmo caminho do card de Agendamentos.
    const atividadesPorSdr = new Map<string, Atividade[]>();
    const idsNegocios: number[] = [];

    for (const s of SDRS) {
      const atividades = await buscarAtividades({
        inicio: janelaInicio,
        fim,
        tipos,
        concluidas: true,
        userId: s.userId,
      });
      atividadesPorSdr.set(s.key, atividades);
      for (const a of atividades) if (a.deal_id != null) idsNegocios.push(a.deal_id);
    }

    const negocios = await buscarNegociosPorIds(idsNegocios);

    // Funil da atividade = funil do negócio vinculado. Sem negócio (ou negócio
    // de outro pipeline) => null: conta no total, mas em nenhum funil.
    const funilDaAtividade = (a: Atividade): FunnelKey | null => {
      if (a.deal_id == null) return null;
      const n = negocios.get(a.deal_id);
      if (!n) return null;
      return PIPELINE_TO_FUNNEL[n.pipeline_id] ?? null;
    };

    const porSdr: AtividadesResposta['porSdr'] = SDRS.map((s) => {
      const atividades = atividadesPorSdr.get(s.key) ?? [];

      const totais: Record<EscopoAtividade, number> = { total: 0, salabim: 0, novosNegocios: 0 };
      const series: Record<EscopoAtividade, SerieSemana> = {
        total: [],
        salabim: [],
        novosNegocios: [],
      };

      for (const sem of semanas) {
        const linhas: Record<EscopoAtividade, Record<string, string | number>> = {
          total: { semana: sem.label },
          salabim: { semana: sem.label },
          novosNegocios: { semana: sem.label },
        };
        for (const esc of ESCOPOS) for (const t of tipos) linhas[esc][t] = 0;

        for (const a of atividades) {
          const d = dataConclusao(a);
          if (!d || d < sem.inicio || d > sem.fim) continue;
          if (!tiposSet.has(a.type)) continue;
          // Ligação de Prospecção só conta com negócio vinculado: o discador
          // automático (Kinbox) gera uma atividade por tentativa, sempre sem
          // negócio (deal_id null), enquanto a ligação que a SDR faz e marca no
          // CRM fica ligada a um negócio. Os demais tipos de esforço não têm
          // essa inflação, então contam como antes.
          if (a.type === TIPO_LIGACAO && a.deal_id == null) continue;

          linhas.total[a.type] = (linhas.total[a.type] as number) + 1;
          totais.total += 1;

          const funil = funilDaAtividade(a);
          if (funil) {
            linhas[funil][a.type] = (linhas[funil][a.type] as number) + 1;
            totais[funil] += 1;
          }
        }

        for (const esc of ESCOPOS) series[esc].push(linhas[esc]);
      }

      return { sdr: s.key, nome: s.nome, totais, series };
    });

    const resposta: AtividadesResposta = {
      mes: { inicio, fim },
      semanas: semanas.map((s) => s.label),
      porSdr,
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
