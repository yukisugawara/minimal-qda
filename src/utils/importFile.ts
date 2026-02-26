import mammoth from 'mammoth';
import { nextFileId } from '../store/useAppStore';
import type { FileEntry } from '../store/useAppStore';
import { loadProject, clearSavedFileHandle } from './fileIO';

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg']);
const BINARY_EXTS = new Set(['png', 'jpg', 'jpeg', 'pdf']);
const SUPPORTED_EXTS = new Set(['txt', 'md', 'xml', 'pdf', 'png', 'jpg', 'jpeg', 'docx', 'mqda']);

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Process a single file and return a FileEntry, or restore a project if .mqda.
 * Returns { type: 'file', entry } for normal files, or { type: 'project', data } for .mqda.
 */
export async function importFile(
  file: File,
): Promise<
  | { type: 'file'; entry: FileEntry }
  | { type: 'project'; data: ReturnType<typeof loadProject> extends Promise<infer T> ? T : never }
  | null
> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (!SUPPORTED_EXTS.has(ext)) return null;

  if (ext === 'mqda') {
    try {
      clearSavedFileHandle();
      const data = await loadProject(file);
      return { type: 'project', data };
    } catch {
      alert('Failed to load project file.');
      return null;
    }
  }

  const entry: FileEntry = {
    id: nextFileId(),
    fileName: file.name,
    fileContent: null,
    fileType: ext,
    fileDataUrl: null,
  };

  if (ext === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    entry.fileContent = result.value;
  } else if (BINARY_EXTS.has(ext)) {
    const dataUrl = await readAsDataURL(file);
    entry.fileContent = IMAGE_EXTS.has(ext) ? `[Image] ${file.name}` : file.name;
    entry.fileDataUrl = dataUrl;
  } else {
    entry.fileContent = await file.text();
  }

  return { type: 'file', entry };
}
