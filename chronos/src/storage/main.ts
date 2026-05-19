// Storage layer public API
// All other phases import from here, never from individual files

// DB lifecycle
export { initDB, persistDB, closeDB, getDB , getDrizzleDB} from './db';

// Write
export {  saveAllFunctionsSnapshots } from './snapshots';
export { upsertFunction, getAllFunctionsInFile, generateFunctionId } from './functions';

// Read
export {
  getFunctionTimeline,
  getTimelineForFile,
  getSnapshotById,
  getLatestSnapshot,
  getFunctionById,
} from './reads';

// Pointer management
export { setPointer, getPointer, deletePointer } from './pointer';

// Types — other phases need these
export type { parsedFunction } from './snapshots';
export type { functionIdentity } from './functions';
export type {
  FunctionRecord,
  NewFunction,
  SnapshotRecord,
  NewSnapshot,
  DependencyRecord,
  NewDependency,
  PointerRecord,
  NewPointer,
} from './schema';
