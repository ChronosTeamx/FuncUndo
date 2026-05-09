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

  // Test payload
  const testPayload: WorkerParseRequest = {
    type: 'PARSE_REQUEST',
    jobId: 'boot-test-001',
    filePath: '/mock/path/test.js',
    fileContent: 'function hello() { return true; }',
  };

  // Give worker time to boot parser
  setTimeout(() => {
    console.log('Sending test parse request...');
    parserWorker.postMessage(testPayload);
  }, 1000);
}

export function deactivate() {}
