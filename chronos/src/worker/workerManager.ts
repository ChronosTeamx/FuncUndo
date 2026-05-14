import { Worker } from 'worker_threads';
import * as path from 'path';
import * as crypto from 'crypto';
import { WorkerMessage, WorkerParseRequest, WorkerParseSuccess } from '../lib/types';

export class ParserWorkerManager {
  private worker: Worker | null = null;

  private consecutiveRestarts = 0;
  private readonly MAX_RESTARTS = 3;
  private jobRegistry = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason?: any) => void;
    }
  >();

  constructor(private extensionPath: string) {}

  public async init(): Promise<void> {
    const workerPath = path.join(this.extensionPath, 'dist', 'worker', 'parser.worker.js');

    this.worker = new Worker(workerPath);

    return new Promise((resolve, reject) => {
      this.worker!.on('message', (message: WorkerMessage) => {
        // worker boot complete
        if (message.type === 'WORKER_READY') {
          console.log('[WorkerManager] Worker ready.');
          // --- NEW: Reset the circuit breaker because it booted successfully! ---
          this.consecutiveRestarts = 0;

          resolve();
          return;
        }

        // parse responses
        if (message.type === 'PARSE_SUCCESS' || message.type === 'PARSE_ERROR') {
          const pendingJob = this.jobRegistry.get(message.jobId);

          if (pendingJob) {
            if (message.type === 'PARSE_SUCCESS') {
              pendingJob.resolve(message);
            } else {
              pendingJob.reject(new Error(message.errorMessage));
            }

            this.jobRegistry.delete(message.jobId);
          }
        }
      });

      this.worker!.on('error', (err) => {
        console.error('[WorkerManager] Fatal worker error:', err);
        reject(err);
      });

      //RESURRECTION SUPPORT ( to spin up a new worker if the current dies)
      this.worker!.on('exit', (code) => {
        console.warn(
          `[WorkerManager] ⚠️ Worker thread died (Code: ${code}). Initiating resurrection...`,
        );

        // 1. Prevent infinite hangs: Reject any jobs that were waiting when it crashed
        for (const [, job] of this.jobRegistry.entries()) {
          job.reject(new Error('Worker thread crashed during execution.'));
        }
        this.jobRegistry.clear(); // Wipe the registry clean

        // 2. Clear the dead thread
        this.worker = null;

        this.consecutiveRestarts++;

        if (this.consecutiveRestarts > this.MAX_RESTARTS) {
          console.error(
            `[WorkerManager] 🚨 CIRCUIT BREAKER TRIPPED. Worker failed ${this.MAX_RESTARTS} times. Halting resurrections.`,
          );
          // We DO NOT call this.init() again. The system stays dead.
          // Friend 2 could later catch this state and show a vscode.window.showErrorMessage to the user.
          return;
        }

        // 3. Reboot a fresh instance immediately
        this.init().catch((err) => console.error('[WorkerManager] ❌ Failed to resurrect:', err));
      });
    });
  }

  public async parseDocument(filePath: string, fileContent: string): Promise<WorkerParseSuccess> {
    if (!this.worker) {
      throw new Error('ParserWorkerManager has not been initialized.');
    }

    const jobId = crypto.randomUUID();

    const request: WorkerParseRequest = {
      type: 'PARSE_REQUEST',
      jobId,
      filePath,
      fileContent,
    };

    return new Promise((resolve, reject) => {
      this.jobRegistry.set(jobId, {
        resolve,
        reject,
      });

      this.worker!.postMessage(request);
    });
  }

  public dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * DANGER: Only use this for testing the resurrection protocol.
   * Physically murders the background thread.
   */
  public forceKillForTesting() {
    if (this.worker) {
      this.worker.terminate();
    }
  }
}
