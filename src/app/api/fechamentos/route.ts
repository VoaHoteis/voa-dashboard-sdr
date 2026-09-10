/**
 * Card de Fechamentos: negocios ganhos no mes, por closer e por funil.
 *
 * GET /api/fechamentos?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
 * Sem parametros, usa o mes corrente -- e o recorte natural de "fechamentos do
 * mes", igual aos demais cards de meta mensal.
 */

import { NextResponse } from 'next/server';
import { CLOSERS } from '@/lib/config';
import { hoje, primeiroDiaDoMes, ultimoDiaDoMes } from '@/lib/dates';
import { resolverFechamentos, zeroPorFunil } from '@/lib/metrics';
import { buscarNegociosGanhos } from '@/lib/pipedrive';
import type { FechamentosResposta, ItemFechamento } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const { searchParams } = new URL(req.url);
    const ref = hoje();
    const inicio = searchParams.get('inicio') || primeiroDiaDoMes(ref);
    const fim = searchParams.get('fim') || ultimoDiaDoMes(ref);

    const ganhos = await buscarNegociosGanhos({ inicio, fim });
    const itens = resolverFechamentos(ganhos);

    const porFunil = zeroPorFunil();
    const valorPorFunil = zeroPorFunil();
    for (const i of itens) {
      porFunil[i.funil] += 1;
      valorPorFunil[i.funil] += i.valor;
    }

    const closerKeys = new Set(CLOSERS.map((c) => c.key));
    const porCloser = CLOSERS.map((c) => {
      const meus = itens.filter((i) => i.dono === c.key);
      const pf = zeroPorFunil();
      let valor = 0;
      for (const i of meus) {
        pf[i.funil] += 1;
        valor += i.valor;
      }
      return { closer: c.key, nome: c.nome, total: meus.length, valor, porFunil: pf };
    });

    const outrosItens = itens.filter((i) => !(i.dono && closerKeys.has(i.dono)));

    const resposta: FechamentosResposta = {
      periodo: { inicio, fim },
      time: {
        total: itens.length,
        valor: itens.reduce((s, i) => s + i.valor, 0),
        porFunil,
        valorPorFunil,
      },
      porCloser,
      outros: {
        total: outrosItens.length,
        valor: outrosItens.reduce((s, i) => s + i.valor, 0),
      },
      // A lista crua vai junto para o modal de detalhe recortar em memoria, sem
      // uma segunda consulta que poderia discordar do numero exibido.
      itens: itens.map(
        (i): ItemFechamento => ({
          negocioId: i.negocio.id,
          titulo: i.negocio.title,
          data: i.data || inicio,
          funil: i.funil,
          closer: i.dono,
          valor: i.valor,
        })
      ),
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
