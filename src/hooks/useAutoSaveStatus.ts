import { useSyncExternalStore } from 'react';
import {
  getAutoSaveStatus,
  subscribeAutoSaveStatus,
  isAutoSaveEnabled,
  getToken,
  getConfig,
} from '../utils/autoSave';
import type { AutoSaveStatus, AutoSaveConfig } from '../utils/autoSave';
import type { GoogleToken } from '../utils/googleDrive';

export function useAutoSaveStatus(): AutoSaveStatus {
  return useSyncExternalStore(subscribeAutoSaveStatus, getAutoSaveStatus);
}

export function useIsAutoSaveEnabled(): boolean {
  return useSyncExternalStore(subscribeAutoSaveStatus, isAutoSaveEnabled);
}

export function useGoogleToken(): GoogleToken | null {
  return useSyncExternalStore(subscribeAutoSaveStatus, getToken);
}

export function useAutoSaveConfig(): AutoSaveConfig | null {
  return useSyncExternalStore(subscribeAutoSaveStatus, getConfig);
}
