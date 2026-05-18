import * as vscode from 'vscode';
import { ParserWorkerManager } from './worker/workerManager';
import { initDB, persistDB, closeDB } from './storage/db';
import { saveAllFunctionsSnapshots, parsedFunction } from './storage/snapshots';
import { getTimelineForFile } from './storage/reads';
import { getAllFunctionsInFile } from './storage/functions';
import { generateFileHash } from './worker/semanticHasher';

let workerManager: ParserWorkerManager | null = null;
let isDBReady = false;
let isProcessing = false;

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

async function orchestrate(filePath: string, fileText: string): Promise<void> {
  if (!workerManager || !isDBReady) {
    console.warn('[Orchestrator] Skipping — DB not ready yet');
    return;
  }

  if (isProcessing) {
    console.warn('[Orchestrator] Skipping — already processing a save');
    return;
  }

  isProcessing = true;

  try {
    const result = await workerManager.parseDocument(filePath, fileText);
    console.log('[DEBUG] Raw worker result:', JSON.stringify(result, null, 2));
    const parsedFunctions = result.functions;

    if (parsedFunctions.length === 0) {
      console.log('[Orchestrator] No functions found, skipping');
      return;
    }

    // File-level early exit — skip if nothing changed
    const currentFileHash = generateFileHash(parsedFunctions.map(fn => fn.hash));
    const knownFunctions = getAllFunctionsInFile(filePath);
    const timelineMap = getTimelineForFile(filePath);

    if (knownFunctions.length > 0) {
      const lastHashes = knownFunctions
        .map(fn => timelineMap.get(fn.id)?.[0]?.snapshot.hash)
        .filter((h): h is string => !!h);

      const lastFileHash = generateFileHash(lastHashes);

      if (currentFileHash === lastFileHash) {
        console.log('[Orchestrator] File unchanged, skipping');
        return;
      }
    }

    // Build lookup: functionName → latest hash
    const latestHashMap = new Map<string, string>();
    for (const fn of knownFunctions) {
      const timeline = timelineMap.get(fn.id);
      if (timeline && timeline.length > 0) {
        latestHashMap.set(fn.functionName, timeline[0].snapshot.hash);
      }
    }

    // Diff check — filter only changed/new functions
    const functionsToSave: parsedFunction[] = [];

    for (const fn of parsedFunctions) {
      const lastHash = latestHashMap.get(fn.name);

      if (lastHash === fn.hash) {
        console.log(`[DiffCheck] No change: ${fn.name}`);
        continue;
      }

      // Rename detection — same hash, same row, different name
      let renamedFrom: string | undefined;
      for (const known of knownFunctions) {
        const timeline = timelineMap.get(known.id);
        if (!timeline || timeline.length === 0) continue;

        const latest = timeline[0].snapshot;
        if (
          latest.hash === fn.hash &&
          known.functionName !== fn.name &&
          latest.startLine === fn.range.start.row
        ) {
          renamedFrom = known.functionName;
          console.log(`[RenameHeuristic] ${renamedFrom} → ${fn.name}`);
          break;
        }
      }

      functionsToSave.push({
        filePath,
        functionName: fn.name,
        parentName: 'GLOBAL', //need to implement parent tracking in parser to fill this correctly 
        parentId: 'GLOBAL',  //need to implement parent tracking in parser to fill this correctly 
        content: fn.rawText,
        hash: fn.hash,
        dependencies: [],
        startLine: fn.range.start.row,
        endLine: fn.range.end.row,
      });

      console.log(
        renamedFrom
          ? `[Orchestrator] Queued rename: ${renamedFrom} → ${fn.name}`
          : `[Orchestrator] Queued: ${fn.name} (${lastHash ? 'changed' : 'new'})`
      );
    }

    if (functionsToSave.length > 0) {
      saveAllFunctionsSnapshots(functionsToSave);
      console.log(`[Orchestrator] Saved ${functionsToSave.length} function(s)`);
    } else {
      console.log('[Orchestrator] Nothing changed, no saves needed');
    }

  } catch (err) {
    console.error('[Orchestrator] Failed:', err);
  } finally {
    isProcessing = false;
    try {
      persistDB();
    } catch (err) {
      console.error('[Chronos] persistDB failed:', err);
    }
  }
}

const debouncedOrchestrate = debounce(orchestrate, 2000);

export async function activate(context: vscode.ExtensionContext) {
  console.log('Chronos Extension booting...');

  workerManager = new ParserWorkerManager(context.extensionPath);
  await workerManager.init();

  try {
    await initDB(context);
    isDBReady = true;
    console.log('[Chronos] DB init complete');
  } catch (err) {
    console.error('[Chronos] DB init failed:', err);
  }

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
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