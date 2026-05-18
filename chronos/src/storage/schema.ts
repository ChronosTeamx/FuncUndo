import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const functionHistory = sqliteTable('function_history', {
  id: text('id').primaryKey(),
  filePath: text('filePath').notNull(),
  functionName: text('functionName').notNull(),
  parentId: text('parentId'),
  parentName: text('parentName'),
});
export const snapshots = sqliteTable('snapshots', {
  id: text('id').primaryKey(),
  functionHistoryId: text('functionHistoryId')
    .notNull()
    .references(() => functionHistory.id),
  content: text('content').notNull(),
  hash: text('hash').notNull(),
  startLine: integer('startLine').notNull(),
  endLine: integer('endLine').notNull(),
  createdAt: integer('createdAt').notNull(),
});

export const dependencies = sqliteTable('dependencies', {
  id: text('id').primaryKey(),
  snapshotId: text('snapshotId')
    .notNull()
    .references(() => snapshots.id),
  dependencyId: text('dependencyId')
    .notNull()
    .references(() => functionHistory.id),
  type: text('type', {
    enum: ['calls', 'calledBy'],
  }).notNull(),
});

export const pointers = sqliteTable('pointers', {
  functionHistoryId: text('function_history_id')
    .primaryKey()
    .references(() => functionHistory.id),
  currentSnapshotId: text('current_snapshot_id')
    .notNull()
    .references(() => snapshots.id),
});

export type FunctionRecord = typeof functionHistory.$inferSelect;
export type NewFunction = typeof functionHistory.$inferInsert;
export type SnapshotRecord = typeof snapshots.$inferSelect;
export type NewSnapshot = typeof snapshots.$inferInsert;
export type DependencyRecord = typeof dependencies.$inferSelect;
export type NewDependency = typeof dependencies.$inferInsert;
export type PointerRecord = typeof pointers.$inferSelect;
export type NewPointer    = typeof pointers.$inferInsert;
