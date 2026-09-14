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
import { SDRS, TIPO_LIGACAO, TIPOS_ESFORCO } from '@/lib/config';
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

    // Diagnóstico temporário: /api/atividades?debug=1 — foca na Bárbara e no tipo
    // Ligação de Prospecção neste mês, para achar de onde vem o 54 × 11 sem
    // vazar dado sensível (só contagens e datas). Remover depois.
    const { searchParams } = new URL(req.url);
    if (searchParams.get('debug') === '1') {
      const barbara = SDRS.find((s) => s.key === 'barbara');
      const janela = addDias(inicio, -35);

      // 1) Escopo na Bárbara (como o card faz).
      const daBarbara = await buscarAtividades({
        inicio: janela,
        fim,
        tipos: [TIPO_LIGACAO],
        concluidas: true,
        userId: barbara?.userId,
      });
      // 2) Sem escopo de usuário (user_id=0 => time inteiro), para testar se o
      //    filtro por usuário está de fato restringindo.
      const doTime = await buscarAtividades({
        inicio: janela,
        fim,
        tipos: [TIPO_LIGACAO],
        concluidas: true,
        userId: 0,
      });

      const idsUnicos = new Set(daBarbara.map((a) => a.id));
      const donosDistintos = [...new Set(daBarbara.map((a) => a.user_id))];
      const semConclusao = daBarbara.filter((a) => !a.marked_as_done_time).length;

      const contarPorSemana = (base: 'due' | 'done') =>
        semanas.map((sem) => {
          let n = 0;
          for (const a of daBarbara) {
            const d = base === 'done' ? dataConclusao(a) : a.due_date;
            if (d && d >= sem.inicio && d <= sem.fim) n += 1;
          }
          return { semana: sem.label, [base]: n };
        });

      return NextResponse.json({
        mes: { inicio, fim },
        barbara_userId: barbara?.userId ?? null,
        escopo_barbara: {
          registros_recebidos: daBarbara.length,
          ids_unicos: idsUnicos.size,
          duplicados: daBarbara.length - idsUnicos.size,
          user_ids_distintos_na_resposta: donosDistintos,
          sem_marked_as_done_time: semConclusao,
        },
        escopo_time_inteiro: { registros_recebidos: doTime.length },
        por_semana_data_marcada: contarPorSemana('due'),
        por_semana_data_conclusao: contarPorSemana('done'),
        amostra: daBarbara.slice(0, 8).map((a) => ({
          id: a.id,
          type: a.type,
          due_date: a.due_date,
          marked_as_done_time: a.marked_as_done_time,
          user_id: a.user_id,
        })),
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
