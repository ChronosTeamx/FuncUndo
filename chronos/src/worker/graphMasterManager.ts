// src/worker/graphMasterManager.ts
import { Worker } from 'worker_threads';
import * as path from 'path';

export class GraphMasterManager {
  private worker: Worker | null = null;

  constructor(private extensionPath: string) {}

  public init(): void {
    const workerPath = path.join(this.extensionPath, 'dist', 'worker', 'graphMaster.worker.js');
    this.worker = new Worker(workerPath);

    this.worker.on('error', (err) => console.error('[GraphMasterManager] Fatal error:', err));
  }

  public on(event: string, listener: (...args: any[]) => void): void {
    this.worker?.on(event, listener);
  }

  public postMessage(message: any): void {
    this.worker?.postMessage(message);
  }
}
