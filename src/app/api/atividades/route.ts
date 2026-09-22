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
import {
  addDias,
  hoje,
  listarDias,
  nomeDoMes,
  parse,
  primeiroDiaDoMes,
  semanasDoMes,
  ultimoDiaDoMes,
  type ISODate,
} from '@/lib/dates';
import {
  type Atividade,
  buscarAtividades,
  buscarNegociosPorIds,
  dataConclusao,
} from '@/lib/pipedrive';
import type { AtividadesResposta, EscopoAtividade, Granularidade, SerieBarras } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

const ESCOPOS: EscopoAtividade[] = ['total', 'salabim', 'novosNegocios'];
const GRANULARIDADES: Granularidade[] = ['semana', 'mes', 'dia'];

interface Bucket {
  label: string;
  inicio: ISODate;
  fim: ISODate;
}

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const ref = hoje();
    const inicio = primeiroDiaDoMes(ref);
    const fim = ultimoDiaDoMes(ref);
    const nomeMes = nomeDoMes(ref);
    const tipos = TIPOS_ESFORCO.map((t) => t.key);
    const tiposSet = new Set<string>(tipos);

    // Um conjunto de buckets por granularidade -- todos recortando o mesmo mes
    // corrente, só a largura da barra muda (semana, mes inteiro ou dia a dia).
    const buckets: Record<Granularidade, Bucket[]> = {
      semana: semanasDoMes(ref).map((s) => ({ label: s.label, inicio: s.inicio, fim: s.fim })),
      mes: [{ label: nomeMes[0].toUpperCase() + nomeMes.slice(1), inicio, fim }],
      dia: listarDias(inicio, fim).map((d) => ({ label: String(parse(d).d), inicio: d, fim: d })),
    };

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

    // Ligação de Prospecção só conta com negócio vinculado: o discador
    // automático (Kinbox) gera uma atividade por tentativa, sempre sem negócio
    // (deal_id null), enquanto a ligação que a SDR faz e marca no CRM fica
    // ligada a um negócio. Os demais tipos de esforço não têm essa inflação,
    // então contam como antes.
    const contaAtividade = (a: Atividade) =>
      tiposSet.has(a.type) && !(a.type === TIPO_LIGACAO && a.deal_id == null);

    const porSdr: AtividadesResposta['porSdr'] = SDRS.map((s) => {
      const atividades = atividadesPorSdr.get(s.key) ?? [];

      // Total do mes, uma unica passada -- nao depende de granularidade.
      const totais: Record<EscopoAtividade, number> = { total: 0, salabim: 0, novosNegocios: 0 };
      for (const a of atividades) {
        const d = dataConclusao(a);
        if (!d || d < inicio || d > fim || !contaAtividade(a)) continue;
        totais.total += 1;
        const funil = funilDaAtividade(a);
        if (funil) totais[funil] += 1;
      }

      const series = Object.fromEntries(
        GRANULARIDADES.map((gran) => {
          const serie: Record<EscopoAtividade, SerieBarras> = {
            total: [],
            salabim: [],
            novosNegocios: [],
          };

          for (const b of buckets[gran]) {
            const linhas: Record<EscopoAtividade, Record<string, string | number>> = {
              total: { rotulo: b.label },
              salabim: { rotulo: b.label },
              novosNegocios: { rotulo: b.label },
            };
            for (const esc of ESCOPOS) for (const t of tipos) linhas[esc][t] = 0;

            for (const a of atividades) {
              const d = dataConclusao(a);
              if (!d || d < b.inicio || d > b.fim || !contaAtividade(a)) continue;

              linhas.total[a.type] = (linhas.total[a.type] as number) + 1;
              const funil = funilDaAtividade(a);
              if (funil) linhas[funil][a.type] = (linhas[funil][a.type] as number) + 1;
            }

            for (const esc of ESCOPOS) serie[esc].push(linhas[esc]);
          }

          return [gran, serie];
        })
      ) as Record<Granularidade, Record<EscopoAtividade, SerieBarras>>;

      return { sdr: s.key, nome: s.nome, totais, series };
    });

    const resposta: AtividadesResposta = {
      mes: { inicio, fim },
      porSdr,
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
