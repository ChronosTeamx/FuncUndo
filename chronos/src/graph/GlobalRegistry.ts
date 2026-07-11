import { ImportedSymbol, ParsedFunction, WorkerParseSuccess } from '../lib/types';
import { normalizeOSPath } from '../utils/pathNormalizer';
import { resolveAbsoluteURI } from '../utils/uriResolver';

//SEE THE COMMENTED BLOCK BELOW FOR A SAMPLE IMPLEMENTATION OF THE GRAPH BUILDING LOGIC
//BUT SINCE THIS IS TECHNICALLY PART OF YOUR ASSIGMENT
// I AM LEAVING IT TO YOU GUYS
//AFTER IMPLEMENRTING THE GRAPH BUILDING LOGIC, YOU CAN UNCOMMENT THE FUNCTION AND USE IT IN THE WORKER THREAD

export interface OptimizedFileRecord {
  fileURI: string;
  localFunctionMap: Map<string, ParsedFunction>; // Key: local function name
  importMap: Map<string, ImportedSymbol>; // Key: local alias name
}

export interface GraphNode {
  outboundEdges: Set<string>;
  inboundEdges: Set<string>;
}

export class GlobalSymbolRegistry {
  // 1. The Raw Data Store
  private fileRegistry = new Map<string, OptimizedFileRecord>();

  // 2. The Bidirectional Relational Graph
  private directedGraph = new Map<string, GraphNode>();

  private validWorkspaceFiles = new Set<string>();
  private aliases: Record<string, string> = {};

  public ingestPayload(payload: WorkerParseSuccess): void {
    const normalizedURI = normalizeOSPath(payload.filePath);

    const localFunctionMap = new Map<string, ParsedFunction>();
    for (const func of payload.functions) {
      localFunctionMap.set(func.name, func);
    }

    const importMap = new Map<string, ImportedSymbol>();
    for (const imp of payload.imports) {
      importMap.set(imp.localName, imp);
    }

    this.fileRegistry.set(normalizedURI, {
      fileURI: normalizedURI,
      localFunctionMap,
      importMap,
    });
  }

  public static generateUUID(normalizedURI: string, functionName: string): string {
    return `${normalizedURI}::${functionName}`;
  }

  //resolves foreign and local names conflict of exports
  // we check if a function with foreing nname exists in the file, if yes we return the local name, if not we return null
  public resolveExport(targetURI: string, foreignName: string): string | null {
    const normalizedURI = normalizeOSPath(targetURI);
    const fileRecord = this.fileRegistry.get(normalizedURI);

    if (!fileRecord) return null;

    for (const f of fileRecord.localFunctionMap.values()) {
      if ((f.exportedAs === foreignName || f.name === foreignName) && f.isExported) {
        return f.name;
      }
    }
    return null;
  }

  // JATIN OR MANKIRAT MAY PROVIDE THEIR OWN IMPLEMENTATION OF THIS :>

  public buildDirectedGraph(): void {
    this.directedGraph.clear();

    for (const [callerURI, fileRecord] of this.fileRegistry.entries()) {
      for (const func of fileRecord.localFunctionMap.values()) {
        const callerKey = GlobalSymbolRegistry.generateUUID(callerURI, func.name);

        if (!this.directedGraph.has(callerKey)) {
          this.directedGraph.set(callerKey, {
            outboundEdges: new Set(),
            inboundEdges: new Set(),
          });
        }

        for (const callName of func.calls) {
          let targetKey: string | null = null;

          // Case 1: intra-file call
          if (fileRecord.localFunctionMap.has(callName)) {
            targetKey = GlobalSymbolRegistry.generateUUID(callerURI, callName);
          }

          // Case 2: cross-file call via import
          else if (fileRecord.importMap.has(callName)) {
            const importRecord = fileRecord.importMap.get(callName)!;

            const targetURI = resolveAbsoluteURI(
              callerURI,
              importRecord.rawSource,
              this.validWorkspaceFiles,
              this.aliases,
            );

            if (targetURI) {
              const trueName = this.resolveExport(targetURI, importRecord.foreignName);
              if (trueName) {
                targetKey = GlobalSymbolRegistry.generateUUID(
                  normalizeOSPath(targetURI),
                  trueName
                );
              }
            }
          }

          if (targetKey) {
            if (!this.directedGraph.has(targetKey)) {
              this.directedGraph.set(targetKey, {
                outboundEdges: new Set(),
                inboundEdges: new Set(),
              });
            }

            this.directedGraph.get(callerKey)!.outboundEdges.add(targetKey);
            this.directedGraph.get(targetKey)!.inboundEdges.add(callerKey);
          }
        }
      }
    }

    console.log(`[GlobalRegistry] Graph built: ${this.directedGraph.size} nodes`);
  }

  public setFirewall(validFiles: string[], aliases: Record<string, string>): void {
    this.validWorkspaceFiles = new Set(validFiles);
    this.aliases = aliases;
  }
  // DEV TOOL
  public getRegistrySize(): number {
    return this.fileRegistry.size;
  }
  public getNode(uuid: string): GraphNode | null {
    return this.directedGraph.get(uuid) || null;
  }

  public getDirectedGraph(): Map<string, GraphNode> {
    return this.directedGraph;
  }
}
