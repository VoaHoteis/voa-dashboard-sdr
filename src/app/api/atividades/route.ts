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
import { SDRS, TIPOS_ESFORCO } from '@/lib/config';
import { addDias, hoje, primeiroDiaDoMes, semanasDoMes, ultimoDiaDoMes } from '@/lib/dates';
import { buscarAtividades, dataConclusao } from '@/lib/pipedrive';
import type { AtividadesResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const ref = hoje();
    const inicio = primeiroDiaDoMes(ref);
    const fim = ultimoDiaDoMes(ref);
    const semanas = semanasDoMes(ref);
    const tipos = TIPOS_ESFORCO.map((t) => t.key);

    // DIAGNÓSTICO TEMPORÁRIO: distribuição por assunto das ligações da Bárbara.
    // Abrir /api/atividades?debug=1 no preview publicado. Remover depois.
    const url = new URL(req.url);
    if (url.searchParams.get('debug') === '1') {
      const barbara = SDRS.find((s) => s.key === 'barbara') ?? SDRS[0];
      const ligacoes = await buscarAtividades({
        inicio: addDias(inicio, -35),
        fim,
        tipos: ['ligacao_de_prospeccao_plan'],
        concluidas: true,
        userId: barbara.userId,
      });
      const noMes = ligacoes.filter((a) => {
        const d = dataConclusao(a);
        return d && d >= inicio && d <= fim;
      });
      const porAssunto: Record<string, { total: number; comNegocio: number; semNegocio: number }> = {};
      for (const a of noMes) {
        const s = (a.subject ?? '(sem assunto)').trim() || '(sem assunto)';
        porAssunto[s] ??= { total: 0, comNegocio: 0, semNegocio: 0 };
        porAssunto[s].total += 1;
        if (a.deal_id) porAssunto[s].comNegocio += 1;
        else porAssunto[s].semNegocio += 1;
      }
      const distribuicao = Object.entries(porAssunto)
        .map(([assunto, v]) => ({ assunto, ...v }))
        .sort((x, y) => y.total - x.total);
      return NextResponse.json({
        sdr: barbara.nome,
        mes: { inicio, fim },
        total_ligacoes_no_mes: noMes.length,
        total_com_negocio: noMes.filter((a) => a.deal_id).length,
        total_sem_negocio: noMes.filter((a) => !a.deal_id).length,
        distribuicao_por_assunto: distribuicao,
      });
    }

    // A busca da API filtra por data MARCADA (due_date), mas contamos por data de
    // CONCLUSÃO. Alargamos a janela ~35 dias para trás para pegar atividades
    // concluídas neste mês que estavam marcadas no mês anterior; o recorte fino
    // por semana (abaixo) usa a data de conclusão e descarta o excedente.
    const janelaInicio = addDias(inicio, -35);

    const porSdr: AtividadesResposta['porSdr'] = [];

    for (const s of SDRS) {
      const atividades = await buscarAtividades({
        inicio: janelaInicio,
        fim,
        tipos,
        concluidas: true,
        userId: s.userId,
      });

      const porTipo: Record<string, number> = Object.fromEntries(tipos.map((t) => [t, 0]));

      const series = semanas.map((sem) => {
        const linha: Record<string, string | number> = { semana: sem.label };
        for (const t of tipos) linha[t] = 0;

        for (const a of atividades) {
          const d = dataConclusao(a);
          if (!d || d < sem.inicio || d > sem.fim) continue;
          if (!(a.type in linha)) continue;
          linha[a.type] = (linha[a.type] as number) + 1;
          porTipo[a.type] += 1;
        }
        return linha;
      });

      porSdr.push({
        sdr: s.key,
        nome: s.nome,
        total: Object.values(porTipo).reduce((x, y) => x + y, 0),
        series,
        porTipo,
      });
    }

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
