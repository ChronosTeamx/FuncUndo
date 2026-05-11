import { Worker } from 'worker_threads';
import * as path from 'path';
import * as crypto from 'crypto';
import { WorkerMessage, WorkerParseRequest, WorkerParseSuccess } from '../lib/types';

export class ParserWorkerManager {
  private worker: Worker | null = null;

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
        reject(err);
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
}
