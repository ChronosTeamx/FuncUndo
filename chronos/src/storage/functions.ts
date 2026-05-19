import * as crypto from 'crypto';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from './db';
import { functionHistory, NewFunction } from './schema';

export interface functionIdentity{
    filePath: string;  //relative file path to the function
    functionName: string;
    parentName: string ;
    parentId: string ;
};

//this generates a unique ID for a function based on its identity (file path, function name, parent function info) by hashing these attributes together using SHA-256. This allows us to track the same logical function across different versions of the code, even if its name or location changes, as long as its identity remains consistent.
export function generateFunctionId(identity: functionIdentity): string {
    const rawID = `${identity.filePath}::${identity.functionName}::${identity.parentName || 'global'}::${identity.parentId || 'global'}`;
    return crypto.createHash('sha256').update(rawID).digest('hex');
}

export function upsertFunction(identity: functionIdentity): string {
    const id = generateFunctionId(identity);

      // Check if this function already exists
  const existing = db
    .select()
    .from(functionHistory)
    .where(
      and(
        eq(functionHistory.filePath, identity.filePath),
        eq(functionHistory.functionName, identity.functionName),
        identity.parentName
          ? eq(functionHistory.parentName, identity.parentName)
          : isNull(functionHistory.parentName),
        identity.parentId
          ? eq(functionHistory.parentId, identity.parentId)
          : isNull(functionHistory.parentId)
      )
    )
    .all();
  if (existing.length === 0) {
    // First time we've seen this function — insert it
    const record: NewFunction = {
      id,
      filePath:     identity.filePath,
      functionName: identity.functionName,
      parentName:   identity.parentName,
      parentId:     identity.parentId,
    };

    db.insert(functionHistory).values(record).run();
    console.log(`[FuncUndo] New function registered: ${identity.functionName}`);
    }
    return id;
}
export function getAllFunctionsInFile(filePath: string) {
    return db
    .select()
    .from(functionHistory)
    .where(eq(functionHistory.filePath,filePath))
    .all();
}