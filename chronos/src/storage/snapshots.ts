import * as crypto from 'crypto';
import { db, persistDB } from './db';
import { getDB } from './db';
import { snapshots, dependencies, NewSnapshot, NewDependency } from './schema';
import { upsertFunction } from './functions';
import { functionIdentity } from './functions';
import { setPointer } from './pointer';

export interface parsedFunction {
  filePath: string;
  functionName: string;
  parentName: string ;
  parentId: string ;
  content: string;
  hash: string;
  dependencies: string[]; // id of functions this one calls
  startLine: number;
  endLine: number;
}
 function saveSnapshot(fn: parsedFunction): string {
  const identity: functionIdentity = {
    filePath: fn.filePath,
    functionName: fn.functionName,
    parentName: fn.parentName,
    parentId: fn.parentId,
  };
  const functionHistoryId = upsertFunction(identity);

  const snapshotId = crypto.randomUUID();

  // Insert snapshot record
  const newSnapshot: NewSnapshot = {
    id: snapshotId,
    functionHistoryId: functionHistoryId,
    content: fn.content,
    hash: fn.hash,
    startLine: fn.startLine,
    endLine: fn.endLine,
    createdAt: Date.now(),
  };
  db.insert(snapshots).values(newSnapshot).run();

  // Step 4 — insert dependencies
  // Each function this snapshot calls
  for (const depId of fn.dependencies) {
    const dep: NewDependency = {
      id: crypto.randomUUID(),
      snapshotId: snapshotId,
      dependencyId: depId,
      type: 'calls',
    };
    db.insert(dependencies).values(dep).run();
  }

  // Step 5 — insert dependents
  // Each function that calls this snapshot
  //   for (const depId of fn.dependents) {
  //     const dep: NewDependency = {
  //       id:             crypto.randomUUID(),
  //       snapshotId:     snapshotId,
  //       dependencyId:   depId,
  //       type:           'calledBy',
  //     };
  //     db.insert(dependencies).values(dep).run();
  //   }
  setPointer(functionHistoryId, snapshotId);
  return snapshotId;
}

export function saveAllFunctionsSnapshots(functions: parsedFunction[]): void {
  // sql.js transaction — all succeed or all rollback
  const sqlJsDb = getDB();

  sqlJsDb.run('BEGIN');
  try {
    for (const fn of functions) {
      saveSnapshot(fn);
    }
    sqlJsDb.run('COMMIT');
    persistDB(); // ensure we write to disk after a successful transaction
    console.log(`[FuncUndo] ${functions.length} functions saved`);
  } catch (err) {
    sqlJsDb.run('ROLLBACK');
    console.error('[FuncUndo] Transaction failed, rolled back:', err);
    throw err;
  }
}

