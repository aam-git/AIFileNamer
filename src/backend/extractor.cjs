const fs = require('fs/promises');
const path = require('path');

global.DOMMatrix = class DOMMatrix {};
global.ImageData = class ImageData {};
global.Path2D = class Path2D {};
globalThis.DOMMatrix = class DOMMatrix {};
globalThis.ImageData = class ImageData {};
globalThis.Path2D = class Path2D {};



const { nativeImage, BrowserWindow } = require('electron');

async function getFileMetadata(filePath, extension) {
  let metaParts = [];
  try {
    const stats = await fs.stat(filePath);
    metaParts.push(`Original Filename: ${path.basename(filePath)}`);
    metaParts.push(`File Size: ${(stats.size / 1024).toFixed(2)} KB`);
    if (stats.birthtime && stats.birthtime.getTime() !== 0) metaParts.push(`Created: ${stats.birthtime.toISOString()}`);
    if (stats.mtime) metaParts.push(`Modified: ${stats.mtime.toISOString()}`);
  } catch (e) {
    console.error(`Failed to get file stat for ${filePath}:`, e);
  }

  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif', '.heic', '.avif'].includes(extension)) {
    try {
      const exifr = require('exifr');
      const exifData = await exifr.parse(filePath);
      if (exifData && Object.keys(exifData).length > 0) {
        metaParts.push('--- Embedded Image Metadata ---');
        for (const [key, value] of Object.entries(exifData)) {
          if (typeof value !== 'object') {
            metaParts.push(`${key}: ${value}`);
          } else if (value instanceof Date) {
            metaParts.push(`${key}: ${value.toISOString()}`);
          } else if (Array.isArray(value) && value.length < 10) {
            metaParts.push(`${key}: ${value.join(', ')}`);
          }
        }
      }
    } catch (e) {
      console.error(`Failed to parse EXIF data for ${filePath}:`, e);
    }
  }
  const joined = metaParts.join('\n').replace(/\0/g, '');
  return metaParts.length > 0 ? '\n\n[FILE METADATA]\n' + joined + '\n[/FILE METADATA]\n' : '';
}

async function extractContent(filePath, extension, provider) {
  try {
    const metadataString = await getFileMetadata(filePath, extension);
    
    const limit = (provider === 'ollama' || provider === 'lmstudio') ? 4096 : 2048;
    const textExts = ['.txt', '.csv', '.md', '.json', '.js', '.html', '.css', '.xml', '.log', '.yml', '.yaml', '.svg', '.ics', '.ical'];
    if (textExts.includes(extension)) {
      let events = [];
      // Limit to 4KB for local models, 2KB for remote APIs to save tokens
      const handle = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(limit);
      const { bytesRead } = await handle.read(buffer, 0, limit, 0);
      await handle.close();
      events.push(`Extracted ${bytesRead} bytes of text (provider limit: ${limit})`);
      return { type: 'text', content: buffer.toString('utf8', 0, bytesRead), metadataString, events };
    } 

    // Use Chromium's native decoder for AVIF and WEBP via a hidden BrowserWindow
    if (['.avif', '.webp'].includes(extension)) {
      let events = [];
      const canvasResult = await scaleImageWithCanvas(filePath, extension);
      if (canvasResult && canvasResult.base64) {
        events.push(`Processed ${extension} directly using Chromium Canvas fallback (scaled to ${canvasResult.newWidth}x${canvasResult.newHeight})`);
        return {
          type: 'image',
          mime: 'image/jpeg',
          content: canvasResult.base64,
          metadataString,
          events
        };
      }
      
      events.push(`Canvas fallback failed for ${extension}; sending original file bytes directly`);
      const buffer = await fs.readFile(filePath);
      const mimeMap = { '.avif': 'image/avif', '.webp': 'image/webp' };
      return { type: 'image', mime: mimeMap[extension] || 'application/octet-stream', content: buffer.toString('base64'), metadataString, events };
    }

    const officeExts = ['.docx', '.pptx', '.xlsx', '.odt', '.odp', '.ods', '.rtf'];
    if (officeExts.includes(extension)) {
      let events = [];
      try {
        const { parseOffice } = require('officeparser');
        const ast = await parseOffice(filePath);
        let text = ast.toText();
        if (typeof text !== 'string') {
          text = String(text || '');
        }
        const truncated = text.substring(0, limit);
        events.push(`Extracted ${truncated.length} chars of text using officeparser`);
        return { type: 'text', content: truncated, metadataString, events };
      } catch (err) {
        events.push(`officeparser failed: ${err.message}`);
        const error = new Error(`officeparser failed: ${err.message}`);
        error.aiLog = { events };
        throw error;
      }
    }

    if (extension === '.xls') {
      let events = [];
      try {
        const xlsx = require('xlsx');
        const workbook = xlsx.readFile(filePath);
        let text = '';
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          text += xlsx.utils.sheet_to_csv(sheet) + '\n';
        }
        const truncated = text.substring(0, limit);
        events.push(`Extracted ${truncated.length} chars of text from .xls using SheetJS`);
        return { type: 'text', content: truncated, metadataString, events };
      } catch (err) {
        events.push(`SheetJS xls extraction failed: ${err.message}`);
        const error = new Error(`SheetJS xls extraction failed: ${err.message}`);
        error.aiLog = { events };
        throw error;
      }
    }

    if (extension === '.doc') {
      let events = [];
      try {
        const WordExtractor = require('word-extractor');
        const extractor = new WordExtractor();
        const extracted = await extractor.extract(filePath);
        let text = extracted.getBody();
        if (typeof text !== 'string') text = String(text || '');
        const truncated = text.substring(0, limit);
        events.push(`Extracted ${truncated.length} chars of text from .doc using word-extractor`);
        return { type: 'text', content: truncated, metadataString, events };
      } catch (err) {
        events.push(`word-extractor .doc extraction failed: ${err.message}`);
        const error = new Error(`word-extractor .doc extraction failed: ${err.message}`);
        error.aiLog = { events };
        throw error;
      }
    }
    
    if (extension === '.psd') {
      let events = [];
      try {
        const { readPsd } = require('ag-psd');
        const buffer = await fs.readFile(filePath);
        const psd = readPsd(buffer, { skipLayerImageData: true, skipCompositeImageData: true, skipThumbnail: true });
        
        let text = `PSD Document\nDimensions: ${psd.width}x${psd.height}\nColor Mode: ${psd.colorMode}\n\nLayers:\n`;
        const names = [];
        function getLayers(layers, depth = 0) {
          if(!layers) return;
          layers.forEach(l => {
            if (l.name) names.push('  '.repeat(depth) + '- ' + l.name);
            getLayers(l.children, depth + 1);
          });
        }
        getLayers(psd.children);
        text += names.join('\n');
        
        const truncated = text.substring(0, limit);
        events.push(`Extracted ${truncated.length} chars of PSD layer structure using ag-psd`);
        return { type: 'text', content: truncated, metadataString, events };
      } catch (err) {
        events.push(`ag-psd extraction failed: ${err.message}`);
        const error = new Error(`ag-psd extraction failed: ${err.message}`);
        error.aiLog = { events };
        throw error;
      }
    }

    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.heic'].includes(extension)) {
      let events = [];
      
      // If it's HEIC, TIFF, or BMP, nativeImage won't handle it reliably (or at all). 
      // Skip straight to Jimp!
      if (['.heic', '.bmp', '.tiff', '.tif'].includes(extension)) {
        const jimpResult = await scaleImageWithJimp(filePath);
        if (jimpResult && jimpResult.base64) {
          events.push(`Processed ${extension} directly with Jimp/heic-decode (scaled to ${jimpResult.newWidth}x${jimpResult.newHeight})`);
          return {
            type: 'image',
            mime: 'image/jpeg',
            content: jimpResult.base64,
            metadataString,
            events
          };
        }
        
        events.push(`Jimp fallback failed for ${extension}; sending original file bytes directly`);
        const buffer = await fs.readFile(filePath);
        const mimeMap = { '.heic': 'image/heic', '.bmp': 'image/bmp', '.tiff': 'image/tiff', '.tif': 'image/tiff' };
        return { type: 'image', mime: mimeMap[extension] || 'application/octet-stream', content: buffer.toString('base64'), metadataString, events };
      }

      let image = nativeImage.createFromPath(filePath);
      
      if (image.isEmpty()) {
        const jimpResult = await scaleImageWithJimp(filePath);
        if (jimpResult && jimpResult.base64) {
          events.push(`nativeImage unsupported format; used Jimp fallback to scale from ${jimpResult.originalWidth}x${jimpResult.originalHeight} to ${jimpResult.newWidth}x${jimpResult.newHeight}`);
          return {
            type: 'image',
            mime: 'image/jpeg',
            content: jimpResult.base64,
            metadataString,
            events
          };
        }
        
        events.push('Bypassing image scaler (unsupported format for native scaling); sending original image directly');
        const buffer = await fs.readFile(filePath);
        const mimeMap = {
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif'
        };
        return { 
          type: 'image', 
          mime: mimeMap[extension] || 'image/jpeg',
          content: buffer.toString('base64'),
          metadataString,
          events
        };
      }
      
      const size = image.getSize();
      
      // Scale down to max 512px on either dimension
      if (size.width > 512 || size.height > 512) {
        const scale = Math.min(512 / size.width, 512 / size.height);
        const newWidth = Math.round(size.width * scale);
        const newHeight = Math.round(size.height * scale);
        events.push(`Scaled down image from ${size.width}x${size.height} to ${newWidth}x${newHeight}`);
        image = image.resize({ 
          width: newWidth, 
          height: newHeight 
        });
      }
      
      // Compress to 85% quality JPEG
      let buffer = image.toJPEG(85);
      
      // Fallback if toJPEG fails (returns empty buffer) for weird formats
      if (buffer.length === 0) {
        const jimpResult = await scaleImageWithJimp(filePath);
        if (jimpResult && jimpResult.base64) {
          events.push(`toJPEG failed; used Jimp fallback to scale to ${jimpResult.newWidth}x${jimpResult.newHeight}`);
          return {
            type: 'image',
            mime: 'image/jpeg',
            content: jimpResult.base64,
            metadataString,
            events
          };
        }
        
        events.push('Bypassing JPEG compression (format incompatible with scaler); sending original image directly');
        buffer = await fs.readFile(filePath);
      } else {
        events.push(`Compressed image to 85% JPEG (${buffer.length} bytes)`);
      }
      
      const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' };
      return { 
        type: 'image', 
        mime: mimeMap[extension] || 'image/jpeg',
        content: buffer.toString('base64'),
        metadataString,
        events
      };
    }

    if (extension === '.pdf') {
      return new Promise((resolve) => {
        let win = new BrowserWindow({
          show: false,
          width: 512,
          height: 600,
          webPreferences: {
            plugins: true // Enables Chrome PDF Viewer
          }
        });

        win.loadURL(`file://${filePath}#page=1`);
        
        // Wait for PDF to load and paint
        win.webContents.on('did-finish-load', () => {
          setTimeout(async () => {
            try {
              const image = await win.webContents.capturePage();
              if (!win.isDestroyed()) win.close();
              const buffer = image.toJPEG(85);
              resolve({ type: 'image', mime: 'image/jpeg', content: buffer.toString('base64'), events: [`Captured PDF first page using hidden BrowserWindow (${buffer.length} bytes)`] });
            } catch (e) {
              if (!win.isDestroyed()) win.close();
              resolve(null);
            }
          }, 1500); // 1.5 seconds is usually enough for the built-in PDF viewer to fully render the first page
        });

        // Fail-safe timeout
        setTimeout(() => {
          if (!win.isDestroyed()) {
            win.close();
            resolve(null);
          }
        }, 5000);
      });
    }

    return null;
  } catch (error) {
    console.error(`Failed to extract content for ${filePath}:`, error);
    return null;
  }
}

async function scaleImageWithJimp(filePath) {
  try {
    const Jimp = require('jimp');
    let image;
    
    if (filePath.toLowerCase().endsWith('.heic')) {
      const fs = require('fs/promises');
      const decode = require('heic-decode');
      const buffer = await fs.readFile(filePath);
      const { width, height, data } = await decode({ buffer });
      
      image = new Jimp(width, height);
      image.bitmap.data = Buffer.from(data);
    } else {
      image = await Jimp.read(filePath);
    }
    
    const originalWidth = image.bitmap.width;
    const originalHeight = image.bitmap.height;
    
    let w = originalWidth;
    let h = originalHeight;
    
    if (w > 512 || h > 512) {
      const scale = Math.min(512 / w, 512 / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      image.resize(w, h);
    }
    
    image.quality(85);
    const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);
    
    return {
      base64: buffer.toString('base64'),
      originalWidth,
      originalHeight,
      newWidth: w,
      newHeight: h
    };
  } catch (error) {
    return null;
  }
}

async function scaleImageWithCanvas(filePath, extension) {
  return new Promise(async (resolve) => {
    try {
      const fs = require('fs/promises');
      const buffer = await fs.readFile(filePath);
      const mimeMap = { '.avif': 'image/avif', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png' };
      const mime = mimeMap[extension] || 'image/jpeg';
      const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;

      let win = new BrowserWindow({
        show: false,
        webPreferences: { webSecurity: false, nodeIntegration: false, contextIsolation: true }
      });

      win.loadURL('data:text/html;charset=utf-8,<html><body></body></html>');

      win.webContents.on('did-finish-load', async () => {
        try {
          const result = await win.webContents.executeJavaScript(`
            new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                try {
                  let w = img.width;
                  let h = img.height;
                  if (w > 512 || h > 512) {
                    const scale = Math.min(512/w, 512/h);
                    w = Math.round(w * scale);
                    h = Math.round(h * scale);
                  }
                  const canvas = document.createElement('canvas');
                  canvas.width = w;
                  canvas.height = h;
                  const ctx = canvas.getContext('2d');
                  ctx.drawImage(img, 0, 0, w, h);
                  resolve({ base64: canvas.toDataURL('image/jpeg', 0.85).split(',')[1], originalWidth: img.width, originalHeight: img.height, newWidth: w, newHeight: h });
                } catch (e) {
                  resolve(null);
                }
              };
              img.onerror = () => resolve(null);
              img.src = ${JSON.stringify(dataUrl)};
            });
          `);
          if (!win.isDestroyed()) win.close();
          resolve(result);
        } catch (e) {
          if (!win.isDestroyed()) win.close();
          resolve(null);
        }
      });

      setTimeout(() => {
        if (!win.isDestroyed()) win.close();
        resolve(null);
      }, 10000);
    } catch (error) {
      resolve(null);
    }
  });
}

module.exports = { extractContent };
