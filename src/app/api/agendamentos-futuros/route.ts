/**
 * Card 5 — Agendamentos Futuros (as duas SDRs juntas).
 *
 * GET /api/agendamentos-futuros
 *
 * Reunioes ja marcadas e ainda nao concluidas, de hoje ate o fim do mes.
 */

import { NextResponse } from 'next/server';
import { TIPOS_AGENDAMENTO } from '@/lib/config';
import { hoje, ultimoDiaDoMes } from '@/lib/dates';
import { resolverAgendamentos, totalDe, zeroPorFunil } from '@/lib/metrics';
import { buscarAtividades, buscarNegociosPorIds } from '@/lib/pipedrive';
import type { FuturosResposta, ItemAgendamento } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const inicio = hoje();
    const fim = ultimoDiaDoMes(inicio);

    const atividades = await buscarAtividades({
      inicio,
      fim,
      tipos: TIPOS_AGENDAMENTO,
      concluidas: false,
    });

    const negocios = await buscarNegociosPorIds(
      atividades.map((a) => a.deal_id).filter((id): id is number => typeof id === 'number')
    );

    const itens = resolverAgendamentos(atividades, negocios);
    const porFunil = zeroPorFunil();
    const lista: ItemAgendamento[] = [];

    for (const i of itens) {
      porFunil[i.funil] += 1;
      lista.push({
        atividadeId: i.atividade.id,
        negocioId: i.negocio.id,
        titulo: i.negocio.title,
        data: i.atividade.due_date ?? inicio,
        funil: i.funil,
        sdrs: i.sdrs,
        assunto: i.atividade.subject,
        tipo: i.atividade.type,
      });
    }

    lista.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));

    const resposta: FuturosResposta = {
      ateFim: fim,
      total: totalDe(porFunil),
      porFunil,
      itens: lista,
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
