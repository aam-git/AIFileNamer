const fs = require('fs/promises');
const path = require('path');

const SUPPORTED_EXTENSIONS = new Set(['.txt', '.csv', '.jpg', '.jpeg', '.png']);

async function scanDirectory(dirPath, limit = 50, extensions = null, nameFilter = null, nameFilterFlags = null) {
  const allowedExtensions = extensions ? new Set(extensions) : SUPPORTED_EXTENSIONS;
  
  let nameRegex = null;
  if (nameFilter) {
    try {
      const flags = nameFilterFlags ? nameFilterFlags.join('') : '';
      nameRegex = new RegExp(nameFilter, flags);
    } catch (err) {
      console.warn('Invalid name filter regex:', err);
    }
  }
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (allowedExtensions.has(ext)) {
          // Check regex filter if provided
          if (nameRegex && !nameRegex.test(entry.name)) {
            continue;
          }

          files.push({
            name: entry.name,
            path: path.join(dirPath, entry.name),
            extension: ext,
            status: 'pending'
          });
        }
      }
    }

    return files;
  } catch (error) {
    console.error('Error scanning directory:', error);
    throw error;
  }
}

module.exports = { scanDirectory };
