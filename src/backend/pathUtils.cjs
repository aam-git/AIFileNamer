const path = require('path');

/** Reject absolute paths, `..` segments, and resolved paths outside baseDir. */
function resolveWithinBase(baseDir, relativePath) {
  if (!baseDir || !relativePath) {
    throw new Error('Invalid path');
  }
  if (path.isAbsolute(relativePath)) {
    throw new Error('Absolute paths are not allowed');
  }
  const segments = relativePath.split(/[/\\]/);
  if (segments.some((s) => s === '..')) {
    throw new Error('Path traversal is not allowed');
  }

  const normalizedBase = path.resolve(baseDir);
  const resolved = path.resolve(normalizedBase, relativePath);
  if (resolved !== normalizedBase && !resolved.startsWith(normalizedBase + path.sep)) {
    throw new Error('Path is outside the allowed directory');
  }
  return resolved;
}

/** Ensure an absolute file path stays within baseDir. */
function assertPathWithinBase(filePath, baseDir) {
  if (!filePath || !baseDir) {
    throw new Error('Invalid path');
  }
  const normalizedBase = path.resolve(baseDir);
  const resolved = path.resolve(filePath);
  if (resolved !== normalizedBase && !resolved.startsWith(normalizedBase + path.sep)) {
    throw new Error('File path is outside the allowed directory');
  }
  return resolved;
}

module.exports = { resolveWithinBase, assertPathWithinBase };
