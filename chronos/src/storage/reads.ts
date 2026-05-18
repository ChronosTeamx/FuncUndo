import { eq, desc  } from 'drizzle-orm';
import { db } from './db';
import { snapshots, dependencies, functionHistory } from './schema';
import type { SnapshotRecord, DependencyRecord, FunctionRecord } from './schema';

export interface SnapshotWithDependencies {
  snapshot:     SnapshotRecord;
  dependencies: DependencyRecord[];
}

export function getFunctionTimeline(functionHistoryId: string): SnapshotWithDependencies[] {
  const snapshotsForFunction = db
    .select()
    .from(snapshots)
    .where(eq(snapshots.functionHistoryId, functionHistoryId))
    .orderBy(desc(snapshots.createdAt))
    .all();
    if (snapshotsForFunction.length === 0) return [];

  return snapshotsForFunction.map(snapshot => ({
    snapshot,
    dependencies: db
      .select()
      .from(dependencies)
      .where(eq(dependencies.snapshotId, snapshot.id))
      .all(),
  }));
}    

export function getTimelineForFile(filePath: string): Map<string, SnapshotWithDependencies[]> {
    const functionsInFile = db
    .select()
    .from(functionHistory)
    .where(eq(functionHistory.filePath, filePath))
    .all();
    
    if (functionsInFile.length === 0) return new Map();

    const timelineMap = new Map<string, SnapshotWithDependencies[]>();

    for (const func of functionsInFile) {
        const timeLine = getFunctionTimeline(func.id);
        timelineMap.set(func.id, timeLine);
    }
    return timelineMap;
}

export function getSnapshotById(snapshotId: string): SnapshotWithDependencies | null {
    const snapshot = db
    .select()
    .from(snapshots)
    .where(eq(snapshots.id,snapshotId))
    .get();

    if (!snapshot) return null;

    const dependenciesForSnapshot = db
    .select()
    .from(dependencies)
    .where(eq(dependencies.snapshotId, snapshotId))
    .all();
    
    return { snapshot, dependencies: dependenciesForSnapshot };
}

export function getLatestSnapshot(
  functionHistoryId: string
): SnapshotWithDependencies | null {
  const row = db
    .select()
    .from(snapshots)
    .where(eq(snapshots.functionHistoryId, functionHistoryId))
    .orderBy(desc(snapshots.createdAt))
    .get();

  if (!row) return null;

  return {
    snapshot: row,
    dependencies: db
      .select()
      .from(dependencies)
      .where(eq(dependencies.snapshotId, row.id))
      .all(),
  };
}

export function getFunctionById(functionHistoryId: string): FunctionRecord | null {
  const row = db
    .select()
    .from(functionHistory)
    .where(eq(functionHistory.id, functionHistoryId))
    .get(); 

  return row || null;
}    