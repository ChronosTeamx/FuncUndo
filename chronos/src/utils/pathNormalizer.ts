/**
 * Sterilizes file paths to guarantee mathematical string equality across operating systems.
 * - Converts Windows backslashes (\) to POSIX forward slashes (/).
 * - Forces Windows drive letters to lowercase (C:/ -> c:/).
 * - Preserves case sensitivity for the rest of the path to maintain Linux compatibility.
 */
export function normalizeOSPath(rawPath: string): string {
  let cleanPath = rawPath.replace(/\\/g, '/');

  // Strict Drive Letter normalization (Windows only)
  if (cleanPath.match(/^[a-zA-Z]:\//)) {
    cleanPath = cleanPath.charAt(0).toLowerCase() + cleanPath.slice(1);
  }

  return cleanPath;
}
