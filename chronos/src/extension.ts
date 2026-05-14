import * as vscode from 'vscode';
import { ParserWorkerManager } from './worker/workerManager';
//import the ParserWorkerManager class from the workerManager module

//DEMO FOR JATIN BHAI
//IMPORTANT METHODS :
/**
 *
 * init()
 * Purpose:
 * - Initializes the parser worker and waits for readiness.
 *
 * Usage:
 * - Call once during extension activation.
 *
 * Example:
 * await workerManager.init();
 *
 * --------------------------------------------------
 *
 * parseDocument(filePath, fileContent)
 * Purpose:
 * - Sends a document to the worker for async parsing.
 *
 * Usage:
 * - Call whenever a file needs to be parsed.
 *
 * Example:
 * const result =
 *   await workerManager.parseDocument(
 *     document.uri.fsPath,
 *     document.getText()
 *   );
 *
 * --------------------------------------------------
 *
 * dispose()
 * Purpose:
 * - Cleans up worker resources and terminates the worker.
 *
 * Usage:
 * - Register with VS Code subscriptions.
 *
 * Example:
 * context.subscriptions.push(workerManager);
 */

let workerManager: ParserWorkerManager | null = null;
//only one instance should be used throughout the extension, so we keep it at the extension level

export async function activate(
  context: vscode.ExtensionContext,
  //Extension context is provided by Vscode and contains things like the extension path, subscriptions for disposables, etc
) {
  console.log('Chronos Extension booting...');

  workerManager = new ParserWorkerManager(context.extensionPath);
  //Creation of the worker manager object, which will handle all interactions with the parser worker. We pass the extension path so it can locate the worker script and WASM files.

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

  // Clean shutdown
  context.subscriptions.push({
    dispose: () => workerManager?.dispose(),
  });
}

export function deactivate() {
  workerManager?.dispose();
}
