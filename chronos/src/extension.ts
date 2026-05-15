import * as vscode from 'vscode';
import { ParserWorkerManager } from './worker/workerManager';
import { initDB, persistDB, closeDB } from './storage/db';
import { HistoryViewProvider } from './providers/HistoryViewProvider';

let workerManager: ParserWorkerManager | null = null;

// ─── POINT 25: Debouncer ─────────────────────────────────────────────────────
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

// ─── POINT 27: Diff Check — query sql.js for latest known hash ───────────────
async function getLatestFunctionHash(): Promise<{
// _functionName: string,
// _filePath: string
  hash: string;
  startLine: number;
  endLine: number;
} | null> {
  // Replace with your actual Read DAO / sql.js query
  // Example shape your DB query should return:
  // SELECT hash, start_line, end_line FROM functions
  //   WHERE name = ? AND file_path = ?
  //   ORDER BY saved_at DESC LIMIT 1
  return null; // wire your Read DAO here
}

// ─── POINT 28: Commit Engine — Write DAO ─────────────────────────────────────
async function commitFunctionToDB(fn: {
  name: string;
  filePath: string;
  hash: string;
  startLine: number;
  endLine: number;
  body: string;
}): Promise<void> {
  console.log(`[CommitEngine] Saving new version of: ${fn.name}`);
}
// ─── POINT 29: Rename Heuristics ─────────────────────────────────────────────
// async function markAsRename(
//   _oldName: string,
//   _newName: string,
//   _filePath: string
// ): Promise<void> {
//   // Replace with your Write DAO for renames
//   // UPDATE functions SET renamed_to = ?, renamed_at = datetime('now')
//   //   WHERE name = ? AND file_path = ?
//   console.log(`[RenameHeuristic] Renamed: ${_oldName} → ${_newName}`);
// }
// TODO Point 29: markAsRename(oldName, newName, filePath) — wire when Write DAO is ready
// ─── POINT 26 + 27 + 28 + 29: Orchestrator ───────────────────────────────────
async function orchestrate(filePath: string, fileText: string): Promise<void> {
  if (!workerManager) return;

  try {
    // POINT 26 — send to Track A Web Worker via IPC
    const result = await workerManager.parseDocument(filePath, fileText);
    console.log('[DEBUG] Parsed functions:', JSON.stringify(result.functions, null, 2));
    const parsedFunctions = result.functions;

    // POINT 27 — for each parsed function, diff check against DB
    for (const fn of parsedFunctions) {
      const existing = await getLatestFunctionHash();

      if (!existing) {
        // Brand new function — commit it
        await commitFunctionToDB({
          name: fn.name,
          filePath,
          hash: fn.hash,
          startLine: fn.range.start.row,
          endLine: fn.range.end.row,
          body: fn.rawText,
        });
        continue;
      }

      if (existing.hash === fn.hash) {
        // POINT 29 — same hash, check if it was just renamed
        // (same internal AST hash, same line numbers, but different name in DB?)
        // This is handled below in the rename sweep — skip here
        continue;
      }

      // POINT 28 — hash is new, commit the new version
      await commitFunctionToDB({
        name: fn.name,
        filePath,
        hash: fn.hash,
        startLine: fn.range.start.row,
        endLine: fn.range.end.row,
        body: fn.rawText,
      });
    }

    // POINT 29 — Rename sweep
    // Find functions in DB (for this file) whose hash matches a parsed fn
    // but whose name doesn't — that's a rename
    // for (const fn of parsedFunctions) {
    // You'd query: SELECT name FROM functions WHERE file_path = ?
    //   AND hash = ? AND name != ? ORDER BY saved_at DESC LIMIT 1
    // If a row is found → it was renamed
    // await markAsRename(_oldName, fn.name, _filePath);
    // }

    persistDB();
  } catch (err) {
    console.error('[Orchestrator] Failed:', err);
  }
}

// ─── POINT 24 + 25: Save Listener + Debouncer wired together ─────────────────
const debouncedOrchestrate = debounce(orchestrate, 1500);

export async function activate(context: vscode.ExtensionContext) {
  console.log('Chronos Extension booting...');

  const historyProvider = new HistoryViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('chronos.historyView', historyProvider),
  );

  workerManager = new ParserWorkerManager(context.extensionPath);
  await workerManager.init();

  try {
    await initDB(context);
    console.log('[Chronos] DB init complete');
  } catch (err) {
    console.error('[Chronos] DB init failed:', err);
  }

  // POINT 24 — Save Listener (JS/TS only)
  // POINT 25 — wrapped in 1.5s debounce
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      console.log('[DEBUG] Save detected:', document.fileName, document.languageId);

      const supported = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
      if (!supported.includes(document.languageId)) return;

      debouncedOrchestrate(document.uri.fsPath, document.getText());
    }),
  );

  context.subscriptions.push({
    dispose: () => workerManager?.dispose(),
  });
}

export function deactivate() {
  closeDB();
  workerManager?.dispose();
}
