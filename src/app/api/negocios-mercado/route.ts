import { NextResponse } from 'next/server';
import {
  buscarNegociosAbertos,
  buscarNegociosPerdidos,
  contarNegociosPorCampo,
} from '@/lib/pipedrive';
import type { NegociosMercadoResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const fim = new Date().toISOString().slice(0, 10);
    const [abertos, perdidos] = await Promise.all([
      buscarNegociosAbertos(),
      buscarNegociosPerdidos({ inicio: '1970-01-01', fim }),
    ]);
    const negocios = [...abertos, ...perdidos];
    const [channelManager, pms] = await Promise.all([
      contarNegociosPorCampo(negocios, 'CHANNEL'),
      contarNegociosPorCampo(negocios, 'PMS'),
    ]);

    const resposta: NegociosMercadoResposta = { channelManager, pms };

    return NextResponse.json(resposta);
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
