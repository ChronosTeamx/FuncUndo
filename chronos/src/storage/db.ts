import initSqlJs, { Database } from 'sql.js';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { drizzle } from 'drizzle-orm/sql-js';
import * as schema from './schema';

let sqlJsDb: Database | null = null; // this will hold the in-memory database instance once initialized
let dbPath: string | null = null; // this will hold the path to the SQLite database file in the extension's storage directory
export let db: ReturnType<typeof drizzle<typeof schema>>; // this will hold the Drizzle ORM instance once initialized, allowing us to interact with the database using Drizzle's API

export async function initDB(context: vscode.ExtensionContext): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, file), //this should point to dist/sql-wasm.wasm
  });
  if (!context.storageUri) {
    throw new Error('FuncUndo requires an open workspace');
  }

  const storageDir = context.storageUri?.fsPath;
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  dbPath = path.join(storageDir, 'funcundo.sqlite'); // this is the path to the SQLite database file in the extension's storage directory
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    sqlJsDb = new SQL.Database(fileBuffer);
    console.log('[FuncUndo] Existing DB loaded from disk');
  } else {
    sqlJsDb = new SQL.Database();
    console.log('[FuncUndo] New in-memory DB initialized');
  }
  sqlJsDb.run('PRAGMA foreign_keys = ON;');

  db = drizzle(sqlJsDb, { schema }); // this initializes the Drizzle ORM instance using the in-memory SQL.js database and our defined schema, allowing us to interact with the database using Drizzle's API

  runMigrations();
  console.log('[FuncUndo] Drizzle ORM ready');
}
function runMigrations(): void {
  if (!sqlJsDb) return;

  const result = sqlJsDb.exec('PRAGMA user_version');
  const currentVersion = (result[0]?.values[0]?.[0] as number) ?? 0;
  console.log(`[FuncUndo] Schema version: ${currentVersion}`);

  try {
    sqlJsDb.run('BEGIN TRANSACTION');

    if (currentVersion < 1) migrateV1();

    sqlJsDb.run('COMMIT');
  } catch (err) {
    sqlJsDb.run('ROLLBACK');
    console.error('[FuncUndo] Migration failed:', err);
    throw err;
  }
}

function migrateV1(): void {
  if (!sqlJsDb) return;
  sqlJsDb.run(`
    CREATE TABLE IF NOT EXISTS function_history (
      id            TEXT PRIMARY KEY,
      filePath     TEXT NOT NULL,
      functionName TEXT NOT NULL,
      parentId     TEXT NOT NULL DEFAULT 'GLOBAL',
      parentName   TEXT NOT NULL DEFAULT 'GLOBAL',
      UNIQUE(filePath, functionName, parentId, parentName)
    );
    CREATE TABLE IF NOT EXISTS snapshots (
      id                  TEXT PRIMARY KEY,
      functionHistoryId   TEXT NOT NULL REFERENCES function_history(id),
      content             TEXT NOT NULL,
      hash                TEXT NOT NULL,
      startLine          INTEGER NOT NULL,
      endLine            INTEGER NOT NULL,
      createdAt          INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dependencies (
      id              TEXT PRIMARY KEY,
      snapshotId     TEXT NOT NULL REFERENCES snapshots(id),
      dependencyId    TEXT NOT NULL REFERENCES function_history(id),
      type            TEXT NOT NULL CHECK(type IN ('calls', 'calledBy'))
    );

    CREATE TABLE IF NOT EXISTS pointers (
  function_history_id TEXT PRIMARY KEY REFERENCES function_history(id),
  current_snapshot_id TEXT NOT NULL    REFERENCES snapshots(id)
);

    CREATE INDEX IF NOT EXISTS idx_snapshots_fn
      ON snapshots(functionHistoryId, createdAt);

    CREATE INDEX IF NOT EXISTS idx_dependencies_snapshot
      ON dependencies(snapshotId);

    CREATE INDEX IF NOT EXISTS idx_function_history_filepath
      ON function_history(filePath);  
  `);

  sqlJsDb!.run('PRAGMA user_version = 1');
  console.log('[FuncUndo] Migration to v1 completed');
}

// this loads the database from disk and returns the Database instance
export function getDB(): Database {
  if (!sqlJsDb) {
    throw new Error('[FuncUndo] DB not initialized — call initDB first');
  }
  return sqlJsDb;
}

// this saves the in-memory database to disk, making it persistent across sessions
export function persistDB(): void {
  if (!sqlJsDb || !dbPath) {
    throw new Error('[FuncUndo] DB not initialized — call initDB first');
  }

  const data = sqlJsDb.export(); // this is in-memory as unit8aArray, no persistence until we write it to disk
  // fs.writeFileSync(dbPath, Buffer.from(data)); // this writes the in-memory database to disk, making it persistent across sessions
   const tempPath = `${dbPath}.tmp`;

  try {
    fs.writeFileSync(tempPath, Buffer.from(data));
    fs.renameSync(tempPath, dbPath);
    console.log('[FuncUndo] DB persisted to disk');
  } catch (err) {
    // Clean up temp file if something went wrong
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw err;
  }
}

// this closes the database connection, freeing up resources
export function closeDB(): void {
  if (sqlJsDb) {
    persistDB(); // ensure we save any changes before closing
    sqlJsDb.close();
    sqlJsDb = null;
    dbPath = null;
    console.log('[FuncUndo] DB closed');
  }
}
