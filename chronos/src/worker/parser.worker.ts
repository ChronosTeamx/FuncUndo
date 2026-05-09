import { parentPort } from 'worker_threads';
import Parser from 'web-tree-sitter';
import * as path from 'path';
import { WorkerMessage, WorkerParseSuccess } from '../lib/types';

// Safety check: Ensure this file is only run as a Worker thread
if (!parentPort) {
  throw new Error('Fatal: parser.worker.ts must be run as a Node.js Worker thread.');
}

let parser: Parser | null = null;

async function bootParser() {
  try {
    const runtimeWasmPath = path.join(__dirname, '..', 'wasm', 'tree-sitter.wasm');

    await Parser.init({
      locateFile() {
        return runtimeWasmPath;
      },
    });
    parser = new Parser();

    // Calculate the path to the dist/wasm folder based on the worker's compiled location
    // The worker will live in dist/worker/, so we go up one level to dist, then into wasm
    const wasmPath = path.join(__dirname, '..', 'wasm', 'tree-sitter-javascript.wasm');

    const JavaScript = await Parser.Language.load(wasmPath);
    parser.setLanguage(JavaScript);

    console.log('[Worker] WASM Engine booted and JavaScript grammar loaded.');
  } catch (error) {
    console.error('[Worker] Fatal Error booting WASM engine:', error);
  }
}

// Start the boot sequence immediately
bootParser();

// Listen for messages from the Main Thread
parentPort.on('message', async (message: WorkerMessage) => {
  if (message.type === 'PARSE_REQUEST') {
    console.log(`[Worker] Received job: ${message.jobId} for ${message.filePath}`);

    if (!parser) {
      console.error('[Worker] Parser is not ready yet!');
      return;
    }

    // TODO in Assignment 11:
    // Actually parse message.fileContent here.

    // Mock success response for IPC verification
    const mockSuccess: WorkerParseSuccess = {
      type: 'PARSE_SUCCESS',
      jobId: message.jobId,
      filePath: message.filePath,
      functions: [],
      edges: [],
      processingTimeMs: 12,
    };

    parentPort?.postMessage(mockSuccess);
  }
});
