import { NextResponse } from 'next/server';
import { CLOSERS } from '@/lib/config';
import { addDias, hoje, primeiroDiaDoMes, ultimoDiaDoMes, type ISODate } from '@/lib/dates';
import {
  buscarAtividades,
  buscarNegociosPorIds,
  dataConclusao,
  pessoaDoProprietario,
  resolverTiposAgendamentoPorNomes,
} from '@/lib/pipedrive';
import type { AgendamentosClosersResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

const TIPOS_REUNIAO = [
  {
    key: 'reuniao_de_apresentacao_gc',
    nomePipedrive: 'Reunião de Apresentação Prospecção Executivo',
  },
  {
    key: 'apresentacao_institucional',
    nomePipedrive: 'Reunião de Apresentação',
  },
] as const;

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const { searchParams } = new URL(req.url);
    const referencia = hoje();
    const inicio = (searchParams.get('inicio') || primeiroDiaDoMes(referencia)) as ISODate;
    const fim = (searchParams.get('fim') || ultimoDiaDoMes(referencia)) as ISODate;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim) || inicio > fim) {
      return NextResponse.json({ erro: 'Período inválido.' }, { status: 400 });
    }

    const tipos = await resolverTiposAgendamentoPorNomes(TIPOS_REUNIAO);
    const atividades = await buscarAtividades({
      inicio: addDias(inicio, -35),
      fim: addDias(fim, 35),
      tipos,
      concluidas: true,
    });
    const realizadasNoPeriodo = atividades.filter((atividade) => {
      const data = dataConclusao(atividade);
      return data !== null && data >= inicio && data <= fim && atividade.deal_id !== null;
    });
    const negocios = await buscarNegociosPorIds(
      realizadasNoPeriodo.map((atividade) => atividade.deal_id as number)
    );
    const contagens = new Map(CLOSERS.map((closer) => [closer.key, 0]));

    for (const atividade of realizadasNoPeriodo) {
      const negocio = atividade.deal_id === null ? undefined : negocios.get(atividade.deal_id);
      const closer = pessoaDoProprietario(negocio);
      if (closer && contagens.has(closer)) {
        contagens.set(closer, (contagens.get(closer) ?? 0) + 1);
      }
    }

    const resposta: AgendamentosClosersResposta = {
      periodo: { inicio, fim },
      total: [...contagens.values()].reduce((soma, quantidade) => soma + quantidade, 0),
      porCloser: CLOSERS.map((closer) => ({
        closer: closer.key,
        nome: closer.nome,
        total: contagens.get(closer.key) ?? 0,
      })),
    };

    return NextResponse.json(resposta);
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
