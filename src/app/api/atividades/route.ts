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
          // Ligação de Prospecção só conta com negócio vinculado: o discador
          // automático (Kinbox) gera uma atividade por tentativa, sempre sem
          // negócio (deal_id null), enquanto a ligação que a SDR faz e marca no
          // CRM fica ligada a um negócio. Os demais tipos de esforço não têm
          // essa inflação, então contam como antes.
          if (a.type === TIPO_LIGACAO && a.deal_id == null) continue;
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
