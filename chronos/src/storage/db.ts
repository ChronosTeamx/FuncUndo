import initSqlJs, { Database } from 'sql.js';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { drizzle } from 'drizzle-orm/sql-js';
import * as schema from './schema';

let sqlJsDb : Database | null = null; // this will hold the in-memory database instance once initialized
let dbPath : string | null = null; // this will hold the path to the SQLite database file in the extension's storage directory
export let db :ReturnType<typeof drizzle<typeof schema>>; // this will hold the Drizzle ORM instance once initialized, allowing us to interact with the database using Drizzle's API

export async function initDB (context: vscode.ExtensionContext): Promise<void> {
    console.log('[FuncUndo] storageUri:', context.storageUri);
    console.log('[FuncUndo] workspaceFolders:', vscode.workspace.workspaceFolders);

    
    const SQL = await initSqlJs(
        {
            locateFile: file=>path.join(__dirname,file)  //this should point to dist/sql-wasm.wasm 
        }
    );
    if (!context.storageUri) {
        throw new Error("FuncUndo requires an open workspace");
    }

    const storageDir = context.storageUri?.fsPath;
    if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
    }
    dbPath = path.join(storageDir, 'funcundo.sqlite'); // this is the path to the SQLite database file in the extension's storage directory
    if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        sqlJsDb = new SQL.Database(fileBuffer);
        console.log("[FuncUndo] Existing DB loaded from disk");
    } else {
        sqlJsDb = new SQL.Database();
        console.log("[FuncUndo] New in-memory DB initialized");
    }    

    db = drizzle(sqlJsDb, { schema }); // this initializes the Drizzle ORM instance using the in-memory SQL.js database and our defined schema, allowing us to interact with the database using Drizzle's API
    console.log('[FuncUndo] Drizzle ORM ready');

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

  const data = sqlJsDb.export();           // this is in-memory as unit8aArray, no persistence until we write it to disk
  fs.writeFileSync(dbPath, Buffer.from(data)); // this writes the in-memory database to disk, making it persistent across sessions
  console.log('[FuncUndo] DB persisted to disk');
}

// this closes the database connection, freeing up resources
export function closeDB(): void {
  if (sqlJsDb) {
    sqlJsDb.close();
    sqlJsDb = null;
    dbPath = null;
    console.log('[FuncUndo] DB closed');
  }
}