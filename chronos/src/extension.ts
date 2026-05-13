// import * as vscode from 'vscode';
// import { ParserWorkerManager } from './worker/workerManager';
// import { initDB, persistDB, closeDB } from './storage/db';
// //import the ParserWorkerManager class from the workerManager module

// //DEMO FOR JATIN BHAI
// //IMPORTANT METHODS :
// /**
//  *
//  * init()
//  * Purpose:
//  * - Initializes the parser worker and waits for readiness.
//  *
//  * Usage:
//  * - Call once during extension activation.
//  *
//  * Example:
//  * await workerManager.init();
//  *
//  * --------------------------------------------------
//  *
//  * parseDocument(filePath, fileContent)
//  * Purpose:
//  * - Sends a document to the worker for async parsing.
//  *
//  * Usage:
//  * - Call whenever a file needs to be parsed.
//  *
//  * Example:
//  * const result =
//  *   await workerManager.parseDocument(
//  *     document.uri.fsPath,
//  *     document.getText()
//  *   );
//  *
//  * --------------------------------------------------
//  *
//  * dispose()
//  * Purpose:
//  * - Cleans up worker resources and terminates the worker.
//  *
//  * Usage:
//  * - Register with VS Code subscriptions.
//  *
//  * Example:
//  * context.subscriptions.push(workerManager);
//  */

// let workerManager: ParserWorkerManager | null = null;
// //only one instance should be used throughout the extension, so we keep it at the extension level

// export async function activate(
//   context: vscode.ExtensionContext,
//   //Extension context is provided by Vscode and contains things like the extension path, subscriptions for disposables, etc
// ) {
//   console.log('Chronos Extension booting...');

//   workerManager = new ParserWorkerManager(context.extensionPath);
//   //Creation of the worker manager object, which will handle all interactions with the parser worker. We pass the extension path so it can locate the worker script and WASM files.

//   await workerManager.init();

//   try {
//     await initDB(context);
//     console.log('[FuncUndo] DB init complete');
//   } catch (err) {
//     console.error('[FuncUndo] DB init failed:', err);
//   }


//   vscode.workspace.onDidSaveTextDocument(() => {
//     try {
//       persistDB();
//     } catch (err) {
//       console.error('[FuncUndo] persistDB failed:', err);
//     }
//   });

//   // DEMO USAGE ONLY
//   try {
//     console.log('[Main Thread] Dispatching test job to worker...');

//     const result = await workerManager.parseDocument(
//       '/mock/path/test.js',
//       `
//             function standardFunction() { return 1; }
            
//             const arrowFunction = () => { 
//                 return 2; 
//             };

//             class MyClass {
//                 classMethod() { return 3; }
//             }
//             `,
//     );

//     console.log(
//       `[Main Thread] Success! Found functions:`,
//       result.functions.map((f) => f.name),
//     );
//   } catch (error) {
//     console.error('[Main Thread] Failed to parse document:', error);
//   }

//   // Clean shutdown
//   context.subscriptions.push({
//     dispose: () => workerManager?.dispose(),
//   });
// }

// export function deactivate() {
//   closeDB();
//   workerManager?.dispose();
// }
import * as vscode from 'vscode';
import { ParserWorkerManager } from './worker/workerManager';
import { initDB, persistDB, closeDB } from './storage/db';

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
async function getLatestFunctionHash(
  functionName: string,
  filePath: string
): Promise<{ hash: string; startLine: number; endLine: number } | null> {
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
  // Replace with your actual Write DAO
  // INSERT INTO functions (name, file_path, hash, start_line, end_line, body, saved_at)
  // VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  console.log(`[CommitEngine] Saving new version of: ${fn.name}`);
}

// ─── POINT 29: Rename Heuristics ─────────────────────────────────────────────
async function markAsRename(
  oldName: string,
  newName: string,
  filePath: string
): Promise<void> {
  // Replace with your Write DAO for renames
  // UPDATE functions SET renamed_to = ?, renamed_at = datetime('now')
  //   WHERE name = ? AND file_path = ?
  console.log(`[RenameHeuristic] Renamed: ${oldName} → ${newName}`);
}

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
      const existing = await getLatestFunctionHash(fn.name, filePath);

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
    for (const fn of parsedFunctions) {
      // You'd query: SELECT name FROM functions WHERE file_path = ?
      //   AND hash = ? AND name != ? ORDER BY saved_at DESC LIMIT 1
      // If a row is found → it was renamed
      // await markAsRename(oldName, fn.name, filePath);
    }

    persistDB();
  } catch (err) {
    console.error('[Orchestrator] Failed:', err);
  }
}

// ─── POINT 24 + 25: Save Listener + Debouncer wired together ─────────────────
const debouncedOrchestrate = debounce(orchestrate, 1500);

export async function activate(context: vscode.ExtensionContext) {
  console.log('Chronos Extension booting...');

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
      const supported = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
      if (!supported.includes(document.languageId)) return;

      debouncedOrchestrate(document.uri.fsPath, document.getText());
    })
  );

  context.subscriptions.push({
    dispose: () => workerManager?.dispose(),
  });
}

export function deactivate() {
  workerManager?.dispose();
}