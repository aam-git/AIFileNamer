import Dexie, { type Table } from 'dexie';
import type { ScannerConfig, ScannerRuntimeData } from './stores';

export class AppDatabase extends Dexie {
  appSettings!: Table<{ key: string; value: any }, string>;
  
  // Isolated tables per scanner
  configs!: Table<ScannerConfig, string>;
  runtimeData!: Table<ScannerRuntimeData & { scannerId: string }, string>;
  files!: Table<{ scannerId: string; files: any[] }, string>;
  delaying!: Table<{ scannerId: string; isDelaying: boolean }, string>;

  constructor() {
    super('AIFileNamerDB');
    this.version(4).stores({
      appSettings: 'key',
      configs: 'id', // Primary key is the scanner ID
      runtimeData: 'scannerId',
      files: 'scannerId',
      delaying: 'scannerId'
    });
  }
}

export const db = new AppDatabase();
