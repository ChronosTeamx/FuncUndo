import type { SyntaxNode } from 'web-tree-sitter';
import { ParsedFunction } from '../lib/types';
import { generateStructuralHash } from './semanticHasher';
import { ImportedSymbol } from '../lib/types';

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

function resolveCallTarget(calleeNode: SyntaxNode): string | null {
  let currentNode = calleeNode;

  if (currentNode.type === 'optional_chain') {
    const unwrapped = currentNode.firstNamedChild;
    if (!unwrapped) return null;
    currentNode = unwrapped;
  }

  if (currentNode.type === 'identifier') {
    return currentNode.text;
  }

  if (currentNode.type === 'member_expression') {
    const propertyNode = currentNode.childForFieldName('property');
    // If the object itself is a call (getAuth().login), the continuous recursion
    // will catch getAuth, so we just want the rightmost leaf (login).
    if (propertyNode && propertyNode.type === 'property_identifier') {
      return propertyNode.text;
    }
  }

  if (currentNode.type === 'subscript_expression') {
    const indexNode = currentNode.childForFieldName('index');

    // ONLY extract if it is a hardcoded string.
    // Dynamic properties (obj[propName]) are gracefully ignored.
    if (indexNode && indexNode.type === 'string') {
      return indexNode.text.replace(/['"`]/g, '');
    }
  }

  return null;
}

/**
 * Scans STRICTLY inside a function's syntax tree to find execution calls.
 * Returns a deduplicated array of the names of the functions being called.
 */
function extractInternalCalls(functionNode: SyntaxNode): string[] {
  const dependencies = new Set<string>();

  function walkBody(node: SyntaxNode) {
    if (['function_declaration', 'arrow_function', 'method_definition'].includes(node.type)) {
      return;
    }

    if (node.type === 'call_expression') {
      const callee = node.childForFieldName('function');
      if (callee) {
        const targetName = resolveCallTarget(callee);
        if (targetName) {
          dependencies.add(targetName); // Map EVERYTHING for now
        }
      }
    }

    // We MUST keep walking the children to catch foo(bar()) where bar()
    // is hidden inside the arguments array of foo().
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) walkBody(child);
    }
  }

  // Start the walk ONLY on the body to prevent the root node from instantly
  // triggering the Circuit Breaker and killing the scan.
  const bodyNode = functionNode.childForFieldName('body');

  if (bodyNode) {
    walkBody(bodyNode);
  } else {
    // Arrow functions with implicit returns (e.g., const x = () => foo(bar()))
    // Their children are the direct expressions.
    for (let i = 0; i < functionNode.childCount; i++) {
      const child = functionNode.child(i);
      if (child) walkBody(child);
    }
  }

  return Array.from(dependencies);
}

//DFS( MAIN FUNCTION )
export function extractFunctions(
  rootNode: SyntaxNode,
  resolvedImports: ImportedSymbol[],
): ParsedFunction[] {
  const results: ParsedFunction[] = [];
  const functionStack: string[] = [];

  function walk(node: SyntaxNode) {
    let enteredFunction = false;

    if (FUNCTION_TYPES.has(node.type)) {
      if (node.hasError) {
        console.log(
          `[Worker] Skipping broken syntax state for function at row ${node.startPosition.row}`,
        );
        return; // Stop processing this specific node
      }

      const functionName = extractFunctionName(node);

      const parsedFunc: ParsedFunction = {
        name: functionName,
        hash: generateStructuralHash(node),
        range: {
          start: { row: node.startPosition.row, column: node.startPosition.column },
          end: { row: node.endPosition.row, column: node.endPosition.column },
        },
        rawText: node.text,
        calls: extractInternalCalls(node),
        isExported: false,
        exportedAs: null,
        parentChain: [...functionStack],
      };

      results.push(parsedFunc);

      functionStack.push(functionName);
      enteredFunction = true;
    }

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        walk(child);
      }
    }
    if (enteredFunction) {
      functionStack.pop();
    }
  }

  walk(rootNode); //RECURSION TRIGGER

  const validSignatures = new Set([
    ...results.map((f) => f.name),
    ...resolvedImports.map((imp) => imp.localName),
  ]);

  for (const func of results) {
    const purifiedCalls: string[] = [];
    for (const rawCall of func.calls) {
      // Now 'calc' will pass this check!
      if (validSignatures.has(rawCall)) {
        purifiedCalls.push(rawCall);
      }
    }
    func.calls = purifiedCalls;
  }

  return results;
}
