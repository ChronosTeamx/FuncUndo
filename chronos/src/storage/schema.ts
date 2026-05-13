
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const functionHistory = sqliteTable('function_history', {
    id: integer('id').primaryKey(),
    filePath: text('file_path').notNull(),
    functionName: text('function_name').notNull(),
});
export const snapshots = sqliteTable('snapshots', {
    id: integer('id').primaryKey(),
    functionHistoryId: integer('function_history_id').notNull().references(() => functionHistory.id),
    content: text('content').notNull(),
    hash: text('hash').notNull(),
    dependents: text('dependents').notNull(), // JSON stringified array of dependent function names
    dependencies: text('dependencies').notNull(), // JSON stringified array of dependency function names
    startLine: integer('start_line').notNull(),
    endLine: integer('end_line').notNull(),
    createdAt: integer('created_at').notNull()
});

export type FunctionRecord  = typeof functionHistory.$inferSelect;
export type NewFunction     = typeof functionHistory.$inferInsert;
export type SnapshotRecord  = typeof snapshots.$inferSelect;
export type NewSnapshot     = typeof snapshots.$inferInsert;