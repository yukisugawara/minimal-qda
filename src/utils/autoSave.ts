/**
 * Auto-save engine for Google Drive.
 * Subscribes to Zustand store changes, debounces, and writes to Drive.
 */

import { useAppStore } from '../store/useAppStore';
import type { ProjectData } from '../store/useAppStore';
import {
  loadGisScript,
  requestAccessToken,
  isTokenValid,
  revokeToken,
  isGoogleDriveConfigured,
  createFile,
  updateFile,
  fileExists,
  DriveApiError,
} from './googleDrive';
import type { GoogleToken } from './googleDrive';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface AutoSaveConfig {
  folderId: string;
  folderName: string;
  fileName: string;
  driveFileId: string | null;
}

type Listener = (status: AutoSaveStatus) => void;

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

let token: GoogleToken | null = null;
let config: AutoSaveConfig | null = null;
let status: AutoSaveStatus = 'idle';
let enabled = false;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;

const listeners = new Set<Listener>();

const DEBOUNCE_MS = 3000;
const STORAGE_KEY_TOKEN = 'mqda_drive_token';
const STORAGE_KEY_CONFIG = 'mqda_drive_config';

/* ------------------------------------------------------------------ */
/*  Status broadcast                                                   */
/* ------------------------------------------------------------------ */

function setStatus(next: AutoSaveStatus) {
  status = next;
  listeners.forEach((fn) => fn(next));
}

export function getAutoSaveStatus(): AutoSaveStatus {
  return status;
}

export function subscribeAutoSaveStatus(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ------------------------------------------------------------------ */
/*  Getters                                                            */
/* ------------------------------------------------------------------ */

export function getToken(): GoogleToken | null {
  return token;
}

export function getConfig(): AutoSaveConfig | null {
  return config;
}

export function isAutoSaveEnabled(): boolean {
  return enabled;
}

/* ------------------------------------------------------------------ */
/*  Auth                                                               */
/* ------------------------------------------------------------------ */

export async function signIn(): Promise<GoogleToken> {
  await loadGisScript();
  const t = await requestAccessToken();
  token = t;
  persistToken(t);
  return t;
}

export async function signOut(): Promise<void> {
  stopAutoSave();
  if (token) {
    try {
      await loadGisScript();
      await revokeToken(token.access_token);
    } catch { /* ignore */ }
  }
  token = null;
  config = null;
  clearStorage();
  setStatus('idle');
}

/** Ensure we have a valid token, re-authenticating if needed. */
async function ensureToken(): Promise<string> {
  if (isTokenValid(token)) return token!.access_token;
  // Token expired — request a new one
  const t = await signIn();
  return t.access_token;
}

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

export function setConfig(cfg: AutoSaveConfig): void {
  config = cfg;
  persistConfig(cfg);
}

/* ------------------------------------------------------------------ */
/*  Auto-save control                                                  */
/* ------------------------------------------------------------------ */

export function startAutoSave(): void {
  if (enabled) return;
  enabled = true;

  // Subscribe to Zustand store — compare data-only fields to skip UI-only changes
  let prevSnapshot = snapshotKey(useAppStore.getState());
  unsubscribe = useAppStore.subscribe((state) => {
    const next = snapshotKey(state);
    if (next !== prevSnapshot) {
      prevSnapshot = next;
      scheduleSave();
    }
  });

  setStatus('idle');
}

export function stopAutoSave(): void {
  enabled = false;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  setStatus('idle');
}

function scheduleSave() {
  if (!enabled) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  setStatus('pending');
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void performSave();
  }, DEBOUNCE_MS);
}

async function performSave(): Promise<void> {
  if (!config) return;
  setStatus('saving');

  try {
    const accessToken = await ensureToken();
    const data = pickProjectData(useAppStore.getState());
    const content = JSON.stringify({ version: 1, data }, null, 2);

    // Check if the file still exists
    if (config.driveFileId) {
      const exists = await fileExists(accessToken, config.driveFileId);
      if (!exists) {
        config.driveFileId = null;
        persistConfig(config);
      }
    }

    if (config.driveFileId) {
      await updateFile(accessToken, config.driveFileId, content);
    } else {
      const fileId = await createFile(accessToken, config.fileName, config.folderId, content);
      config.driveFileId = fileId;
      persistConfig(config);
    }

    setStatus('saved');
  } catch (err) {
    console.error('[autoSave] Save failed:', err);
    // On 401/403, clear token so next attempt re-authenticates
    if (err instanceof DriveApiError && (err.status === 401 || err.status === 403)) {
      token = null;
      clearPersistedToken();
    }
    setStatus('error');
  }
}

/* ------------------------------------------------------------------ */
/*  Init from storage (on app startup)                                 */
/* ------------------------------------------------------------------ */

export async function initAutoSaveFromStorage(): Promise<void> {
  if (!isGoogleDriveConfigured()) return;

  const storedToken = loadPersistedToken();
  const storedConfig = loadPersistedConfig();
  if (!storedToken || !storedConfig) return;

  // If token is expired, we'll re-authenticate on first save attempt
  token = storedToken;
  config = storedConfig;

  startAutoSave();
}

/* ------------------------------------------------------------------ */
/*  Project data extraction                                            */
/* ------------------------------------------------------------------ */

/** Quick hash of data fields to detect meaningful changes (ignores UI state). */
function snapshotKey(state: ReturnType<typeof useAppStore.getState>): string {
  // We only care about data fields, not UI state like selectedCodeId, theme, etc.
  return JSON.stringify([
    state.files,
    state.activeFileId,
    state.codes,
    state.memos,
    state.codeLinks,
    state.theoryLabel,
  ]);
}

function pickProjectData(state: ReturnType<typeof useAppStore.getState>): ProjectData {
  return {
    files: state.files,
    activeFileId: state.activeFileId,
    codes: state.codes,
    memos: state.memos,
    codeLinks: state.codeLinks,
    theoryLabel: state.theoryLabel,
  };
}

/* ------------------------------------------------------------------ */
/*  localStorage persistence                                           */
/* ------------------------------------------------------------------ */

function persistToken(t: GoogleToken) {
  try {
    localStorage.setItem(STORAGE_KEY_TOKEN, JSON.stringify(t));
  } catch { /* quota exceeded — ignore */ }
}

function clearPersistedToken() {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
}

function loadPersistedToken(): GoogleToken | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (!raw) return null;
    return JSON.parse(raw) as GoogleToken;
  } catch {
    return null;
  }
}

function persistConfig(cfg: AutoSaveConfig) {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(cfg));
  } catch { /* ignore */ }
}

function loadPersistedConfig(): AutoSaveConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) return null;
    return JSON.parse(raw) as AutoSaveConfig;
  } catch {
    return null;
  }
}

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  localStorage.removeItem(STORAGE_KEY_CONFIG);
}
