import type { SyntaxNode } from 'web-tree-sitter';
import { ImportedSymbol } from '../lib/types';

export function extractImports(rootNode: SyntaxNode): ImportedSymbol[] {
  const imports: ImportedSymbol[] = [];

  for (let i = 0; i < rootNode.childCount; i++) {
    const node = rootNode.child(i);

    if (!node) continue;

    if (node.type !== 'import_statement') {
      continue;
    }

    let rawSource = '';
    let clause: SyntaxNode | null = null;

    // --------------------------------
    // Find source + import clause
    // using node types instead of
    // field names (more reliable)
    // --------------------------------
    for (let j = 0; j < node.childCount; j++) {
      const child = node.child(j);

      if (!child) continue;

      // import_clause
      if (child.type === 'import_clause') {
        clause = child;
      }

      // string source
      if (child.type === 'string') {
        rawSource = child.text.replace(/['"`]/g, '');
      }
    }

    // Ignore side-effect imports
    // import './styles.css'
    if (!clause) {
      continue;
    }

    // --------------------------------
    // Hybrid-safe traversal
    // --------------------------------
    for (let j = 0; j < clause.childCount; j++) {
      const child = clause.child(j);

      if (!child) continue;

      // --------------------------------
      // Case 1: Default Import
      // import React
      // --------------------------------
      if (child.type === 'identifier') {
        imports.push({
          localName: child.text,
          foreignName: 'default',
          rawSource,
        });

        continue;
      }

      // --------------------------------
      // Case 2: Namespace Import
      // import * as Utils
      // --------------------------------
      if (child.type === 'namespace_import') {
        const aliasNode = child.lastNamedChild;

        if (!aliasNode) {
          continue;
        }

        imports.push({
          localName: aliasNode.text,
          foreignName: '*',
          rawSource,
        });

        continue;
      }

      // --------------------------------
      // Case 3: Named Imports
      // import { a, b as c }
      // --------------------------------
      if (child.type === 'named_imports') {
        for (let k = 0; k < child.childCount; k++) {
          const specifier = child.child(k);

          if (!specifier || specifier.type !== 'import_specifier') {
            continue;
          }

          const identifiers: string[] = [];

          for (let m = 0; m < specifier.childCount; m++) {
            const specChild = specifier.child(m);

            if (specChild?.type === 'identifier') {
              identifiers.push(specChild.text);
            }
          }

          // import { chunk }
          if (identifiers.length === 1) {
            imports.push({
              localName: identifiers[0],
              foreignName: identifiers[0],
              rawSource,
            });
          }

          // import { chunk as c }
          if (identifiers.length === 2) {
            imports.push({
              localName: identifiers[1],
              foreignName: identifiers[0],
              rawSource,
            });
          }
        }
      }
    }
  }

  console.log('[Worker] Extracted imports:', imports);

  return imports;
}
