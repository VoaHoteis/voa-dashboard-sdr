import { NextResponse } from 'next/server';
import { limparCache, PipedriveError } from '@/lib/pipedrive';

/** Erro vira JSON com motivo legivel -- o prototipo engolia tudo em catch vazio. */
export function respostaDeErro(e: unknown) {
  const msg = e instanceof PipedriveError || e instanceof Error ? e.message : String(e);
  const status = e instanceof PipedriveError && e.status === 429 ? 429 : 500;
  const headers = new Headers({ 'Cache-Control': 'no-store' });

  if (status === 429) {
    const esperaMs = e instanceof PipedriveError ? e.retryAfterMs : undefined;
    headers.set('Retry-After', String(Math.max(1, Math.ceil((esperaMs ?? 2000) / 1000))));
  }

  return NextResponse.json({ erro: msg }, { status, headers });
}

/** Compatibilidade para chamadas antigas; a atualização atual é centralizada em uma rota única. */
export function limparCacheSePedido(req: Request): void {
  // Nunca deixar a leitura da propria URL derrubar a rota: se ela vier num
  // formato inesperado, o pior caso e servir do cache -- nao e motivo para o
  // card inteiro falhar.
  try {
    if (new URL(req.url).searchParams.get('atualizar') === '1') limparCache();
  } catch {
    /* ignora */
  }
}
