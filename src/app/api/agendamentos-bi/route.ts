import { NextResponse } from 'next/server';
import { pessoaPorChave, TIPOS_AGENDAMENTO } from '@/lib/config';
import { resolverAgendamentos } from '@/lib/metrics';
import { buscarAtividades, buscarNegociosPorIds } from '@/lib/pipedrive';
import type { AgendamentosMensaisResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

const NOMES_MESES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const { searchParams } = new URL(req.url);
    const ano = Number(searchParams.get('ano') || '2026');

    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
      return NextResponse.json({ erro: 'Ano inválido.' }, { status: 400 });
    }

    const inicio = `${ano}-01-01` as `${number}-${string}`;
    const fim = `${ano}-12-31` as `${number}-${string}`;
    const atividades = await buscarAtividades({
      inicio,
      fim,
      tipos: TIPOS_AGENDAMENTO,
      concluidas: true,
    });
    const negocios = await buscarNegociosPorIds(
      atividades.map((atividade) => atividade.deal_id).filter((id): id is number => typeof id === 'number')
    );
    const agendamentos = resolverAgendamentos(atividades, negocios);

    const meses = NOMES_MESES.map((nome, indice) => ({
      mes: `${ano}-${String(indice + 1).padStart(2, '0')}`,
      nome,
      sdrs: 0,
      closers: 0,
      outros: 0,
      total: 0,
    }));

    for (const agendamento of agendamentos) {
      const data = agendamento.atividade.due_date;
      if (!data) continue;
      const mes = meses[Number(data.slice(5, 7)) - 1];
      if (!mes || !data.startsWith(String(ano))) continue;

      const todosSdrs = agendamento.sdrs.length > 0 && agendamento.sdrs.every(
        (chave) => pessoaPorChave(chave)?.papel === 'sdr'
      );
      const todosClosers = agendamento.sdrs.length > 0 && agendamento.sdrs.every(
        (chave) => pessoaPorChave(chave)?.papel === 'closer'
      );

      if (todosSdrs) mes.sdrs += 1;
      else if (todosClosers) mes.closers += 1;
      else mes.outros += 1;
      mes.total += 1;
    }

    const resposta: AgendamentosMensaisResposta = { ano, meses };
    return NextResponse.json(resposta);
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
