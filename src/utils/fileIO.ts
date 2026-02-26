import type { ProjectData } from '../store/useAppStore';

const MQDA_VERSION = 1;

interface MqdaFile {
  version: number;
  data: ProjectData;
}

/** Save the project via native "Save As" dialog when available, otherwise fallback to download */
export async function saveProject(data: ProjectData, suggestedName?: string) {
  const payload: MqdaFile = { version: MQDA_VERSION, data };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  // Derive default name from the active file
  let defaultName = suggestedName ?? 'project';
  if (!suggestedName && data.files && data.files.length > 0) {
    const activeFile = data.activeFileId
      ? data.files.find((f) => f.id === data.activeFileId)
      : data.files[0];
    if (activeFile) {
      defaultName = activeFile.fileName.replace(/\.[^.]+$/, '');
    }
  }

  // Use File System Access API if available (Chrome / Edge)
  if ('showSaveFilePicker' in window) {
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
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      // User cancelled the dialog — do nothing
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Other errors: fall through to legacy method
    }
  }

  // Fallback: prompt for name, then download
  const name = prompt(promptLabel(), defaultName);
  if (!name) return; // cancelled
  const safeName = name.endsWith('.mqda') ? name : `${name}.mqda`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  a.click();
  URL.revokeObjectURL(url);
}

function promptLabel(): string {
  try {
    const lang = document.documentElement.lang || navigator.language;
    if (lang.startsWith('ja')) return 'プロジェクト名を入力してください:';
  } catch { /* ignore */ }
  return 'Enter project name:';
}

/** Read a .mqda file and return the project data */
export async function loadProject(file: File): Promise<ProjectData> {
  const text = await file.text();
  const parsed: MqdaFile = JSON.parse(text);

  if (!parsed.version || !parsed.data) {
    throw new Error('Invalid .mqda file format');
  }

  return parsed.data;
}
