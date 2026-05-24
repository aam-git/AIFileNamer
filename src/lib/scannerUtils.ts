import type { ScannerConfig, ScannerRuntimeData } from './stores';

export const DEFAULT_CUSTOM_PROMPT =
  'Based on the following file content, suggest a concise, descriptive filename (without extension, using lowercase and underscores). Only output the filename, nothing else.';

export const DEFAULT_FOLDER_PROMPT =
  "Based on the following file content, suggest a concise, descriptive relative folder path and filename (without extension, using lowercase and underscores) to categorize the file. VERY IMPORTANT: Separate folders with a forward slash (/) and MUST start with '{baseFolder}/'. e.g., '{baseFolder}/category/sub_category/descriptive_name'. Only output the relative path and filename, nothing else.";



export function generateScannerId(): string {
  return `sc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

export function createNewScannerConfig(name = 'New Scanner'): ScannerConfig {
  return {
    id: generateScannerId(),
    name,
    createdAt: Date.now(),
    provider: 'lmstudio',
    providerSettings: {},
    apiKey: '',
    apiUrl: 'http://localhost:1234/v1',
    model: '',
    selectedDir: '',
    selectedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    nameFilter: '',
    nameFilterFlags: ['i'],
    suggestFolders: false,
    autoRun: false,
    fileLimit: 10,
    processingDelay: 2,
    customPrompt: DEFAULT_CUSTOM_PROMPT,
    customFolderPrompt: DEFAULT_FOLDER_PROMPT,
  };
}

export function createEmptyRuntimeData(): ScannerRuntimeData {
  return {
    processedHistory: {},
    errorHistory: {},
    aiLogs: [],
  };
}

/** Copy settings from one scanner config into another (excluding id, name, createdAt, selectedDir) */
export function copyConfigFrom(source: ScannerConfig, target: ScannerConfig): ScannerConfig {
  return {
    ...target,
    provider: source.provider,
    providerSettings: source.providerSettings ? JSON.parse(JSON.stringify(source.providerSettings)) : undefined,
    apiKey: source.apiKey,
    apiUrl: source.apiUrl,
    model: source.model,
    selectedExtensions: [...source.selectedExtensions],
    nameFilter: source.nameFilter ?? '',
    nameFilterFlags: source.nameFilterFlags ? [...source.nameFilterFlags] : ['i'],
    suggestFolders: source.suggestFolders,
    autoRun: source.autoRun,
    fileLimit: source.fileLimit,
    processingDelay: source.processingDelay,
    customPrompt: source.customPrompt,
    customFolderPrompt: source.customFolderPrompt,
  };
}
