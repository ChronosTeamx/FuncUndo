import * as crypto from 'crypto';
import type { SyntaxNode } from 'web-tree-sitter';

/**
 * Goals:
 * 1. Ignore formatting noise
 * 2. Ignore comments and semicolons
 * 3. Ignore broken parser recovery nodes
 * 4. Detect operator changes (+ → *)
 * 5. Detect literal changes (5 → 10)
 * 6. Remain stable across whitespace/style changes
 */

import { EXCLUDED_NODE_TYPES, VALUE_SENSITIVE_TYPES, SEMANTIC_NODE_TYPES } from '../lib/types';

export function generateStructuralHash(functionNode: SyntaxNode): string {
  const nodeTypes: string[] = [];

  function walkSubtree(node: SyntaxNode) {
    // 1. Ignore non-semantic noise
    if (EXCLUDED_NODE_TYPES.has(node.type)) {
      return;
    }

    // 2. Preserve operator/literal changes
    if (VALUE_SENSITIVE_TYPES.has(node.type)) {
      nodeTypes.push(`${node.type}:${node.text}`);
    }

    // 3. Only include meaningful AST structure
    else if (SEMANTIC_NODE_TYPES.has(node.type)) {
      nodeTypes.push(node.type);
    }

    // 4. Continue traversal
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);

      if (child) {
        walkSubtree(child);
      }
    }
  }

  walkSubtree(functionNode);

  const structureString = nodeTypes.join('-');

  return crypto.createHash('sha256').update(structureString).digest('hex');
}

export function generateFileHash(functionHashes: string[]): string {
  if (functionHashes.length === 0) {
    return 'empty_file_hash';
  }

  const combinedString = [...functionHashes].sort().join('');

  return crypto.createHash('sha256').update(combinedString).digest('hex');
}
