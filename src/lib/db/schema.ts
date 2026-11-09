import { bigserial, boolean, integer, pgTable, smallint, text, timestamp } from 'drizzle-orm/pg-core';

export const queueLock = pgTable('queue_lock', {
  id: smallint('id').primaryKey(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const queueMembers = pgTable('queue_members', {
  memberKey: text('member_key').primaryKey(),
  sourceUserId: integer('source_user_id'),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  isActive: boolean('is_active').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const queueEvents = pgTable('queue_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  action: text('action').notNull(),
  queueMemberKey: text('queue_member_key').notNull(),
  actorName: text('actor_name'),
  source: text('source'),
  link: text('link'),
  redirectedBy: text('redirected_by'),
  hotelName: text('hotel_name'),
  reason: text('reason'),
});
