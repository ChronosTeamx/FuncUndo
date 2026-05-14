import * as crypto from 'crypto';
import type { SyntaxNode } from 'web-tree-sitter';

/**
 * Generates a SHA-256 hash based strictly on the structural node types.
 * This guarantees that formatting, spacing, or comments do NOT change the hash.
 */
export function generateStructuralHash(functionNode: SyntaxNode): string {
  const nodeTypes: string[] = [];

  // A localized DFS walker just for this specific function's subtree
  function walkSubtree(node: SyntaxNode) {
    // We explicitly ignore comments. A new comment does not change the code's logic!
    if (node.type !== 'comment') {
      nodeTypes.push(node.type);
    }

    // Walk all children of this specific node
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        walkSubtree(child);
      }
    }
  }

  // Start the walk from the top of the function node
  walkSubtree(functionNode);

  // 1. Join all the syntax types into a single massive string
  const structureString = nodeTypes.join('-');

  // 2. Create a cryptographic SHA-256 hash of that string
  return crypto.createHash('sha256').update(structureString).digest('hex');
}

/**
 * Generates a master fingerprint for the entire file by hashing
 * the concatenated structural hashes of all its functions.
 */
export function generateFileHash(functionHashes: string[]): string {
  if (functionHashes.length === 0) {
    return 'empty_file_hash';
  }

  // Sort the hashes alphabetically so the order of functions
  // doesn't artificially change the file hash if we do parallel processing later.
  const combinedString = [...functionHashes].sort().join('');

  return crypto.createHash('sha256').update(combinedString).digest('hex');
}
