import { WorkerParseSuccess } from '../lib/types';
import { normalizeOSPath } from '../utils/pathNormalizer';

export class GlobalSymbolRegistry {
  private registry = new Map<string, WorkerParseSuccess>();

  public ingestPayload(payload: WorkerParseSuccess): void {
    const normalizedURI = normalizeOSPath(payload.filePath);
    this.registry.set(normalizedURI, payload);
  }

  public static generateUUID(normalizedURI: string, functionName: string): string {
    return `${normalizedURI}::${functionName}`;
  }

  //resolves foreign and local names conflict of exports
  // we check if a function with foreing nname exists in the file, if yes we return the local name, if not we return null
  public resolveExport(targetURI: string, foreignName: string): string | null {
    const normalizedURI = normalizeOSPath(targetURI);
    const fileRecord = this.registry.get(normalizedURI);

    if (!fileRecord) return null;

    const targetFunction = fileRecord.functions.find(
      (f) => f.exportedAs === foreignName || f.name === foreignName,
    );

    if (targetFunction) {
      return targetFunction.name;
    }

    return null;
  }

  // DEV TOOL
  public getRegistrySize(): number {
    return this.registry.size;
  }
}
