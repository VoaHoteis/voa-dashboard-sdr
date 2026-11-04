/**
 * Card de Fechamentos: negocios ganhos no mes, por closer e por funil.
 *
 * GET /api/fechamentos?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
 * Sem parametros, usa o mes corrente -- e o recorte natural de "fechamentos do
 * mes", igual aos demais cards de meta mensal.
 */

import { NextResponse } from 'next/server';
import { CLOSERS, TIPOS_AGENDAMENTO, nomeDaPessoa } from '@/lib/config';
import { hoje, primeiroDiaDoMes, ultimoDiaDoMes } from '@/lib/dates';
import { atribuir, resolverFechamentos, zeroPorFunil } from '@/lib/metrics';
import {
  buscarAgendamentosPorNegocio,
  buscarCampoNegocioPorNome,
  buscarNegociosGanhos,
  resolverTiposAgendamento,
  type Negocio,
} from '@/lib/pipedrive';
import type { FechamentosResposta, ItemFechamento } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

function textoCampoOrigem(
  valor: unknown,
  opcoes: Map<number, string>
): string | null {
  const comoTexto = (candidato: unknown): string | null => {
    if (typeof candidato === 'number') return opcoes.get(candidato) ?? String(candidato);
    if (typeof candidato !== 'string' || !candidato.trim()) return null;

    const texto = candidato.trim();
    const id = Number(texto);
    return Number.isSafeInteger(id) ? opcoes.get(id) ?? texto : texto;
  };

  const textoDireto = comoTexto(valor);
  if (textoDireto) return textoDireto;
  if (!valor || typeof valor !== 'object') return null;

  const campo = valor as { id?: unknown; name?: unknown; label?: unknown; value?: unknown };
  for (const candidato of [campo.name, campo.label, campo.value, campo.id]) {
    const texto = comoTexto(candidato);
    if (texto) return texto;
  }
  return null;
}

function origemDoNegocio(negocio: Negocio, campoKey: string, opcoes: Map<number, string>): string | null {
  const campos = negocio as Record<string, unknown>;
  const personalizados = campos.custom_fields as Record<string, unknown> | undefined;
  return textoCampoOrigem(campos[campoKey] ?? personalizados?.[campoKey], opcoes);
}

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const { searchParams } = new URL(req.url);
    const ref = hoje();
    const inicio = searchParams.get('inicio') || primeiroDiaDoMes(ref);
    const fim = searchParams.get('fim') || ultimoDiaDoMes(ref);

    const [ganhos, tiposApresentacao, campoCanal] = await Promise.all([
      buscarNegociosGanhos({ inicio, fim }),
      resolverTiposAgendamento(TIPOS_AGENDAMENTO),
      buscarCampoNegocioPorNome('CANAL'),
    ]);
    const opcoesCanal = new Map(campoCanal.options.map((opcao) => [Number(opcao.id), opcao.label]));
    const itens = resolverFechamentos(ganhos);
    const apresentacoesPorNegocio = await buscarAgendamentosPorNegocio(
      itens.map((item) => item.negocio),
      tiposApresentacao
    );

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
      // Os itens seguem completos para que os recortes do modal não precisem
      // fazer uma nova consulta e possam manter o mesmo resultado do card.
      itens: itens.map((i): ItemFechamento => {
        const temApresentacao = apresentacoesPorNegocio.has(i.negocio.id);
        const sdrApresentacao = temApresentacao
          ? atribuir(i.negocio).sdrs.map(nomeDaPessoa).join(', ')
          : '';

        return {
          negocioId: i.negocio.id,
          titulo: i.negocio.title,
          data: i.data || inicio,
          funil: i.funil,
          closer: i.dono,
          sdrApresentacao: sdrApresentacao || null,
          origem: origemDoNegocio(i.negocio, campoCanal.key, opcoesCanal),
          valor: i.valor,
        };
      }),
    };

    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
