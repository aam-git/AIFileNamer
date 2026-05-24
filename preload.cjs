const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  scanDirectory: (dirPath, limit, extensions, nameFilter, nameFilterFlags) => ipcRenderer.invoke('scan-directory', dirPath, limit, extensions, nameFilter, nameFilterFlags),
  processFile: (file, providerConfig, appSettings) => ipcRenderer.invoke('process-file', file, providerConfig, appSettings),
  renameFiles: (files) => ipcRenderer.invoke('rename-files', files),
  undoRenames: (files) => ipcRenderer.invoke('undo-renames', files),
  checkFilesExist: (paths) => ipcRenderer.invoke('check-files-exist', paths),
  getSubdirectories: (dirPath, maxDepth) => ipcRenderer.invoke('get-subdirectories', dirPath, maxDepth),
  fetchModels: (config) => ipcRenderer.invoke('fetch-models', config),
  setAppStatus: (status) => ipcRenderer.send('set-app-status', status),
  onTrayAction: (callback) => ipcRenderer.on('tray-action', (_event, action) => callback(action)),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  getGlobalSettings: () => ipcRenderer.invoke('get-global-settings'),
  saveGlobalSettings: (settings) => ipcRenderer.invoke('save-global-settings', settings),
});
