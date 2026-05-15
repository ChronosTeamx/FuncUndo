import * as vscode from 'vscode';
import { ParserWorkerManager } from './worker/workerManager';
import { initDB, persistDB, closeDB } from './storage/db';
 import { generateFileHash } from './worker/semanticHasher';


let workerManager: ParserWorkerManager | null = null;
let isDBReady = false;
let isProcessing = false;


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
  // _functionName: string,
  // _filePath: string
): Promise<{ hash: string; startLine: number; endLine: number } | null> {
  // Replace with your actual Read DAO / sql.js query
  // Example shape your DB query should return:
  // SELECT hash, start_line, end_line FROM functions
  // WHERE name = ? AND file_path = ?
  // ORDER BY saved_at DESC LIMIT 1
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
async function findByHash(
  _hash: string,
  _filePath: string
): Promise<{ name: string; startRow: number } | null> {
  // TODO: wire Read DAO
  // SELECT name, start_row FROM functions
  //   WHERE hash = ? AND file_path = ?
  //   ORDER BY saved_at DESC LIMIT 1
  return null;
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
  
   if (!workerManager || !isDBReady) {
    console.warn('[Orchestrator] Skipping — DB not ready yet');
    return;
  }

  // prevent race around condition if user saves rapidly mutiple times before processing finishes
  if (isProcessing) {
    console.warn('[Orchestrator] Skipping — already processing a save');
    return;
  }

  isProcessing = true;


  try {
    // POINT 26 — send to Track A Web Worker via IPC
    const result = await workerManager.parseDocument(filePath, fileText);
    console.log('[DEBUG] Parsed functions:', JSON.stringify(result.functions, null, 2));
    const parsedFunctions = result.functions;
  
    // uncomment it when we wwill get the getLastFileHAsh working in the the db 

//     const fileHash = generateFileHash(parsedFunctions.map(fn => fn.hash));
// const lastFileHash = await getLastFileHash(filePath);

// if (lastFileHash && fileHash === lastFileHash) {
//   console.log('[Orchestrator] File unchanged, skipping');
//   return;
// }
//

// console.log(`[Orchestrator] Parsed ${parsedFunctions.length} functions from ${filePath}`);

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

      if (
        existing.hash === fn.hash &&
        existing.startLine === fn.range.start.row
      ) {
        console.log(`[DiffCheck] No change: ${fn.name}`);
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

    for (const fn of parsedFunctions) {
      const possibleRename = await findByHash(fn.hash, filePath);

      if (
        possibleRename &&
        possibleRename.name !== fn.name &&
        possibleRename.startRow === fn.range.start.row  // same line = same function, just renamed
      ) {
        console.log(`[RenameHeuristic] Detected rename: ${possibleRename.name} → ${fn.name}`);
        await commitFunctionToDB({
          name: fn.name,
          filePath,
          hash: fn.hash,
          startLine: fn.range.start.row,
          endLine: fn.range.end.row,
          body: fn.rawText,
          //renamedFrom: possibleRename.name,  // ✅ track old name
        });
      }
    }

  } catch (err) {
    console.error('[Orchestrator] Failed:', err);
  } finally {
    // Always runs — even if worker or DB throws
    isProcessing = false;
    try {
      persistDB();
    } catch (err) {
      console.error('[Chronos] persistDB failed:', err);
    }
  }
}

// ─── POINT 24 + 25: Save Listener + Debouncer wired together ─────────────────
const debouncedOrchestrate = debounce(orchestrate, 2000);

export async function activate(context: vscode.ExtensionContext) {
  console.log('Chronos Extension booting...');

  workerManager = new ParserWorkerManager(context.extensionPath);
  await workerManager.init();

  // DEMO USAGE ONLY
  // try {
  //   console.log('[Main Thread] Dispatching test job to worker...');

  //   const result = await workerManager.parseDocument(
  //     '/mock/path/test.js',
  //     `
  //           function standardFunction() { return 1; }

  //           const arrowFunction = () => {
  //               return 2;
  //           };

  //           class MyClass {
  //               classMethod() { return 3; }
  //           }
  //           `,
  //   );

  //   console.log(
  //     `[Main Thread] Success! Found functions:`,
  //     result.functions.map((f) => f.name),
  //   );
  // } catch (error) {
  //   console.error('[Main Thread] Failed to parse document:', error);
  // }
  try {
    await initDB(context);
    isDBReady = true;
    console.log('[Chronos] DB initialized successfully');
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
    })
  );

  context.subscriptions.push({
    dispose: () => workerManager?.dispose(),
  });
}

export function deactivate() {
  closeDB();
  workerManager?.dispose();
}
