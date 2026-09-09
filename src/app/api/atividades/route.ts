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
import { hoje, primeiroDiaDoMes, semanasDoMes, ultimoDiaDoMes } from '@/lib/dates';
import { buscarAtividades } from '@/lib/pipedrive';
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

    const porSdr: AtividadesResposta['porSdr'] = [];

    for (const s of SDRS) {
      const atividades = await buscarAtividades({
        inicio,
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
          const d = a.due_date;
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
