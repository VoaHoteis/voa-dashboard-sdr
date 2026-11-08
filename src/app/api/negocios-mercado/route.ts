import { NextResponse } from 'next/server';
import {
  buscarNegociosAbertos,
  contarNegociosPorCampo,
} from '@/lib/pipedrive';
import type { NegociosMercadoResposta } from '@/lib/types';
import { limparCacheSePedido, respostaDeErro } from '../_comum';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    limparCacheSePedido(req);
    const negocios = await buscarNegociosAbertos();
    const [channelManager, pms] = await Promise.all([
      contarNegociosPorCampo(negocios, 'CHANNEL'),
      contarNegociosPorCampo(negocios, 'PMS'),
    ]);

    const resposta: NegociosMercadoResposta = {
      totalNegocios: negocios.length,
      channelManager,
      pms,
    };

    return NextResponse.json(resposta);
  } catch (erro) {
    return respostaDeErro(erro);
  }
}
