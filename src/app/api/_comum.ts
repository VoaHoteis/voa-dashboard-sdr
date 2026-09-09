import { NextResponse } from 'next/server';
import { limparCache, PipedriveError } from '@/lib/pipedrive';

/** Erro vira JSON com motivo legivel -- o prototipo engolia tudo em catch vazio. */
export function respostaDeErro(e: unknown) {
  const msg = e instanceof PipedriveError || e instanceof Error ? e.message : String(e);
  const status = e instanceof PipedriveError && e.status === 429 ? 429 : 500;
  return NextResponse.json({ erro: msg }, { status });
}

/**
 * O botao "Atualizar" manda `?atualizar=1`. Sem isso o cache de 60s devolveria
 * o mesmo numero e o clique pareceria nao ter feito nada -- pior que nao ter
 * botao, porque passa a impressao de que o dado esta fresco.
 */
export function limparCacheSePedido(req: Request): void {
  if (new URL(req.url).searchParams.get('atualizar') === '1') limparCache();
}
