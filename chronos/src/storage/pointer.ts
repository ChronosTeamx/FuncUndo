import { eq } from 'drizzle-orm';
import { db, getDB} from './db';
import { pointers } from './schema';

// Set or update pointer for a function
// Called by Write DAO after every saveSnapshot
// Called by Reversion Engine after every stepBack/stepForward
export function setPointer(functionHistoryId: string, snapshotId: string): void {
  db.insert(pointers)
    .values({
      functionHistoryId,
      currentSnapshotId: snapshotId,
    })
    .onConflictDoUpdate({
      target: pointers.functionHistoryId,
      set: { currentSnapshotId: snapshotId },
    })
    .run();
    //persistDB(); // persist after pointer update to ensure durability of the current state  
}

// Get current snapshot ID for a function
// Called by Reversion Engine to know where user currently is
export function getPointer(functionHistoryId: string): string | null {
  const row = db
    .select()
    .from(pointers)
    .where(eq(pointers.functionHistoryId, functionHistoryId))
    .get();

  return row?.currentSnapshotId ?? null;
}

// Delete pointer — called when function history is cleared
export function deletePointer(functionHistoryId: string): void {
  const sqlJsDb = getDB();
  if (!sqlJsDb) {
    console.error('Database not initialized');
    return;
  }
  
  try{
  db.delete(pointers)
    .where(eq(pointers.functionHistoryId, functionHistoryId))
    .run();
    
    //persistDB();
   }catch (err) {
    
    console.error('[FuncUndo] Failed to delete pointer, rolled back:', err);
    throw err;
  } 
}