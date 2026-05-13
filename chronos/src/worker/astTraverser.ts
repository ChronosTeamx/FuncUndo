import type { SyntaxNode } from 'web-tree-sitter';
import { ParsedFunction } from '../lib/types';

const FUNCTION_TYPES = new Set(['function_declaration', 'arrow_function', 'method_definition']);

function extractFunctionName(node: SyntaxNode): string {
  const nameNode = node.childForFieldName('name');
  if (nameNode) return nameNode.text;

  if (node.type === 'arrow_function' && node.parent?.type === 'variable_declarator') {
    const idNode = node.parent.childForFieldName('name');
    if (idNode) return idNode.text;
  }

  return 'anonymous_function';
}

//DFS( MAIN FUNCTION )
export function extractFunctions(rootNode: SyntaxNode): ParsedFunction[] {
  const results: ParsedFunction[] = [];

  function walk(node: SyntaxNode) {
    if (FUNCTION_TYPES.has(node.type)) {
      const parsedFunc: ParsedFunction = {
        name: extractFunctionName(node),
        hash: 'placeholder_hash',
        range: {
          start: { row: node.startPosition.row, column: node.startPosition.column },
          end: { row: node.endPosition.row, column: node.endPosition.column },
        },
        rawText: node.text,
      };
      results.push(parsedFunc);
    }

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        walk(child);
      }
    }
  }

  walk(rootNode); //RECURSION TRIGGER

  return results;
}
