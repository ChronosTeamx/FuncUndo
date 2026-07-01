import { parentPort } from 'worker_threads';
import Parser from 'web-tree-sitter';
import * as path from 'path';
import { WorkerMessage, WorkerParseSuccess } from '../lib/types';
import { extractFunctions } from './astTraverser';
import { generateFileHash } from './semanticHasher';
import { resolveExports } from './exportResolver';
import { extractImports } from './importExtractor';

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

    // tell main thread worker is ready
    parentPort?.postMessage({
      type: 'WORKER_READY',
    });
  } catch (error) {
    console.error('[Worker] Fatal Error booting WASM engine:', error);
  }
}

// Start the boot sequence immediately
bootParser();

// Listen for messages from the Main Thread
parentPort.on('message', async (message: WorkerMessage) => {
  if (message.type === 'PARSE_REQUEST') {
    const startTime = Date.now();
    if (!parser) {
      parentPort?.postMessage({
        type: 'PARSE_ERROR',
        jobId: message.jobId,
        filePath: message.filePath,
        errorMessage: 'WASM Parser engine is not fully booted yet.',
      });
      return;
    }

    try {
      const tree = parser.parse(message.fileContent);
      const rootNode = tree.rootNode;

      const resolvedImports = extractImports(rootNode);

      // 12: Walk the `rootNode` to find specific functions.
      const functions = extractFunctions(rootNode, resolvedImports);

      const { proxyExports, wildcardExports } = resolveExports(rootNode, functions);

      // Generate the Master File Hash by pulling the individual hashes we just created
      const functionHashes = functions.map((f) => f.hash);
      const masterFileHash = generateFileHash(functionHashes);

      console.log(
        `[Worker] Parsed ${message.filePath} and extracted ${functions.length} functions in ${Date.now() - startTime}ms`,
      );

      const successPayload: WorkerParseSuccess = {
        type: 'PARSE_SUCCESS',
        jobId: message.jobId,
        filePath: message.filePath,
        functions: functions,
        fileHash: masterFileHash,
        proxyExports: proxyExports,
        wildcardExports: wildcardExports,
        edges: [],
        imports: resolvedImports,
        processingTimeMs: Date.now() - startTime,
      };

      parentPort?.postMessage(successPayload);

      tree.delete();
    } catch (error: any) {
      // THE STRUCTURED CLONE FIX ---
      // Manually extract properties because the IPC bridge strips Error prototypes
      const errorMessage = error instanceof Error ? error.message : 'Unknown parsing error';
      const errorStack = error instanceof Error ? error.stack : '';

      console.error(`[Worker] Failed to parse ${message.filePath}:`, errorMessage);

      // Send the flattened plain JSON object
      parentPort?.postMessage({
        type: 'PARSE_ERROR',
        jobId: message.jobId,
        filePath: message.filePath,
        errorMessage: errorMessage,
        errorStack: errorStack,
      });
    }
  }
});
