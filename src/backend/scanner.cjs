const fs = require('fs/promises');
const path = require('path');

const ALL_EXTENSIONS = new Set([
  '.txt', '.csv', '.md', '.json', '.js', '.html', '.css', '.xml', '.yml', '.yaml', '.log',
  '.pdf', '.docx', '.pptx', '.xlsx', '.odt', '.odp', '.ods', '.rtf', '.doc', '.ppt', '.xls',
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.heic', '.avif', '.svg',
  '.ics', '.ical', '.psd',
]);

const MAX_REGEX_LENGTH = 200;

async function scanDirectory(dirPath, limit = 50, extensions = null, nameFilter = null, nameFilterFlags = null) {
  const allowedExtensions = extensions && extensions.length > 0 ? new Set(extensions) : ALL_EXTENSIONS;

  let nameRegex = null;
  if (nameFilter) {
    if (nameFilter.length > MAX_REGEX_LENGTH) {
      console.warn('Name filter regex too long, ignoring');
    } else {
      try {
        const flags = nameFilterFlags ? nameFilterFlags.join('') : '';
        nameRegex = new RegExp(nameFilter, flags);
      } catch (err) {
        console.warn('Invalid name filter regex:', err);
      }
    }
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (allowedExtensions.has(ext)) {
          if (nameRegex && !nameRegex.test(entry.name)) {
            continue;
          }

          files.push({
            name: entry.name,
            path: path.join(dirPath, entry.name),
            extension: ext,
            status: 'pending',
          });

          if (limit > 0 && files.length >= limit) {
            break;
          }
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
