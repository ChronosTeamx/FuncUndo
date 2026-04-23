export interface CodePosition {
  row: number; // The 0-indexed line number
  column: number; // The 0-indexed character offset on that line
}

export interface CodeRange {
  start: CodePosition;
  end: CodePosition;
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

export type WorkerMessage = WorkerParseRequest | WorkerParseSuccess | WorkerParseError;
