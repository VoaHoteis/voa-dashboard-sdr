import { NextResponse } from 'next/server';
import { solicitarAtualizacaoPipedrive } from '@/lib/pipedrive-cache';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');

  try {
    if (!origin || !host || new URL(origin).host !== host) {
      return NextResponse.json({ erro: 'Origem da solicitação inválida.' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ erro: 'Origem da solicitação inválida.' }, { status: 403 });
  }

  try {
    const geracao = await solicitarAtualizacaoPipedrive();
    return NextResponse.json(
      { geracao },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json(
      { erro: 'Não foi possível iniciar a atualização compartilhada.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
