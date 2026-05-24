import { writable } from 'svelte/store';
import { db } from './db';

// ─────────────────────────────────────────────────────────────────────────────
// Data Types
// ─────────────────────────────────────────────────────────────────────────────

export type HistoryEntry = { newName: string; timestamp: number };

export interface ScannerConfig {
  id: string;
  name: string;
  createdAt: number;

  // AI Provider
  provider: string;
  providerSettings?: Record<string, { apiKey: string; apiUrl: string; model: string; }>;
  apiKey: string;
  apiUrl: string;
  model: string;

  // Scan Settings
  selectedDir: string;
  selectedExtensions: string[];
  nameFilter: string;
  nameFilterFlags: string[];
  suggestFolders: boolean;
  autoRun: boolean;
  fileLimit: number;
  processingDelay: number;
  customPrompt: string;
  customFolderPrompt: string;
}

export interface ScannerRuntimeData {
  processedHistory: Record<string, HistoryEntry | string>;
  errorHistory: Record<string, number>;
  aiLogs: any[];
}

export interface ScannersStoreData {
  configs: ScannerConfig[];
  runtimeData: Record<string, ScannerRuntimeData>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Persisted Stores
// ─────────────────────────────────────────────────────────────────────────────

export const isDbReadyStore = writable<boolean>(false);

const DEFAULT_SCANNERS_DATA: ScannersStoreData = { configs: [], runtimeData: {} };

export const scannersStore = writable<ScannersStoreData>(DEFAULT_SCANNERS_DATA);
export const activeScannerIdStore = writable<string>('');

// In-Memory Runtime Stores (now persisted to IndexedDB)
export const scannerFilesStore = writable<Record<string, any[]>>({});
export const scannerDelayingStore = writable<Record<string, boolean>>({});

// Live status per scanner (set by ScanPanel, read by Sidebar/Overview)
export interface ScannerLiveStatus {
  isScanning: boolean;
  isProcessing: boolean;
  isDelaying: boolean;
  isWaiting: boolean;
  countdown: number;
  isPaused: boolean;
}

// Live status doesn't strictly need persistence, but we can if desired. Usually, it's transient.
export const scannerLiveStatusStore = writable<Record<string, ScannerLiveStatus>>({});

// Initialize stores from Dexie
async function initDbStores() {
  try {
    // Wipe all localStorage (no backwards compatibility, start afresh)
    localStorage.clear();

    // Load from Isolated Dexie Tables
    const configs = await db.configs.toArray();
    const runtimeDataArray = await db.runtimeData.toArray();
    const filesArray = await db.files.toArray();
    const delayingArray = await db.delaying.toArray();

    const runtimeDataMap: Record<string, ScannerRuntimeData> = {};
    for (const r of runtimeDataArray) {
      const { scannerId, ...data } = r;
      runtimeDataMap[scannerId] = data as ScannerRuntimeData;
    }
    scannersStore.set({ configs, runtimeData: runtimeDataMap });

    const filesMap: Record<string, any[]> = {};
    for (const f of filesArray) {
      filesMap[f.scannerId] = f.files;
    }
    scannerFilesStore.set(filesMap);

    const delayingMap: Record<string, boolean> = {};
    for (const d of delayingArray) {
      delayingMap[d.scannerId] = d.isDelaying;
    }
    scannerDelayingStore.set(delayingMap);

    const activeScannerRow = await db.appSettings.get('aifilenamer_activeScanner');
    if (activeScannerRow) {
      activeScannerIdStore.set(activeScannerRow.value);
    }

  } catch (error) {
    console.error('Failed to initialize DB stores', error);
  } finally {
    isDbReadyStore.set(true);

    // Setup subscriptions to save back to Dexie isolated tables
    let scannersTimeout: any;
    scannersStore.subscribe(value => {
      clearTimeout(scannersTimeout);
      scannersTimeout = setTimeout(async () => {
        try {
          // Put all configs individually
          if (value.configs.length > 0) {
            await db.configs.bulkPut(value.configs);
          }

          // Put all runtimeData individually
          const rDataToPut = Object.entries(value.runtimeData).map(([scannerId, data]) => ({
            scannerId,
            ...data
          }));
          if (rDataToPut.length > 0) {
            await db.runtimeData.bulkPut(rDataToPut);
          }

          // Delete orphaned scanners (if a scanner was deleted from the UI)
          const existingConfigIds = value.configs.map(c => c.id);
          const dbConfigs = await db.configs.toArray();
          const toDelete = dbConfigs.map(c => c.id).filter(id => !existingConfigIds.includes(id));
          
          if (toDelete.length > 0) {
            await db.configs.bulkDelete(toDelete);
            await db.runtimeData.bulkDelete(toDelete);
            await db.files.bulkDelete(toDelete);
            await db.delaying.bulkDelete(toDelete);
          }
        } catch (err) {
          console.error('Failed to save scanners to DB', err);
        }
      }, 500);
    });

    activeScannerIdStore.subscribe(value => {
      db.appSettings.put({ key: 'aifilenamer_activeScanner', value }).catch(err => {
        console.error('Failed to save active scanner to DB', err);
      });
    });

    let filesTimeout: any;
    scannerFilesStore.subscribe(value => {
      clearTimeout(filesTimeout);
      filesTimeout = setTimeout(async () => {
        try {
          const filesToPut = Object.entries(value).map(([scannerId, files]) => ({
            scannerId, files
          }));
          if (filesToPut.length > 0) {
            await db.files.bulkPut(filesToPut);
          }
        } catch (err) {
          console.error('Failed to save scanner files to DB', err);
        }
      }, 1000); // 1s debounce for files as they can be large
    });

    let delayingTimeout: any;
    scannerDelayingStore.subscribe(value => {
      clearTimeout(delayingTimeout);
      delayingTimeout = setTimeout(async () => {
        try {
          const delayingToPut = Object.entries(value).map(([scannerId, isDelaying]) => ({
            scannerId, isDelaying
          }));
          if (delayingToPut.length > 0) {
            await db.delaying.bulkPut(delayingToPut);
          }
        } catch (err) {
          console.error('Failed to save scanner delaying state to DB', err);
        }
      }, 500);
    });
  }
}

initDbStores();
