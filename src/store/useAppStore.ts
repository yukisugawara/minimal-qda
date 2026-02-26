import { create } from 'zustand';

/** Bounding box for image/PDF rectangle selection (relative ratios 0-1) */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number; // PDF page number (0-based)
}

export interface FileEntry {
  id: string;
  fileName: string;
  fileContent: string | null;
  fileType: string;
  fileDataUrl: string | null;
}

export interface Code {
  id: string;
  text: string;
  color: string;
  parentId: string | null;
  order: number;
  fileId: string;
  // Text markers
  startOffset: number;
  endOffset: number;
  // Image/PDF rectangle markers
  boundingBox?: BoundingBox;
}

export interface Memo {
  id: string;
  codeId: string | null;
  content: string;
  createdAt: number;
  parentId: string | null;  // parent memo ID (null = root)
  order: number;            // sibling sort order
}

export interface CodeLink {
  id: string;
  sourceCodeId: string;
  targetCodeId: string;
  label: string;
}

export interface ProjectData {
  files?: FileEntry[];
  activeFileId?: string | null;
  // Legacy single-file fields (for backward compatibility)
  fileName?: string | null;
  fileContent?: string | null;
  fileType?: string | null;
  fileDataUrl?: string | null;
  codes: Code[];
  memos: Memo[];
  codeLinks?: CodeLink[];
  theoryLabel?: string;
}

export interface AppState {
  // Files
  files: FileEntry[];
  activeFileId: string | null;

  // Codes
  codes: Code[];

  // Memos
  memos: Memo[];

  // Code links
  codeLinks: CodeLink[];

  // Theory
  theoryLabel: string;

  // UI state
  selectedCodeId: string | null;
  activeMarkerColor: string;
  codingMode: 'in-vivo' | 'interpretive';
  theme: 'light' | 'dark';

  // Actions
  addFile: (file: FileEntry) => void;
  removeFile: (fileId: string) => void;
  setActiveFileId: (fileId: string) => void;
  addCode: (code: Code) => void;
  removeCode: (id: string) => void;
  addMemo: (memo: Memo) => void;
  updateMemo: (id: string, content: string) => void;
  removeMemo: (id: string) => void;
  moveMemo: (memoId: string, newParentId: string | null, newOrder: number) => void;
  addGroup: (name: string) => void;
  moveCode: (codeId: string, newParentId: string | null, newOrder: number) => void;
  updateCodeText: (codeId: string, text: string) => void;
  updateCodeColor: (codeId: string, color: string) => void;
  restoreState: (data: ProjectData) => void;
  setSelectedCodeId: (id: string | null) => void;
  setActiveMarkerColor: (color: string) => void;
  addCodeLink: (link: CodeLink) => void;
  removeCodeLink: (id: string) => void;
  updateCodeLinkLabel: (id: string, label: string) => void;
  setTheoryLabel: (label: string) => void;
  setCodingMode: (mode: 'in-vivo' | 'interpretive') => void;
  toggleTheme: () => void;
}

export const MARKER_COLORS = [
  '#E57373', // Red
  '#F06292', // Pink
  '#BA68C8', // Purple
  '#9575CD', // Deep Purple
  '#7986CB', // Indigo
  '#64B5F6', // Blue
  '#4FC3F7', // Light Blue
  '#4DD0E1', // Cyan
  '#4DB6AC', // Teal
  '#81C784', // Green
  '#DCE775', // Lime
  '#FFF176', // Yellow
  '#FFD54F', // Amber
  '#FFB74D', // Orange
  '#FF8A65', // Deep Orange
  '#A1887F', // Brown
  '#E0E0E0', // Grey
  '#90A4AE', // Blue Grey
];

let groupIdCounter = 0;
function nextGroupId() {
  return `group-${++groupIdCounter}-${Date.now()}`;
}

let fileIdCounter = 0;
export function nextFileId() {
  return `file-${++fileIdCounter}-${Date.now()}`;
}

export const useAppStore = create<AppState>((set) => ({
  files: [],
  activeFileId: null,
  codes: [],
  memos: [],
  codeLinks: [],
  theoryLabel: '',
  selectedCodeId: null,
  activeMarkerColor: MARKER_COLORS[0],
  codingMode: 'in-vivo',
  theme: (localStorage.getItem('theme') as 'light' | 'dark') || 'light',

  addFile: (file) =>
    set((state) => ({
      files: [...state.files, file],
      activeFileId: file.id,
    })),

  removeFile: (fileId) =>
    set((state) => {
      const newFiles = state.files.filter((f) => f.id !== fileId);
      // Remove codes and their memos tied to this file
      const removedCodeIds = new Set(state.codes.filter((c) => c.fileId === fileId).map((c) => c.id));
      const newCodes = state.codes.filter((c) => c.fileId !== fileId);
      const newMemos = state.memos.filter((m) => !m.codeId || !removedCodeIds.has(m.codeId));
      // Switch active file
      let newActiveFileId = state.activeFileId;
      if (state.activeFileId === fileId) {
        newActiveFileId = newFiles.length > 0 ? newFiles[0].id : null;
      }
      return {
        files: newFiles,
        activeFileId: newActiveFileId,
        codes: newCodes,
        memos: newMemos,
        codeLinks: state.codeLinks.filter(
          (l) => !removedCodeIds.has(l.sourceCodeId) && !removedCodeIds.has(l.targetCodeId)
        ),
        selectedCodeId: removedCodeIds.has(state.selectedCodeId ?? '') ? null : state.selectedCodeId,
      };
    }),

  setActiveFileId: (fileId) => set({ activeFileId: fileId, selectedCodeId: null }),

  addCode: (code) =>
    set((state) => {
      // Auto-set order to end of siblings (same parent AND same file)
      const siblings = state.codes.filter(
        (c) => c.parentId === code.parentId && c.fileId === code.fileId
      );
      const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((c) => c.order)) : -1;
      return { codes: [...state.codes, { ...code, order: maxOrder + 1 }] };
    }),

  removeCode: (id) =>
    set((state) => {
      const target = state.codes.find((c) => c.id === id);
      if (!target) return state;
      // Promote children to target's parent
      const newCodes = state.codes
        .filter((c) => c.id !== id)
        .map((c) => (c.parentId === id ? { ...c, parentId: target.parentId } : c));
      return {
        codes: newCodes,
        memos: state.memos.filter((m) => m.codeId !== id),
        codeLinks: state.codeLinks.filter((l) => l.sourceCodeId !== id && l.targetCodeId !== id),
        selectedCodeId: state.selectedCodeId === id ? null : state.selectedCodeId,
      };
    }),

  addMemo: (memo) =>
    set((state) => {
      const siblings = state.memos.filter((m) => m.parentId === memo.parentId);
      const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((m) => m.order)) : -1;
      return { memos: [...state.memos, { ...memo, order: maxOrder + 1 }] };
    }),

  updateMemo: (id, content) =>
    set((state) => ({
      memos: state.memos.map((m) => (m.id === id ? { ...m, content } : m)),
    })),

  removeMemo: (id) =>
    set((state) => {
      const target = state.memos.find((m) => m.id === id);
      if (!target) return state;
      // Promote children to target's parent
      const newMemos = state.memos
        .filter((m) => m.id !== id)
        .map((m) => (m.parentId === id ? { ...m, parentId: target.parentId } : m));
      return { memos: newMemos };
    }),

  moveMemo: (memoId, newParentId, newOrder) =>
    set((state) => ({
      memos: state.memos.map((m) =>
        m.id === memoId ? { ...m, parentId: newParentId, order: newOrder } : m
      ),
    })),

  addGroup: (name) =>
    set((state) => {
      const activeFileId = state.activeFileId;
      if (!activeFileId) return state;
      const rootSiblings = state.codes.filter(
        (c) => c.parentId === null && c.fileId === activeFileId
      );
      const maxOrder = rootSiblings.length > 0 ? Math.max(...rootSiblings.map((c) => c.order)) : -1;
      const group: Code = {
        id: nextGroupId(),
        text: name,
        color: '#9CA3AF',
        parentId: null,
        order: maxOrder + 1,
        fileId: activeFileId,
        startOffset: 0,
        endOffset: 0,
      };
      return { codes: [...state.codes, group] };
    }),

  moveCode: (codeId, newParentId, newOrder) =>
    set((state) => ({
      codes: state.codes.map((c) =>
        c.id === codeId ? { ...c, parentId: newParentId, order: newOrder } : c
      ),
    })),

  updateCodeText: (codeId, text) =>
    set((state) => ({
      codes: state.codes.map((c) =>
        c.id === codeId ? { ...c, text } : c
      ),
    })),

  updateCodeColor: (codeId, color) =>
    set((state) => ({
      codes: state.codes.map((c) =>
        c.id === codeId ? { ...c, color } : c
      ),
    })),

  restoreState: (data) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = data as any;

    // --- Resolve files ---
    let files: FileEntry[] = [];
    let activeFileId: string | null = null;

    if (raw.files && Array.isArray(raw.files) && raw.files.length > 0) {
      // New multi-file format
      files = raw.files;
      activeFileId = raw.activeFileId ?? files[0]?.id ?? null;
    } else if (raw.fileName) {
      // Legacy single-file format → migrate
      const legacyId = 'file-legacy-1';
      files = [
        {
          id: legacyId,
          fileName: raw.fileName,
          fileContent: raw.fileContent ?? null,
          fileType: raw.fileType ?? '',
          fileDataUrl: raw.fileDataUrl ?? null,
        },
      ];
      activeFileId = legacyId;
    }

    let codes: Code[] = raw.codes ?? [];

    // Migration: convert old format with categories
    if (raw.categories && Array.isArray(raw.categories) && raw.categories.length > 0) {
      const groupCodes: Code[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      raw.categories.forEach((cat: any, idx: number) => {
        groupCodes.push({
          id: `migrated-cat-${cat.id}`,
          text: cat.name,
          color: cat.color ?? '#9CA3AF',
          parentId: null,
          order: idx,
          fileId: activeFileId ?? '',
          startOffset: 0,
          endOffset: 0,
        });
      });

      // Convert child codes: categoryId → parentId
      const orderCounter: Record<string, number> = {};
      codes = codes.map((c) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const oldCatId = (c as any).categoryId;
        const newParentId = oldCatId ? `migrated-cat-${oldCatId}` : null;
        const key = newParentId ?? '__root__';
        if (!(key in orderCounter)) orderCounter[key] = groupCodes.filter((g) => g.parentId === null).length;
        const order = orderCounter[key]++;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { categoryId: _, ...rest } = c as any;
        return { ...rest, parentId: newParentId, order, fileId: activeFileId ?? '' } as Code;
      });

      codes = [...groupCodes, ...codes];
    }

    // Ensure all codes have parentId, order, and fileId fields
    let rootOrder = 0;
    const defaultFileId = activeFileId ?? '';
    codes = codes.map((c) => ({
      ...c,
      parentId: c.parentId ?? null,
      order: c.order ?? rootOrder++,
      fileId: c.fileId ?? defaultFileId,
    }));

    // Ensure all memos have parentId and order fields (backward compat)
    let memoOrder = 0;
    const memos: Memo[] = (data.memos ?? []).map((m) => ({
      ...m,
      parentId: m.parentId ?? null,
      order: m.order ?? memoOrder++,
    }));

    set({
      files,
      activeFileId,
      codes,
      memos,
      codeLinks: data.codeLinks ?? [],
      theoryLabel: raw.theoryLabel ?? '',
      selectedCodeId: null,
      activeMarkerColor: MARKER_COLORS[0],
    });
  },

  setSelectedCodeId: (id) => set({ selectedCodeId: id }),

  setActiveMarkerColor: (color) => set({ activeMarkerColor: color }),

  addCodeLink: (link) =>
    set((state) => ({ codeLinks: [...state.codeLinks, link] })),

  removeCodeLink: (id) =>
    set((state) => ({ codeLinks: state.codeLinks.filter((l) => l.id !== id) })),

  updateCodeLinkLabel: (id, label) =>
    set((state) => ({
      codeLinks: state.codeLinks.map((l) => (l.id === id ? { ...l, label } : l)),
    })),

  setTheoryLabel: (label) => set({ theoryLabel: label }),

  setCodingMode: (mode) => set({ codingMode: mode }),

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      return { theme: next };
    }),
}));
