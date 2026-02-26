import type { ProjectData } from '../store/useAppStore';

const MQDA_VERSION = 1;

interface MqdaFile {
  version: number;
  data: ProjectData;
}

/* ------------------------------------------------------------------ */
/*  File handle persistence (File System Access API)                  */
/* ------------------------------------------------------------------ */

/** The handle for the currently-opened .mqda file (Chrome / Edge only). */
let savedFileHandle: FileSystemFileHandle | null = null;

/** Whether the browser supports the File System Access API (folder picker). */
export function supportsNativeSave(): boolean {
  return typeof window.showSaveFilePicker === 'function';
}

/** Whether we have a reusable file handle for overwrite-save. */
export function hasSavedFileHandle(): boolean {
  return savedFileHandle !== null;
}

/** Forget the current file handle (e.g. when starting a new project). */
export function clearSavedFileHandle() {
  savedFileHandle = null;
}

/* ------------------------------------------------------------------ */
/*  Save                                                               */
/* ------------------------------------------------------------------ */

/**
 * Save the project.
 * - If we already hold a file handle, overwrite-save silently.
 * - Otherwise show a "Save As" dialog (or download fallback).
 */
export async function saveProject(data: ProjectData, suggestedName?: string) {
  // 1. If we already have a handle → overwrite-save
  if (savedFileHandle) {
    try {
      const blob = buildBlob(data);
      const writable = await savedFileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch {
      // Permission revoked or file moved — fall through to "Save As"
      savedFileHandle = null;
    }
  }

  // 2. No handle yet → "Save As"
  await saveProjectAs(data, suggestedName);
}

/**
 * Always show the "Save As" dialog regardless of existing handle.
 * On Chrome/Edge a native folder-picker dialog appears.
 * On Safari/Firefox a download is triggered instead.
 */
export async function saveProjectAs(data: ProjectData, suggestedName?: string) {
  const blob = buildBlob(data);
  const defaultName = deriveDefaultName(data, suggestedName);

  // Use File System Access API if available (Chrome / Edge)
  if (supportsNativeSave()) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: `${defaultName}.mqda`,
        types: [
          {
            description: 'MinimalQDA Project',
            accept: { 'application/json': ['.mqda'] },
          },
        ],
      });
      savedFileHandle = handle;
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      // User cancelled the dialog
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Other errors: fall through to legacy method
    }
  }

  // Fallback: download to browser default location
  downloadBlob(blob, defaultName);
}

/* ------------------------------------------------------------------ */
/*  Load                                                               */
/* ------------------------------------------------------------------ */

/** Read a .mqda file and return the project data. */
export async function loadProject(file: File): Promise<ProjectData> {
  const text = await file.text();
  const parsed: MqdaFile = JSON.parse(text);

  if (!parsed.version || !parsed.data) {
    throw new Error('Invalid .mqda file format');
  }

  return parsed.data;
}

/**
 * Open a .mqda file using the File System Access API picker.
 * Returns the project data and remembers the file handle for overwrite-save.
 * Falls back to null if the API is unavailable or user cancels.
 */
export async function openProjectWithPicker(): Promise<ProjectData | null> {
  if (!supportsNativeSave()) return null;

  try {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'MinimalQDA Project',
          accept: { 'application/json': ['.mqda'] },
        },
      ],
    });
    const file = await handle.getFile();
    const data = await loadProject(file);
    savedFileHandle = handle;
    return data;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildBlob(data: ProjectData): Blob {
  const payload: MqdaFile = { version: MQDA_VERSION, data };
  const json = JSON.stringify(payload, null, 2);
  return new Blob([json], { type: 'application/json' });
}

function deriveDefaultName(data: ProjectData, suggestedName?: string): string {
  if (suggestedName) return suggestedName;
  if (data.files && data.files.length > 0) {
    const activeFile = data.activeFileId
      ? data.files.find((f) => f.id === data.activeFileId)
      : data.files[0];
    if (activeFile) {
      return activeFile.fileName.replace(/\.[^.]+$/, '');
    }
  }
  return 'project';
}

function downloadBlob(blob: Blob, defaultName: string) {
  const safeName = defaultName.endsWith('.mqda') ? defaultName : `${defaultName}.mqda`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  a.click();
  URL.revokeObjectURL(url);
}
