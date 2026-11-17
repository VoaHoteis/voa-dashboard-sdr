import { and, eq, lt, ne, sql } from 'drizzle-orm';
import { db } from './db';
import { pipedriveApiCache } from './db/schema';

const CHAVE_GERACAO = '__pipedrive_cache_generation__';
const TTL_CACHE_MS = 5 * 60 * 1000;
const MAX_IDADE_STALE_MS = 24 * 60 * 60 * 1000;
const TTL_MEMORIA_MS = 15 * 1000;
const localCache = new Map<string, { payload: unknown; cachedAt: number; generation: number }>();

function guardarLocal(chave: string, payload: unknown, cachedAt: number, generation: number) {
  localCache.set(chave, { payload, cachedAt, generation });
  while (localCache.size > 250) {
    const chaveMaisAntiga = localCache.keys().next().value;
    if (chaveMaisAntiga === undefined) break;
    localCache.delete(chaveMaisAntiga);
  }
}

export function limparCachePipedriveLocal(): void {
  localCache.clear();
}

export async function buscarComCachePipedrive<T>(
  chaveOriginal: string,
  carregar: () => Promise<T>
): Promise<T> {
  if (process.env.NODE_ENV === 'test') return carregar();

  const chave = `api:${chaveOriginal}`;
  const [estadoInicial] = await db
    .select({ generation: pipedriveApiCache.generation })
    .from(pipedriveApiCache)
    .where(eq(pipedriveApiCache.cacheKey, CHAVE_GERACAO))
    .limit(1);
  const geracaoInicial = estadoInicial?.generation ?? 0;
  const memoria = localCache.get(chave);
  const agora = Date.now();

  if (
    memoria &&
    memoria.generation === geracaoInicial &&
    agora - memoria.cachedAt < TTL_MEMORIA_MS
  ) {
    return memoria.payload as T;
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${chave}))`);

    const [estadoAtual] = await tx
      .select({ generation: pipedriveApiCache.generation })
      .from(pipedriveApiCache)
      .where(eq(pipedriveApiCache.cacheKey, CHAVE_GERACAO))
      .limit(1);
    const geracao = estadoAtual?.generation ?? 0;
    const [cache] = await tx
      .select({ payload: pipedriveApiCache.payload, cachedAt: pipedriveApiCache.cachedAt, generation: pipedriveApiCache.generation })
      .from(pipedriveApiCache)
      .where(eq(pipedriveApiCache.cacheKey, chave))
      .limit(1);
    const idade = cache ? Date.now() - cache.cachedAt.getTime() : Number.POSITIVE_INFINITY;

    if (cache && cache.generation === geracao && idade < TTL_CACHE_MS) {
      const payload = cache.payload as T;
      guardarLocal(chave, payload, cache.cachedAt.getTime(), geracao);
      return payload;
    }

    try {
      const payload = await carregar();
      const cachedAt = new Date();
      await tx
        .insert(pipedriveApiCache)
        .values({ cacheKey: chave, payload, cachedAt, generation: geracao })
        .onConflictDoUpdate({
          target: pipedriveApiCache.cacheKey,
          set: { payload, cachedAt, generation: geracao },
        });
      guardarLocal(chave, payload, cachedAt.getTime(), geracao);
      return payload;
    } catch (erro) {
      if (cache && idade < MAX_IDADE_STALE_MS) {
        return cache.payload as T;
      }
      throw erro;
    }
  });
}

export async function solicitarAtualizacaoPipedrive(): Promise<number> {
  const geracao = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${CHAVE_GERACAO}))`);

    const [estado] = await tx
      .select({ generation: pipedriveApiCache.generation, cachedAt: pipedriveApiCache.cachedAt })
      .from(pipedriveApiCache)
      .where(eq(pipedriveApiCache.cacheKey, CHAVE_GERACAO))
      .limit(1);
    const agora = new Date();

    if (estado && agora.getTime() - estado.cachedAt.getTime() < 8_000) {
      return estado.generation;
    }

    const [atualizado] = await tx
      .insert(pipedriveApiCache)
      .values({ cacheKey: CHAVE_GERACAO, payload: null, cachedAt: agora, generation: 1 })
      .onConflictDoUpdate({
        target: pipedriveApiCache.cacheKey,
        set: {
          cachedAt: agora,
          generation: sql`${pipedriveApiCache.generation} + 1`,
        },
      })
      .returning({ generation: pipedriveApiCache.generation });

    localCache.clear();
    return atualizado.generation;
  });

  const limite = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await db
    .delete(pipedriveApiCache)
    .where(and(ne(pipedriveApiCache.cacheKey, CHAVE_GERACAO), lt(pipedriveApiCache.cachedAt, limite)));

  return geracao;
}
