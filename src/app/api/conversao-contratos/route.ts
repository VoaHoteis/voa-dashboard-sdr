import { NextResponse } from 'next/server';
import { CLOSERS, PIPELINE_TO_FUNNEL, TIPOS_AGENDAMENTO } from '@/lib/config';
import { addDias, hoje, primeiroDiaDoMes, ultimoDiaDoMes } from '@/lib/dates';
import {
  buscarAtividades,
  buscarNegociosGanhos,
  buscarNegociosPorIds,
  dataConclusao,
  pessoaDoProprietario,
} from '@/lib/pipedrive';
import type { ConversaoContratosResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const ref = hoje();
    const inicio = primeiroDiaDoMes(ref);
    const fim = ultimoDiaDoMes(ref);
    const tipos = await Promise.all(
      CLOSERS.map(async (closer) => ({
        closer,
        atividades: await buscarAtividades({
          inicio: addDias(inicio, -35),
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
      const reunioes = atividades.filter((atividade) => {
        const data = dataConclusao(atividade);
        if (!data || data < inicio || data > fim || atividade.deal_id == null) return false;
        const negocio = negocios.get(atividade.deal_id);
        return negocio !== undefined && PIPELINE_TO_FUNNEL[negocio.pipeline_id] !== undefined;
      }).length;
      const contratos = ganhos.filter((negocio) => pessoaDoProprietario(negocio) === closer.key).length;

      return {
        closer: closer.key,
        nome: closer.nome,
        reunioes,
        contratos,
        taxaConversao: reunioes > 0 ? (contratos / reunioes) * 100 : null,
      };
    });
    const totalReunioes = porCloser.reduce((total, closer) => total + closer.reunioes, 0);
    const totalContratos = porCloser.reduce((total, closer) => total + closer.contratos, 0);

    const resposta: ConversaoContratosResposta = {
      periodo: { inicio, fim },
      totalReunioes,
      totalContratos,
      taxaConversao: totalReunioes > 0 ? (totalContratos / totalReunioes) * 100 : null,
      porCloser,
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
