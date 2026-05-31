import type { ScannerConfig, ScannerRuntimeData } from './stores';
import {
  DEFAULT_CUSTOM_PROMPT,
  DEFAULT_FOLDER_PROMPT,
  defaultApiUrlForProvider,
} from './aiDefaults';

export { DEFAULT_CUSTOM_PROMPT, DEFAULT_FOLDER_PROMPT, defaultApiUrlForProvider };



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
