import * as path from 'path';

/**
 * Enterprise-grade URI resolver.
 *
 * Supports:
 * - relative imports
 * - aliases (@/)
 * - monorepo package imports
 * - extensionless imports
 * - folder indexes
 *
 * O(1) RAM lookup only.
 * Zero disk I/O.
 */
export function resolveAbsoluteURI(
  callerFilePath: string,
  importString: string,
  validWorkspaceFiles: Set<string>,
  aliases: Record<string, string> = {},
): string | null {
  // -----------------------------
  // 1. ALIAS INTERCEPTION
  // -----------------------------
  let targetString = importString;

  for (const [prefix, replacement] of Object.entries(aliases)) {
    if (targetString.startsWith(prefix)) {
      targetString = targetString.replace(prefix, replacement);

      break;
    }
  }

  // -----------------------------
  // 2. DIRECTORY MATH
  // -----------------------------
  let targetPath = targetString;

  const isRelative = targetString.startsWith('.');

  if (isRelative) {
    const callerDir = path.dirname(callerFilePath);

    targetPath = path.resolve(callerDir, targetString);
  }

  // Normalize Windows paths
  targetPath = targetPath.replace(/\\/g, '/');

  // -----------------------------
  // 3. RESOLUTION CASCADE
  // -----------------------------
  const cascadeQueue = [
    // Exact match
    targetPath,

    // TS priority
    `${targetPath}.ts`,
    `${targetPath}.tsx`,

    // JS fallback
    `${targetPath}.js`,
    `${targetPath}.jsx`,

    // Folder indexes
    `${targetPath}/index.ts`,
    `${targetPath}/index.tsx`,
    `${targetPath}/index.js`,
    `${targetPath}/index.jsx`,
  ];

  // -----------------------------
  // 4. RAM FIREWALL
  // -----------------------------
  for (const candidate of cascadeQueue) {
    // O(1) RAM check
    if (validWorkspaceFiles.has(candidate)) {
      /**
       * Double safety:
       * Never parse node_modules.
       */
      if (candidate.includes('/node_modules/')) {
        return null;
      }

      return candidate;
    }
  }

  // External dependency
  return null;
}
