import { NextResponse } from 'next/server';
import { hoje, type ISODate } from '@/lib/dates';
import { resolverFechamentos } from '@/lib/metrics';
import { buscarNegociosGanhos } from '@/lib/pipedrive';
import type { FechamentosMensaisResposta } from '@/lib/types';
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
    const ano = Number(searchParams.get('ano') || hoje().slice(0, 4));

    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100) {
      return NextResponse.json({ erro: 'Ano inválido.' }, { status: 400 });
    }

    const inicio = `${ano}-01-01` as ISODate;
    const fim = `${ano}-12-31` as ISODate;
    const negocios = await buscarNegociosGanhos({ inicio, fim });
    const fechamentos = resolverFechamentos(negocios);
    const meses = NOMES_MESES.map((nome, indice) => ({
      mes: `${ano}-${String(indice + 1).padStart(2, '0')}`,
      nome,
      porFunil: { novosNegocios: 0, salabim: 0 },
      total: 0,
    }));

    for (const fechamento of fechamentos) {
      const mes = meses[Number(fechamento.data.slice(5, 7)) - 1];
      if (!mes || !fechamento.data.startsWith(String(ano))) continue;

      mes.porFunil[fechamento.funil] += 1;
      mes.total += 1;
    }

    const resposta: FechamentosMensaisResposta = { ano, meses };
    return NextResponse.json(resposta);
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
