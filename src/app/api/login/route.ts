import { NextResponse } from 'next/server';
import { COOKIE_SESSAO, criarToken, opcoesCookie, senhaConfere } from '@/lib/sessao';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { senha } = (await req.json().catch(() => ({}))) as { senha?: string };

  if (!process.env.DASHBOARD_SENHA) {
    return NextResponse.json(
      { erro: 'DASHBOARD_SENHA não está configurada no servidor.' },
      { status: 503 }
    );
  }

  if (!senha || !(await senhaConfere(senha))) {
    // Atraso curto para encarecer tentativa em massa sem irritar quem so errou.
    await new Promise((r) => setTimeout(r, 700));
    return NextResponse.json({ erro: 'Senha incorreta.' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_SESSAO, await criarToken(), opcoesCookie(process.env.NODE_ENV === 'production'));
  return res;
}
