export type ScanType = 'FULL' | 'DIFFERENTIAL';

export type ScanSettings = {
  scanType: ScanType;
  maxDepth: number;
  excludeHidden: boolean;
  skipSystemFolders: boolean;
  followSymlinks: boolean;
  saveActivity: boolean;
};

export const DEFAULT_SCAN_SETTINGS: ScanSettings = {
  scanType: 'DIFFERENTIAL',
  maxDepth: 3,
  excludeHidden: true,
  skipSystemFolders: true,
  followSymlinks: false,
  saveActivity: true
};

export const SCAN_SETTINGS_STORAGE_KEY = 'disk-indexer-scan-settings';