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
