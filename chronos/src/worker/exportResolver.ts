import type { SyntaxNode } from 'web-tree-sitter';
import { ParsedFunction, ProxyExport } from '../lib/types';

/**
 * PASS 2: The Gateway Resolver
 * Scans top-level nodes for all export variations and retroactively
 * updates the ParsedFunction array. Records Pass-Throughs and Wildcards.
 */
export function resolveExports(rootNode: SyntaxNode, localFunctions: ParsedFunction[]) {
  const proxyExports: ProxyExport[] = [];
  const wildcardExports: string[] = [];

  // Initialize all functions as private by default
  localFunctions.forEach((f) => {
    f.isExported = false;
    f.exportedAs = null;
  });

  for (let i = 0; i < rootNode.childCount; i++) {
    const node = rootNode.child(i);
    if (!node) continue;
    if (node.type !== 'export_statement') continue;

    // --- THE PROXY & WILDCARD CHECK ---
    const sourceNode = node.childForFieldName('source');
    const source = sourceNode ? sourceNode.text.replace(/['"`]/g, '') : null;

    if (source) {
      // 🕳️ The Black Hole (export * from './file')
      if (node.children.some((c) => c.type === '*')) {
        wildcardExports.push(source);
        continue;
      }

      // ➡️ The Proxy Pass-Through (export { calc } from './file')
      const clause = node.children.find((c) => c.type === 'export_clause');
      if (clause) {
        for (let j = 0; j < clause.childCount; j++) {
          const c = clause.child(j);
          if (c && c.type === 'export_specifier') {
            const name = c.childForFieldName('name')?.text;
            const alias = c.childForFieldName('alias')?.text;
            if (name) proxyExports.push({ name: alias || name, source });
          }
        }
      }
      continue;
    }

    // --- THE LOCAL EXPORTS ---

    // 1. Detached / Aliased Exports (export { x as y })
    const clause = node.children.find((c) => c.type === 'export_clause');
    if (clause) {
      for (let j = 0; j < clause.childCount; j++) {
        const c = clause.child(j);
        if (c && c.type === 'export_specifier') {
          const localName = c.childForFieldName('name')?.text || null;
          const globalName = c.childForFieldName('alias')?.text || localName;

          // Retroactively flip the flag!
          const targetFunc = localFunctions.find((f) => f.name === localName);
          if (targetFunc) {
            targetFunc.isExported = true;
            targetFunc.exportedAs = globalName;
          }
        }
      }
      continue;
    }

    // 2. Default Exports (export default function X() {})
    if (node.children.some((c) => c.type === 'default')) {
      const valueNode = node.lastNamedChild;
      if (valueNode) {
        const internalName = valueNode.childForFieldName('name')?.text || valueNode.text;
        const targetFunc = localFunctions.find((f) => f.name === internalName);
        if (targetFunc) {
          targetFunc.isExported = true;
          targetFunc.exportedAs = 'default';
        }
      }
      continue;
    }

    // 3. Inline Exports (export function X() {})
    const declaration = node.children.find((c) => ['function_declaration'].includes(c.type));
    if (declaration) {
      const name = declaration.childForFieldName('name')?.text || null;
      const targetFunc = localFunctions.find((f) => f.name === name);
      if (targetFunc) {
        targetFunc.isExported = true;
        targetFunc.exportedAs = name;
      }
    }
  }

  return { proxyExports, wildcardExports };
}
