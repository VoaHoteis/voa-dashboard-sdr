/**
 * Tabela mensal de Marketing Inbound.
 *
 * GET /api/marketing?ano=YYYY
 * Sem `ano`, usa o ano corrente. Junta Kinbox (leads), Pipedrive (reuniões,
 * contratos, MRR) e Windsor.ai (investimento) numa resposta por mês.
 */

import { NextResponse } from 'next/server';
import { hoje, parse } from '@/lib/dates';
import { montarMarketing } from '@/lib/marketing';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const { searchParams } = new URL(req.url);
    const anoParam = Number(searchParams.get('ano'));
    const ano = Number.isInteger(anoParam) && anoParam > 2000 ? anoParam : parse(hoje()).y;

    const resposta = await montarMarketing(ano);
    return NextResponse.json(resposta);
  } catch (e) {
    return respostaDeErro(e);
  }
}
