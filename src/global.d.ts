export {};

declare global {
  interface Window {
    electronAPI: {
      selectDirectory: () => Promise<string | undefined>;
      scanDirectory: (dirPath: string, limit: number, extensions: string[], nameFilter?: string, nameFilterFlags?: string[]) => Promise<any[]>;
      processFile: (file: any, providerConfig: any, appSettings?: any) => Promise<{ success: boolean, proposedName?: string, error?: string, aiLog?: any }>;
      renameFiles: (files: any[]) => Promise<any[]>;
      undoRenames: (filesToUndo: { originalPath: string, proposedName: string }[]) => Promise<any[]>;
      checkFilesExist: (paths: string[]) => Promise<string[]>;
      fetchModels: (config: any) => Promise<{ success: boolean, models?: string[], error?: string }>;
      setAppStatus: (status: 'idle' | 'scanning') => void;
      onTrayAction: (callback: (action: string) => void) => void;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      openExternal: (url: string) => void;
      getSystemInfo: () => Promise<{ version: string, os: string }>;
      getGlobalSettings: () => Promise<any>;
      saveGlobalSettings: (settings: any) => Promise<{ success: boolean, error?: string }>;
    };
  }
}
