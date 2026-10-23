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
    const fimMesAnterior = addDias(primeiroDiaDoMes(ref), -1);
    const inicio = primeiroDiaDoMes(addDias(primeiroDiaDoMes(fimMesAnterior), -1));
    const fim = ref;
    const [atividades, ganhos] = await Promise.all([
      buscarAtividades({ inicio, fim, tipos: TIPOS_AGENDAMENTO, concluidas: true }),
      buscarNegociosGanhos({ inicio, fim }),
    ]);
    const idsNegocios = atividades
      .map((atividade) => atividade.deal_id)
      .filter((id): id is number => typeof id === 'number');
    const negocios = await buscarNegociosPorIds(idsNegocios);
    const agendamentosValidos = atividades.filter((atividade) => {
      const data = atividade.due_date?.slice(0, 10);
      if (!data || data < inicio || data > fim || atividade.deal_id == null) return false;
      const negocio = negocios.get(atividade.deal_id);
      return negocio !== undefined && PIPELINE_TO_FUNNEL[negocio.pipeline_id] !== undefined;
    });

    const chavesClosers = new Set(CLOSERS.map((closer) => closer.key));
    const porCloser = CLOSERS.map((closer) => {
      const agendamentos = agendamentosValidos.filter((atividade) => {
        const negocio = atividade.deal_id == null ? undefined : negocios.get(atividade.deal_id);
        return negocio !== undefined && pessoaDoProprietario(negocio) === closer.key;
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

    const outrosAgendamentos = agendamentosValidos.filter((atividade) => {
      const negocio = atividade.deal_id == null ? undefined : negocios.get(atividade.deal_id);
      const closer = negocio ? pessoaDoProprietario(negocio) : null;
      return !closer || !chavesClosers.has(closer);
    }).length;
    const outrosContratos = ganhos.filter((negocio) => {
      const closer = pessoaDoProprietario(negocio);
      return !closer || !chavesClosers.has(closer);
    }).length;
    if (outrosAgendamentos > 0 || outrosContratos > 0) {
      porCloser.push({
        closer: 'outros',
        nome: 'Outros proprietários',
        agendamentos: outrosAgendamentos,
        contratos: outrosContratos,
        taxaConversao:
          outrosAgendamentos > 0 ? (outrosContratos / outrosAgendamentos) * 100 : null,
      });
    }

    const totalAgendamentos = agendamentosValidos.length;
    const totalContratos = ganhos.length;

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
