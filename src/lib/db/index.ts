import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDatabase = globalThis as typeof globalThis & { queuePool?: Pool };

export const pool =
  globalForDatabase.queuePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== 'production') globalForDatabase.queuePool = pool;

export const db = drizzle(pool, { schema });
