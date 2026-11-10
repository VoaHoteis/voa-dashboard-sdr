import { asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { queueEvents, queueLock, queueMembers } from '@/lib/db/schema';
import { CLOSERS, SDRS_ATIVOS } from '@/lib/config';
import { QueueConflictError, QueueInputError, rotateQueue } from '@/lib/fila-atendimento-core';
import type {
  QueueActionInput,
  QueueEvent,
  QueueMember,
  QueueOrderInput,
  QueuePersonMetrics,
  QueueReason,
  QueueSnapshot,
} from '@/lib/fila-atendimento-types';

const HISTORY_LIMIT = 100;
const METRICS_LIMIT = 1_000;
const COMMERCIAL_ROSTER = [
  ...SDRS_ATIVOS.map(({ key, userId, nome }) => ({ memberKey: key, sourceUserId: userId, name: nome })),
  ...CLOSERS.map(({ key, userId, nome }) => ({ memberKey: key, sourceUserId: userId, name: nome })),
];

export interface QueueMemberRow {
  memberKey: string;
  sourceUserId: number | null;
  name: string;
  position: number;
  isActive: boolean;
}

export type QueueEventInsert = Omit<QueueEvent, 'id' | 'createdAt'>;

export interface QueueTransactionPort {
  lockAndReadVersion(): Promise<string>;
  getActiveQueue(): Promise<QueueMemberRow[]>;
  insertEvent(event: QueueEventInsert): Promise<QueueEvent>;
  replaceQueueOrder(memberKeys: string[], roster: Array<{ memberKey: string; sourceUserId: number; name: string }>): Promise<void>;
  advanceVersion(): Promise<string>;
}

export interface QueueDatabasePort {
  transaction<T>(operation: (transaction: QueueTransactionPort) => Promise<T>): Promise<T>;
}

export function createQueueService(database: QueueDatabasePort) {
  return {
    async registerAction(input: QueueActionInput) {
      return database.transaction(async (transaction) => {
        const version = await transaction.lockAndReadVersion();
        assertCurrentVersion(input.expectedQueueVersion, version);

        const currentQueue = await transaction.getActiveQueue();
        if (currentQueue.length === 0) {
          throw new QueueConflictError('A fila está vazia. Nenhuma ação foi registrada.');
        }
        const currentMember = currentQueue[0];
        if (currentMember.memberKey !== input.expectedMemberKey) {
          throw new QueueConflictError('A fila mudou. Atualize os dados antes de registrar a ação.');
        }

        const eventInput: QueueEventInsert = {
          action: input.action,
          queueMemberKey: currentMember.memberKey,
          queueMemberName: currentMember.name,
          actorName: null,
          source: input.action === 'assumir' ? input.source : null,
          link: input.action === 'assumir' && input.source === 'kinbox' ? input.link : null,
          redirectedBy:
            input.action === 'assumir' && input.source === 'redirecionamento' ? input.redirectedBy : null,
          hotelName:
            input.action === 'assumir' && input.source === 'redirecionamento' ? input.hotelName : null,
          reason: input.action === 'passar_vez' ? input.reason : null,
        };
        const event = await transaction.insertEvent(eventInput);
        const nextQueue = rotateQueue(currentQueue);
        await transaction.replaceQueueOrder(
          nextQueue.map(({ memberKey }) => memberKey),
          []
        );
        const queueVersion = await transaction.advanceVersion();

        return { event, queueVersion };
      });
    },

    async saveQueue(input: QueueOrderInput) {
      return database.transaction(async (transaction) => {
        const version = await transaction.lockAndReadVersion();
        assertCurrentVersion(input.expectedQueueVersion, version);

        const currentQueue = await transaction.getActiveQueue();
        const allowedKeys = new Set([
          ...COMMERCIAL_ROSTER.map(({ memberKey }) => memberKey),
          ...currentQueue.map(({ memberKey }) => memberKey),
        ]);
        if (input.memberKeys.some((key) => !allowedKeys.has(key))) {
          throw new QueueInputError('A lista contém alguém que não pertence ao time Comercial atual. Atualize e tente novamente.');
        }

        await transaction.replaceQueueOrder(input.memberKeys, COMMERCIAL_ROSTER);
        return { queueVersion: await transaction.advanceVersion() };
      });
    },
  };
}

function assertCurrentVersion(expected: string, current: string) {
  if (expected !== current) {
    throw new QueueConflictError('A fila foi alterada por outra pessoa. Suas mudanças não foram salvas; atualize os dados e tente novamente.');
  }
}

type DrizzleTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const postgresQueueDatabase: QueueDatabasePort = {
  transaction: (operation) =>
    db.transaction((transaction) => operation(createPostgresTransaction(transaction))),
};

function createPostgresTransaction(transaction: DrizzleTransaction): QueueTransactionPort {
  return {
    async lockAndReadVersion() {
      // Um único lock serializa tanto as ações da fila quanto as alterações de composição.
      const result = await transaction.execute(sql`
        SELECT updated_at::text AS version
        FROM queue_lock
        WHERE id = 1
        FOR UPDATE
      `);
      const row = (result.rows as Array<{ version: string }>)[0];
      if (!row?.version) throw new Error('O registro de controle da fila não foi encontrado.');
      return row.version;
    },

    async getActiveQueue() {
      return transaction
        .select({
          memberKey: queueMembers.memberKey,
          sourceUserId: queueMembers.sourceUserId,
          name: queueMembers.name,
          position: queueMembers.position,
          isActive: queueMembers.isActive,
        })
        .from(queueMembers)
        .where(eq(queueMembers.isActive, true))
        .orderBy(asc(queueMembers.position), asc(queueMembers.memberKey));
    },

    async insertEvent(event) {
      const [row] = await transaction
        .insert(queueEvents)
        .values({
          action: event.action,
          queueMemberKey: event.queueMemberKey,
          actorName: event.actorName,
          source: event.source,
          link: event.link,
          redirectedBy: event.redirectedBy,
          hotelName: event.hotelName,
          reason: event.reason,
        })
        .returning();

      return {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        action: row.action as QueueEvent['action'],
        queueMemberKey: row.queueMemberKey,
        queueMemberName: event.queueMemberName,
        actorName: row.actorName,
        source: row.source as QueueEvent['source'],
        link: row.link,
        redirectedBy: row.redirectedBy,
        hotelName: row.hotelName,
        reason: row.reason as QueueReason | null,
      };
    },

    async replaceQueueOrder(memberKeys, roster) {
      if (roster.length > 0) {
        await transaction
          .insert(queueMembers)
          .values(roster)
          .onConflictDoUpdate({
            target: queueMembers.memberKey,
            set: {
              sourceUserId: sql`excluded.source_user_id`,
              name: sql`excluded.name`,
              updatedAt: sql`now()`,
            },
          });
      }

      await transaction
        .update(queueMembers)
        .set({ isActive: false, position: 0, updatedAt: new Date() })
        .where(eq(queueMembers.isActive, true));

      if (memberKeys.length > 0) {
        const positions = sql.join(
          memberKeys.map((memberKey, position) => sql`(${memberKey}::text, ${position}::integer)`),
          sql`, `
        );
        await transaction.execute(sql`
          UPDATE queue_members AS member
          SET is_active = true,
              position = ordered.position,
              updated_at = now()
          FROM (VALUES ${positions}) AS ordered(member_key, position)
          WHERE member.member_key = ordered.member_key
        `);
      }
    },

    async advanceVersion() {
      const result = await transaction.execute(sql`
        UPDATE queue_lock
        SET updated_at = GREATEST(clock_timestamp(), updated_at + interval '1 microsecond')
        WHERE id = 1
        RETURNING updated_at::text AS version
      `);
      const row = (result.rows as Array<{ version: string }>)[0];
      if (!row?.version) throw new Error('Não foi possível atualizar a versão da fila.');
      return row.version;
    },
  };
}

export const queueService = createQueueService(postgresQueueDatabase);

export async function getQueueSnapshot(): Promise<QueueSnapshot> {
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`);
    return getQueueSnapshotInTransaction(transaction);
  });
}

async function getQueueSnapshotInTransaction(transaction: DrizzleTransaction): Promise<QueueSnapshot> {
  const versionResult = await transaction.execute(sql`
    SELECT updated_at::text AS version FROM queue_lock WHERE id = 1
  `);
  const queueVersion = (versionResult.rows as Array<{ version: string }>)[0]?.version;
  if (!queueVersion) throw new Error('O registro de controle da fila não foi encontrado.');

  const storedMembers = await transaction
    .select()
    .from(queueMembers)
    .orderBy(asc(queueMembers.position), asc(queueMembers.name));
  const historyRows = await selectEvents(transaction, HISTORY_LIMIT);
  const metricRows = await selectEvents(transaction, METRICS_LIMIT);

  const storedByKey = new Map(storedMembers.map((member) => [member.memberKey, member]));
  const configuredKeys = new Set<string>(COMMERCIAL_ROSTER.map(({ memberKey }) => memberKey));
  const configuredMembers: QueueMember[] = COMMERCIAL_ROSTER.map(({ memberKey, sourceUserId, name }) => {
    const stored = storedByKey.get(memberKey);
    return {
      memberKey,
      sourceUserId,
      name: stored?.name ?? name,
      position: stored?.isActive ? stored.position : null,
      isActive: stored?.isActive ?? false,
      isEligible: true,
    };
  });
  const activeArchivedMembers: QueueMember[] = storedMembers
    .filter((member) => member.isActive && !configuredKeys.has(member.memberKey))
    .map((member) => ({
      memberKey: member.memberKey,
      sourceUserId: member.sourceUserId,
      name: member.name,
      position: member.position,
      isActive: true,
      isEligible: false,
    }));
  const members = [...configuredMembers, ...activeArchivedMembers];
  const activeByKey = new Map(members.map((member) => [member.memberKey, member]));
  const queue = storedMembers
    .filter((member) => member.isActive)
    .sort((a, b) => a.position - b.position || a.memberKey.localeCompare(b.memberKey))
    .map((member) => activeByKey.get(member.memberKey)!)
    .filter(Boolean);

  const events = historyRows.map(toPublicEvent);
  const recentMetrics = metricRows.map(toPublicEvent);

  return {
    queueVersion,
    members,
    queue,
    events,
    metrics: aggregateEvents(recentMetrics, COMMERCIAL_ROSTER),
  };
}

async function selectEvents(transaction: DrizzleTransaction, limit: number) {
  return transaction
    .select({
      id: queueEvents.id,
      createdAt: queueEvents.createdAt,
      action: queueEvents.action,
      queueMemberKey: queueEvents.queueMemberKey,
      queueMemberName: sql<string>`COALESCE(${queueMembers.name}, ${queueEvents.queueMemberKey})`,
      actorName: queueEvents.actorName,
      source: queueEvents.source,
      link: queueEvents.link,
      redirectedBy: queueEvents.redirectedBy,
      hotelName: queueEvents.hotelName,
      reason: queueEvents.reason,
    })
    .from(queueEvents)
    .leftJoin(queueMembers, eq(queueEvents.queueMemberKey, queueMembers.memberKey))
    .orderBy(desc(queueEvents.createdAt), desc(queueEvents.id))
    .limit(limit);
}

function toPublicEvent(row: {
  id: number;
  createdAt: Date;
  action: string;
  queueMemberKey: string;
  queueMemberName: string;
  actorName: string | null;
  source: string | null;
  link: string | null;
  redirectedBy: string | null;
  hotelName: string | null;
  reason: string | null;
}): QueueEvent {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    action: row.action as QueueEvent['action'],
    queueMemberKey: row.queueMemberKey,
    queueMemberName: row.queueMemberName,
    actorName: row.actorName,
    source: row.source as QueueEvent['source'],
    link: row.link,
    redirectedBy: row.redirectedBy,
    hotelName: row.hotelName,
    reason: row.reason as QueueReason | null,
  };
}

function aggregateEvents(
  events: QueueEvent[],
  roster: Array<{ memberKey: string; name: string }>
): QueueSnapshot['metrics'] {
  const people = new Map<string, QueuePersonMetrics>(
    roster.map(({ memberKey, name }) => [
      memberKey,
      {
        memberKey,
        name,
        atendimentos: 0,
        kinbox: 0,
        redirecionamentos: 0,
        passadas: 0,
        motivos: { ausencia: 0, folga: 0, ferias: 0, vez_cedida: 0 },
      },
    ])
  );
  let atendimentos = 0;
  let passadas = 0;

  for (const event of events) {
    let person = people.get(event.queueMemberKey);
    if (!person) {
      person = {
        memberKey: event.queueMemberKey,
        name: event.queueMemberName,
        atendimentos: 0,
        kinbox: 0,
        redirecionamentos: 0,
        passadas: 0,
        motivos: { ausencia: 0, folga: 0, ferias: 0, vez_cedida: 0 },
      };
      people.set(event.queueMemberKey, person);
    }

    if (event.action === 'assumir') {
      atendimentos += 1;
      person.atendimentos += 1;
      if (event.source === 'kinbox') person.kinbox += 1;
      if (event.source === 'redirecionamento') person.redirecionamentos += 1;
    } else {
      passadas += 1;
      person.passadas += 1;
      if (event.reason) person.motivos[event.reason] += 1;
    }
  }

  return {
    atendimentos,
    passadas,
    pessoas: [...people.values()].sort(
      (a, b) => b.atendimentos - a.atendimentos || a.name.localeCompare(b.name, 'pt-BR')
    ),
    limit: METRICS_LIMIT,
    considered: events.length,
  };
}
