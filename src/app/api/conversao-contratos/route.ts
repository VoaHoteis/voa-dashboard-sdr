import { NextResponse } from 'next/server';
import { CLOSERS, PIPELINE_TO_FUNNEL, TIPOS_AGENDAMENTO } from '@/lib/config';
import { addDias, hoje, primeiroDiaDoMes } from '@/lib/dates';
import {
  buscarAtividades,
  buscarNegociosGanhos,
  buscarNegociosPorIds,
  pessoaDoProprietario,
} from '@/lib/pipedrive';
import type { ConversaoContratosResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const ref = hoje();
    const inicio = primeiroDiaDoMes(addDias(primeiroDiaDoMes(ref), -1));
    const fim = ref;
    const tipos = await Promise.all(
      CLOSERS.map(async (closer) => ({
        closer,
        atividades: await buscarAtividades({
          inicio,
          fim,
          tipos: TIPOS_AGENDAMENTO,
          concluidas: true,
          userId: closer.userId,
        }),
      }))
    );
    const ganhos = await buscarNegociosGanhos({ inicio, fim });
    const idsNegocios = tipos
      .flatMap(({ atividades }) => atividades.map((atividade) => atividade.deal_id))
      .filter((id): id is number => typeof id === 'number');
    const negocios = await buscarNegociosPorIds(idsNegocios);

    const porCloser = tipos.map(({ closer, atividades }) => {
      const agendamentos = atividades.filter((atividade) => {
        const data = atividade.due_date?.slice(0, 10);
        if (!data || data < inicio || data > fim || atividade.deal_id == null) return false;
        const negocio = negocios.get(atividade.deal_id);
        return negocio !== undefined && PIPELINE_TO_FUNNEL[negocio.pipeline_id] !== undefined;
      }).length;
      const contratos = ganhos.filter((negocio) => pessoaDoProprietario(negocio) === closer.key).length;

      return {
        closer: closer.key,
        nome: closer.nome,
        agendamentos,
        contratos,
        taxaConversao: agendamentos > 0 ? (contratos / agendamentos) * 100 : null,
      };
    });
    const totalAgendamentos = porCloser.reduce((total, closer) => total + closer.agendamentos, 0);
    const totalContratos = porCloser.reduce((total, closer) => total + closer.contratos, 0);

    const resposta: ConversaoContratosResposta = {
      periodo: { inicio, fim },
      totalAgendamentos,
      totalContratos,
      taxaConversao: totalAgendamentos > 0 ? (totalContratos / totalAgendamentos) * 100 : null,
      porCloser,
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
