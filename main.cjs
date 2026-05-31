global.DOMMatrix = class DOMMatrix { };
global.ImageData = class ImageData { };
global.Path2D = class Path2D { };

const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

const isDev = process.env.NODE_ENV === 'development';

// Pin userData to a stable path regardless of productName changes
app.setPath('userData', path.join(app.getPath('appData'), 'aifilenamer'));

let tray = null;
let mainWindow = null;
let isScanning = false;

function getPublicPath(file) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'public', file);
  }
  return path.join(__dirname, 'public', file);
}

const fs = require('fs');
const settingsPath = path.join(app.getPath('userData'), 'global-settings.json');

function getGlobalSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load global settings', e);
  }
  return { startMinimized: false };
}

function createWindow() {
  Menu.setApplicationMenu(null);

  const settings = getGlobalSettings();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: getPublicPath('favicon_green_180x180.png')
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    if (!settings.startMinimized) {
      mainWindow.show();
    }
  });

  // Hide to tray on minimize
  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  // Close app instead of hiding, with a warning if scanning
  mainWindow.on('close', (event) => {
    if (isScanning && !app.isQuitting) {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'warning',
        buttons: ['Quit', 'Cancel'],
        defaultId: 1,
        title: 'Confirm Quit',
        message: 'A scanner is currently running. Are you sure you want to quit and stop scanning?',
      });
      if (choice === 1) {
        event.preventDefault(); // Cancelled
      } else {
        app.isQuitting = true;
      }
    } else {
      app.isQuitting = true;
    }
  });
}

function createTray() {
  const idleIconPath = getPublicPath('favicon_red_180x180.png');
  const activeIconPath = getPublicPath('favicon_green_180x180.png');

  tray = new Tray(nativeImage.createFromPath(idleIconPath));

  const showAndFocus = () => {
    mainWindow.show();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  };

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: showAndFocus },
    { type: 'separator' },
    { label: 'Scanners Dashboard', click: () => { showAndFocus(); mainWindow.webContents.send('tray-action', 'nav-scanners'); } },
    { label: 'About', click: () => { showAndFocus(); mainWindow.webContents.send('tray-action', 'nav-about'); } },
    { type: 'separator' },
    {
      label: 'Quit', click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('AIFileNamer - Idle');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', showAndFocus);

  ipcMain.on('set-app-status', (event, status) => {
    isScanning = (status === 'scanning');
    if (status === 'scanning') {
      tray.setImage(nativeImage.createFromPath(activeIconPath));
      tray.setToolTip('AIFileNamer - Scanning...');
    } else {
      tray.setImage(nativeImage.createFromPath(idleIconPath));
      tray.setToolTip('AIFileNamer - Idle');
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  const settings = getGlobalSettings();
  if (settings.autoUpdateEnabled !== false) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else mainWindow.show();
  });
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) mainWindow.webContents.send('update-ready');
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-system-info', () => {
  const os = require('os');
  return {
    version: app.getVersion(),
    os: `${os.type()} ${os.release()} (${os.arch()})`
  };
});

ipcMain.handle('get-global-settings', () => {
  return getGlobalSettings();
});

ipcMain.handle('save-global-settings', (event, newSettings) => {
  const current = getGlobalSettings();
  const merged = { ...current, ...newSettings };
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

const { scanDirectory } = require('./src/backend/scanner.cjs');
const { extractContent } = require('./src/backend/extractor.cjs');
const { generateFilename, fetchModels } = require('./src/backend/ai.cjs');
const { resolveWithinBase, assertPathWithinBase } = require('./src/backend/pathUtils.cjs');

// IPC Handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('open-external', (event, url) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      shell.openExternal(parsed.href);
    }
  } catch (e) {
    // ignore invalid URLs
  }
});

ipcMain.handle('fetch-models', async (event, providerConfig) => {
  return await fetchModels(providerConfig);
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  return result.filePaths[0];
});

ipcMain.handle('scan-directory', async (event, dirPath, limit, extensions, nameFilter, nameFilterFlags) => {
  return await scanDirectory(dirPath, limit, extensions, nameFilter, nameFilterFlags);
});

ipcMain.handle('process-file', async (event, file, providerConfig, appSettings, baseDir) => {
  try {
    if (baseDir) {
      assertPathWithinBase(file.path, baseDir);
    }
    const content = await extractContent(file.path, file.extension, providerConfig.provider);
    if (!content) throw new Error('Could not extract content');

    const result = await generateFilename(providerConfig, file, content, appSettings);
    return { success: true, proposedName: result.proposedName, aiLog: result.aiLog };
  } catch (error) {
    return { success: false, error: error.message, aiLog: error.aiLog };
  }
});

ipcMain.handle('rename-files', async (event, filesToRename, baseDir) => {
  const fs = require('fs/promises');
  const results = [];

  for (const file of filesToRename) {
    try {
      if (!baseDir) throw new Error('Scanner directory is required');
      assertPathWithinBase(file.path, baseDir);

      const dirPath = path.resolve(baseDir);
      let newPath = resolveWithinBase(dirPath, file.proposedName);
      const newDirPath = path.dirname(newPath);
      let finalProposedName = file.proposedName;

      if (newPath === path.resolve(file.path)) {
        results.push({ ...file, status: 'renamed', path: newPath, proposedName: finalProposedName });
        continue;
      }

      try {
        await fs.access(newPath);

        let foundEmptySlot = false;
        const ext = path.extname(file.proposedName);
        const dirPart = path.dirname(file.proposedName);
        const base = path.basename(file.proposedName, ext);

        for (let i = 1; i <= 50; i++) {
          const testRelative = dirPart === '.' ? `${base} (${i})${ext}` : path.join(dirPart, `${base} (${i})${ext}`);
          const testPath = resolveWithinBase(dirPath, testRelative);
          try {
            await fs.access(testPath);
          } catch (e) {
            newPath = testPath;
            finalProposedName = testRelative;
            foundEmptySlot = true;
            break;
          }
        }

        if (!foundEmptySlot) {
          results.push({ ...file, status: 'error', error: 'File already exists and max suffix (50) reached' });
          continue;
        }
      } catch (e) {
        // Safe to rename
      }

      await fs.mkdir(newDirPath, { recursive: true });
      await fs.rename(file.path, newPath);
      results.push({ ...file, status: 'renamed', path: newPath, proposedName: finalProposedName });
    } catch (error) {
      results.push({ ...file, status: 'error', error: error.message });
    }
  }
  return results;
});

ipcMain.handle('undo-renames', async (event, filesToUndo, baseDir) => {
  const fs = require('fs/promises');
  const results = [];

  for (const file of filesToUndo) {
    try {
      if (!baseDir) throw new Error('Scanner directory is required');
      assertPathWithinBase(file.originalPath, baseDir);

      const dirPath = path.resolve(baseDir);
      const currentPath = resolveWithinBase(dirPath, file.proposedName);

      await fs.mkdir(path.dirname(file.originalPath), { recursive: true });
      await fs.rename(currentPath, file.originalPath);
      results.push({ ...file, status: 'undone' });
    } catch (error) {
      results.push({ ...file, status: 'error', error: error.message });
    }
  }
  return results;
});

ipcMain.handle('check-files-exist', async (event, paths, baseDir) => {
  const fs = require('fs/promises');
  const existingPaths = [];

  for (const p of paths) {
    try {
      if (baseDir) {
        assertPathWithinBase(p, baseDir);
      }
      await fs.access(p);
      existingPaths.push(p);
    } catch (e) {
      // File doesn't exist or path rejected
    }
  }
  return existingPaths;
});



