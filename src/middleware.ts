/**
 * Porta de entrada: sem sessao valida, ninguem passa.
 *
 * Cobre as rotas /api/* tambem -- sao elas que carregam os numeros. Proteger so
 * a pagina deixaria os dados a um `curl` de distancia.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COOKIE_SESSAO, tokenValido } from '@/lib/sessao';

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

const LIVRES = ['/login', '/api/login', '/api/logout'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (LIVRES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Falha FECHADA: sem senha configurada em producao o dashboard nao abre. O
  // contrario -- liberar quando a variavel falta -- publicaria os dados do time
  // por causa de um esquecimento no painel da Vercel.
  if (!process.env.DASHBOARD_SENHA) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse(
        'DASHBOARD_SENHA não está definida no ambiente. O dashboard fica fechado até que ela seja configurada.',
        { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }
      );
    }
    return NextResponse.next(); // em desenvolvimento, sem atrito
  }

  if (await tokenValido(req.cookies.get(COOKIE_SESSAO)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ erro: 'Sessão expirada. Recarregue a página e entre de novo.' }, { status: 401 });
  }

  const destino = req.nextUrl.clone();
  destino.pathname = '/login';
  destino.search = '';
  return NextResponse.redirect(destino);
}
