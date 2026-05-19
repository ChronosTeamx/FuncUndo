import type { SyntaxNode } from 'web-tree-sitter';
import { ParsedFunction, ProxyExport } from '../lib/types';

/**
 * PASS 2: The Gateway Resolver
 *
 * Scans top-level nodes for all export variations and retroactively
 * updates the ParsedFunction array.
 *
 * Responsibilities:
 * - Local exports
 * - Aliased exports
 * - Default exports
 * - Proxy pass-through exports
 * - Wildcard exports
 *
 * Complexity:
 * O(E + N)
 * E = export statements
 * N = local functions
 */
export function resolveExports(rootNode: SyntaxNode, localFunctions: ParsedFunction[]) {
  const proxyExports: ProxyExport[] = [];
  const wildcardExports: string[] = [];

  // ------------------------------------------------------------------
  // 🚀 O(1) LOOKUP OPTIMIZATION
  // Build a memory map of functions by name
  // while initializing export defaults.
  // ------------------------------------------------------------------
  const functionMap = new Map<string, ParsedFunction>();

  for (const func of localFunctions) {
    func.isExported = false;
    func.exportedAs = null;

    if (func.name) {
      functionMap.set(func.name, func);
    }
  }

  /**
   * Marks a function as exported if found.
   */
  const markExported = (localName: string | null | undefined, exportedAs: string | null) => {
    if (!localName) return;

    const targetFunc = functionMap.get(localName);

    if (!targetFunc) return;

    targetFunc.isExported = true;
    targetFunc.exportedAs = exportedAs;
  };

  /**
   * Handles inline declarations:
   *
   * export function foo() {}
   * export const foo = () => {}
   * export const foo = function () {}
   */
  const resolveInlineExport = (declaration: SyntaxNode) => {
    // ------------------------------------------------------------
    // Function declarations
    // export function foo() {}
    // ------------------------------------------------------------
    if (declaration.type === 'function_declaration') {
      const name = declaration.childForFieldName('name')?.text || null;

      markExported(name, name);
      return;
    }

    // ------------------------------------------------------------
    // Variable / lexical declarations
    // export const foo = () => {}
    // export let foo = function () {}
    // ------------------------------------------------------------
    if (declaration.type === 'lexical_declaration' || declaration.type === 'variable_declaration') {
      for (let i = 0; i < declaration.childCount; i++) {
        const child = declaration.child(i);

        if (!child || child.type !== 'variable_declarator') {
          continue;
        }

        const name = child.childForFieldName('name')?.text || null;

        markExported(name, name);
      }
    }
  };

  // ------------------------------------------------------------------
  // Main AST Scan
  // ------------------------------------------------------------------
  for (let i = 0; i < rootNode.childCount; i++) {
    const node = rootNode.child(i);

    if (!node) continue;
    if (node.type !== 'export_statement') continue;

    // ==============================================================
    // PROXY / RE-EXPORTS
    // export * from './file'
    // export { x } from './file'
    // ==============================================================
    const sourceNode = node.childForFieldName('source');

    const source = sourceNode ? sourceNode.text.replace(/['"`]/g, '') : null;

    if (source) {
      // ----------------------------------------------------------
      // 🕳️ Wildcard Export
      // export * from './file'
      // ----------------------------------------------------------
      const isWildcard = node.text.startsWith('export *');

      if (isWildcard) {
        wildcardExports.push(source);
        continue;
      }

      // ----------------------------------------------------------
      // ➡️ Proxy Pass-Through
      // export { calc } from './file'
      // export { calc as compute } from './file'
      // ----------------------------------------------------------
      const clause = node.children.find((c) => c.type === 'export_clause');

      if (clause) {
        for (let j = 0; j < clause.childCount; j++) {
          const c = clause.child(j);

          if (!c || c.type !== 'export_specifier') {
            continue;
          }

          const name = c.childForFieldName('name')?.text || null;

          const alias = c.childForFieldName('alias')?.text || null;

          if (!name) continue;

          proxyExports.push({
            name: alias || name,
            source,
          });
        }
      }

      continue;
    }

    // ==============================================================
    // LOCAL EXPORTS
    // ==============================================================

    // --------------------------------------------------------------
    // 1. Detached / Aliased Exports
    //
    // export { x }
    // export { x as y }
    // --------------------------------------------------------------
    const clause = node.children.find((c) => c.type === 'export_clause');

    if (clause) {
      for (let j = 0; j < clause.childCount; j++) {
        const c = clause.child(j);

        if (!c || c.type !== 'export_specifier') {
          continue;
        }

        const localName = c.childForFieldName('name')?.text;

        const globalName = c.childForFieldName('alias')?.text || localName || null;

        markExported(localName, globalName);
      }

      continue;
    }

    // --------------------------------------------------------------
    // 2. Default Exports
    //
    // export default foo
    // export default function foo() {}
    // export default () => {}
    // --------------------------------------------------------------
    const isDefaultExport = node.children.some((c) => c.type === 'default');

    if (isDefaultExport) {
      const valueNode = node.lastNamedChild;

      if (!valueNode) continue;

      const internalName = valueNode.childForFieldName('name')?.text || null;

      // Named default export
      if (internalName) {
        markExported(internalName, 'default');
      }

      // Anonymous defaults intentionally ignored
      // export default () => {}
      // export default function() {}

      continue;
    }

    // --------------------------------------------------------------
    // 3. Inline Exports
    //
    // export function foo() {}
    // export const foo = () => {}
    // --------------------------------------------------------------
    const declaration = node.children.find((c) =>
      ['function_declaration', 'lexical_declaration', 'variable_declaration'].includes(c.type),
    );

    if (declaration) {
      resolveInlineExport(declaration);
    }
  }

  return {
    proxyExports,
    wildcardExports,
  };
}
