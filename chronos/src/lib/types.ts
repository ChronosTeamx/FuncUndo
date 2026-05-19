// --- THE ENUMS & TELEMETRY (4.23) ---

export interface UITelemetryPayload {
  level: RiskLevel;
  codeLensText: string;
  hoverMarkdown: string;
}

export interface ImportNode {
  localName: string;
  foreignName: string;
  resolvedURI: string | null;
}

export interface OptimizedFileRecord {
  fileURI: string;
  localFunctionMap: Map<string, ParsedFunction>; // O(1) Lookups
  importMap: Map<string, ImportNode>; // O(1) Lookups
}

// --- THE GRAPH MEMORY STRUCTURE (4.13 & 4.17) ---
export interface GraphNode {
  outboundEdges: Set<string>;
  inboundEdges: Set<string>;
  deepInboundCache: Set<string> | null; // Memoization Cache
}

// ======================================================
// Semantic Hashing Configuration
// ======================================================

/**
 * AST node types that never affect semantic meaning.
 * Safe to ignore during hashing.
 */
export const EXCLUDED_NODE_TYPES = new Set<string>(['comment', ';', 'ERROR']);

/**
 * Node types whose exact textual value
 * changes program semantics.
 *
 * Example:
 * + !== *
 * 5 !== 10
 */
export const VALUE_SENSITIVE_TYPES = new Set<string>([
  // literals
  'number',
  'string',
  'boolean',

  // arithmetic
  '+',
  '-',
  '*',
  '/',
  '%',

  // assignment / comparison
  '=',
  '==',
  '===',
  '!=',
  '!==',
  '>',
  '<',
  '>=',
  '<=',
]);

/**
 * AST structures that carry semantic meaning.
 *
 * Wrapper/punctuation nodes are excluded
 * to preserve formatting invariance.
 */
export const SEMANTIC_NODE_TYPES = new Set<string>([
  // functions
  'function_declaration',
  'method_definition',
  'arrow_function',

  // statements
  'return_statement',
  'if_statement',
  'for_statement',
  'while_statement',

  // expressions
  'binary_expression',
  'call_expression',
  'assignment_expression',
  'member_expression',

  // names matter semantically
  'identifier',
]);

export interface CodePosition {
  row: number; // The 0-indexed line number
  column: number; // The 0-indexed character offset on that line
}

export interface CodeRange {
  start: CodePosition;
  end: CodePosition;
}

export interface WorkerReady {
  type: 'WORKER_READY';
}

export interface ParsedFunction {
  name: string;
  hash: string;
  range: CodeRange;
  rawText: string;
  calls: string[]; // List of called function names within this function
  // --- NEW: DOMAIN 4 GATEWAY METADATA ---
  isExported: boolean;
  exportedAs: string | null;
}

export interface ProxyExport {
  name: string;
  source: string;
}

export interface IntraFileEdge {
  callerName: string;
  calleeName: string;
  callRange?: CodeRange;
}

export type RiskLevel = 'SAFE' | 'WARNING' | 'DANGER';

export interface RiskAnalysisResult {
  targetFunction: string;
  level: RiskLevel;
  dependentCount: number;
  dependents: string[];
}

export interface ExportedSymbol {
  originalName: string; // The internal name of the function/variable
  exportedAs: string; // The public name it is exported as (handles aliases and 'default')
}

export interface WorkerParseRequest {
  type: 'PARSE_REQUEST';
  jobId: string;
  filePath: string;
  fileContent: string;
}

export interface WorkerParseSuccess {
  type: 'PARSE_SUCCESS';
  jobId: string;
  filePath: string;
  fileHash: string;
  functions: ParsedFunction[];
  // --- NEW: THE CROSS-FILE GATEWAYS ---
  proxyExports: ProxyExport[];
  wildcardExports: string[];
  edges: IntraFileEdge[];
  processingTimeMs: number;
}

export interface WorkerParseError {
  type: 'PARSE_ERROR';
  jobId: string;
  filePath: string;
  errorMessage: string;
}

export type WorkerMessage =
  | WorkerParseRequest
  | WorkerParseSuccess
  | WorkerParseError
  | WorkerReady;
