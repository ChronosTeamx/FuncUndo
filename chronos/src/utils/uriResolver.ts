import * as path from 'path';

/**
 * Enterprise-grade URI resolver.
 *
 * Resolves:
 * - relative imports
 * - absolute imports
 * - aliases (@/)
 * - extensionless imports
 * - folder index files
 *
 * Never touches disk.
 * Uses O(1) RAM lookup.
 */
export function resolveAbsoluteURI(
  callerFilePath: string,
  importString: string,
  validWorkspaceFiles: Set<string>,
  aliases: Record<string, string> = {},
): string | null {
  // -----------------------------
  // NODE_MODULES FIREWALL
  // -----------------------------
  const isRelative = importString.startsWith('.');

  const isAbsolute = importString.startsWith('/');

  const isAlias = Object.keys(aliases).some((prefix) => importString.startsWith(prefix));

  /**
   * Example:
   * react
   * lodash
   * axios
   */
  if (!isRelative && !isAbsolute && !isAlias) {
    return null;
  }

  // -----------------------------
  // ALIAS INTERCEPTION
  // -----------------------------
  let targetString = importString;

  for (const [prefix, replacement] of Object.entries(aliases)) {
    if (targetString.startsWith(prefix)) {
      targetString = targetString.replace(prefix, replacement);

      break;
    }
  }

  // -----------------------------
  // DIRECTORY MATH
  // -----------------------------
  let targetPath = targetString;

  if (isRelative) {
    const callerDir = path.dirname(callerFilePath);

    targetPath = path.resolve(callerDir, targetString);
  }

  // Windows-safe normalization
  targetPath = targetPath.replace(/\\/g, '/');

  // -----------------------------
  // RESOLUTION CASCADE
  // -----------------------------
  const cascadeQueue = [
    // Exact file
    targetPath,

    // TypeScript priority
    `${targetPath}.ts`,
    `${targetPath}.tsx`,

    // JavaScript fallback
    `${targetPath}.js`,
    `${targetPath}.jsx`,

    // Folder index resolution
    `${targetPath}/index.ts`,
    `${targetPath}/index.tsx`,
    `${targetPath}/index.js`,
    `${targetPath}/index.jsx`,
  ];

  // -----------------------------
  // O(1) RAM LOOKUP
  // -----------------------------
  for (const attempt of cascadeQueue) {
    if (validWorkspaceFiles.has(attempt)) {
      return attempt;
    }
  }

  // Broken import
  return null;
}
