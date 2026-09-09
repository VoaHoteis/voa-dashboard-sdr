/**
 * Card de No-shows — quantos houve no mês, por funil.
 *
 * GET /api/no-shows
 *
 * Conta apenas no-shows **com negócio vinculado** num dos dois funis -- mesma
 * regra dos agendamentos, por decisão do João em 09/09/2026.
 *
 * Os lançamentos sem vínculo não somem: voltam em `foraDaConta` para o card
 * mostrar quantos ficaram de fora. São 15 a 25% do total histórico (1 em jun, 8
 * em jul, 4 em ago, 2 em set), então tirá-los da tela junto com a contagem
 * transformaria uma decisão de método em subnotificação silenciosa.
 */

import { NextResponse } from 'next/server';
import { PIPELINE_TO_FUNNEL, TIPO_NO_SHOW } from '@/lib/config';
import { hoje, primeiroDiaDoMes, ultimoDiaDoMes } from '@/lib/dates';
import { totalDe, zeroPorFunil } from '@/lib/metrics';
import { buscarAtividades, buscarNegociosPorIds, sdrsDoNegocio } from '@/lib/pipedrive';
import type { ItemAgendamento, NoShowsResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);

    const { searchParams } = new URL(req.url);
    const ref = hoje();
    const inicio = searchParams.get('inicio') || primeiroDiaDoMes(ref);
    const fim = searchParams.get('fim') || ultimoDiaDoMes(ref);

    const atividades = await buscarAtividades({
      inicio,
      fim,
      tipos: [TIPO_NO_SHOW],
      concluidas: true,
    });

    const negocios = await buscarNegociosPorIds(
      atividades.map((a) => a.deal_id).filter((id): id is number => typeof id === 'number')
    );

    const porFunil = zeroPorFunil();
    const itens: ItemAgendamento[] = [];
    const itensForaDaConta: ItemAgendamento[] = [];

    for (const a of atividades) {
      const negocio = a.deal_id ? negocios.get(a.deal_id) : undefined;
      const funil = negocio ? (PIPELINE_TO_FUNNEL[negocio.pipeline_id] ?? null) : null;

      const item: ItemAgendamento = {
        atividadeId: a.id,
        negocioId: negocio?.id ?? null,
        // Sem negócio, o assunto é a única identificação que sobra.
        titulo: negocio?.title ?? a.subject,
        data: a.due_date ?? inicio,
        funil,
        sdrs: sdrsDoNegocio(negocio),
        assunto: a.subject,
        tipo: a.type,
      };

      if (funil) {
        porFunil[funil] += 1;
        itens.push(item);
      } else {
        itensForaDaConta.push(item);
      }
    }

    const porData = (x: ItemAgendamento, y: ItemAgendamento) =>
      x.data < y.data ? -1 : x.data > y.data ? 1 : 0;
    itens.sort(porData);
    itensForaDaConta.sort(porData);

    const resposta: NoShowsResposta = {
      periodo: { inicio, fim },
      total: totalDe(porFunil),
      porFunil,
      itens,
      foraDaConta: itensForaDaConta.length,
      itensForaDaConta,
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
