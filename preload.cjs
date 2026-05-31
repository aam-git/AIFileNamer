const { contextBridge, ipcRenderer } = require('electron');

function addListener(channel, callback) {
  const handler = (_event, ...args) => callback(...args);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  scanDirectory: (dirPath, limit, extensions, nameFilter, nameFilterFlags) =>
    ipcRenderer.invoke('scan-directory', dirPath, limit, extensions, nameFilter, nameFilterFlags),
  processFile: (file, providerConfig, appSettings, baseDir) =>
    ipcRenderer.invoke('process-file', file, providerConfig, appSettings, baseDir),
  renameFiles: (files, baseDir) => ipcRenderer.invoke('rename-files', files, baseDir),
  undoRenames: (files, baseDir) => ipcRenderer.invoke('undo-renames', files, baseDir),
  checkFilesExist: (paths, baseDir) => ipcRenderer.invoke('check-files-exist', paths, baseDir),
  fetchModels: (config) => ipcRenderer.invoke('fetch-models', config),
  setAppStatus: (status) => ipcRenderer.send('set-app-status', status),
  onTrayAction: (callback) => addListener('tray-action', callback),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  getGlobalSettings: () => ipcRenderer.invoke('get-global-settings'),
  saveGlobalSettings: (settings) => ipcRenderer.invoke('save-global-settings', settings),
  onUpdateReady: (callback) => addListener('update-ready', callback),
  installUpdate: () => ipcRenderer.send('install-update'),
});
