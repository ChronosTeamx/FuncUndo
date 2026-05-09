import * as vscode from 'vscode';
import { Worker } from 'worker_threads';
import * as path from 'path';
import { WorkerParseRequest, WorkerMessage } from './lib/types';

export function activate(context: vscode.ExtensionContext) {
  vscode.window.showInformationMessage('Chronos activated!');

  console.log('Main Extension Host booting...');

  const workerPath = path.join(context.extensionPath, 'dist', 'worker', 'parser.worker.js');

  console.log('Worker path:', workerPath);

  // Spawn parser worker
  const parserWorker = new Worker(workerPath);

  // Listen for successful worker responses
  parserWorker.on('message', (message: WorkerMessage) => {
    if (message.type === 'PARSE_SUCCESS') {
      console.log(`[Main Thread] Successfully received mapped AST data for Job: ${message.jobId}`);

      vscode.window.showInformationMessage('Worker IPC handshake successful!');
    }
  });

  parserWorker.on('error', (err) => {
    console.error('[Main Thread] Background Worker crashed:', err);

    vscode.window.showErrorMessage(`Worker crashed: ${String(err)}`);
  });
  // Parse whenever an editor becomes active
  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (!editor) {
      return;
    }

    const document = editor.document;

    const parseRequest: WorkerParseRequest = {
      type: 'PARSE_REQUEST',
      jobId: `job-${Date.now()}`,
      filePath: document.uri.fsPath,
      fileContent: document.getText(),
    };

    console.log(`[Main Thread] Sending parse request for: ${document.fileName}`);

    parserWorker.postMessage(parseRequest);
  });
}

export function deactivate() {}
