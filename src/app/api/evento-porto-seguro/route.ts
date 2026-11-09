import { NextResponse } from 'next/server';
import { buscarMetricasEventoPortoSeguro } from '@/lib/pipedrive';
import type { MetricasEventoPortoSeguroResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const resposta: MetricasEventoPortoSeguroResposta = await buscarMetricasEventoPortoSeguro();
    return NextResponse.json(resposta);
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
