import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import mammoth from 'mammoth';
import { useAppStore, nextFileId } from '../store/useAppStore';
import type { FileEntry } from '../store/useAppStore';
import { saveProject, loadProject } from '../utils/fileIO';
import { exportHTML } from '../utils/exportHTML';
import { exportCSV } from '../utils/exportCSV';
import { Logo } from './Logo';

const ACCEPTED_TYPES = '.txt,.md,.xml,.pdf,.png,.jpg,.jpeg,.docx,.mqda';
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg']);
const BINARY_EXTS = new Set(['png', 'jpg', 'jpeg', 'pdf']);

interface HeaderProps {
  onOpenMap: () => void;
  onResetLayout: () => void;
}

function HeaderButton({
  onClick,
  label,
  tooltip,
  icon,
}: {
  onClick: () => void;
  label: string;
  tooltip: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/25 hover:border-white/35 active:scale-95 transition-all shadow-sm hover:shadow-md"
      >
        <span className="flex-shrink-0 opacity-90 group-hover:opacity-100 transition-opacity">
          {icon}
        </span>
        <span>{label}</span>
      </button>
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-1.5 text-xs rounded-lg bg-gray-900/90 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 shadow-lg z-50">
        {tooltip}
        <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-gray-900/90 rotate-45" />
      </div>
    </div>
  );
}

/* --- Icon components --- */

function ImportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 10V12.5C2.5 13.05 2.95 13.5 3.5 13.5H12.5C13.05 13.5 13.5 13.05 13.5 12.5V10" />
      <path d="M8 2.5V10" />
      <path d="M5 7L8 10L11 7" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.5 13.5H3.5C2.95 13.5 2.5 13.05 2.5 12.5V3.5C2.5 2.95 2.95 2.5 3.5 2.5H10.5L13.5 5.5V12.5C13.5 13.05 13.05 13.5 12.5 13.5Z" />
      <path d="M11 13.5V9H5V13.5" />
      <path d="M5 2.5V5.5H9.5" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2.5H3.5C2.95 2.5 2.5 2.95 2.5 3.5V12.5C2.5 13.05 2.95 13.5 3.5 13.5H12.5C13.05 13.5 13.5 13.05 13.5 12.5V7" />
      <path d="M10.5 2.5H13.5V5.5" />
      <path d="M7 9L13.5 2.5" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="4" r="2" />
      <circle cx="3.5" cy="12" r="2" />
      <circle cx="12.5" cy="12" r="2" />
      <path d="M6.5 5.5L4.5 10.5" />
      <path d="M9.5 5.5L11.5 10.5" />
    </svg>
  );
}

function ResetLayoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8a6 6 0 0 1 10.2-4.3L14 2" />
      <path d="M14 6V2h-4" />
      <path d="M14 8a6 6 0 0 1-10.2 4.3L2 14" />
      <path d="M2 10v4h4" />
    </svg>
  );
}

export function Header({ onOpenMap, onResetLayout }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const store = useAppStore();
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'ja' ? 'en' : 'ja');
  };

  const handleFileLoad = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    // .mqda project file
    if (ext === 'mqda') {
      try {
        const data = await loadProject(file);
        store.restoreState(data);
      } catch {
        alert('Failed to load project file.');
      }
      e.target.value = '';
      return;
    }

    // Build a FileEntry
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

    store.addFile(entry);
    e.target.value = '';
  };

  const handleSave = async () => {
    await saveProject({
      files: store.files,
      activeFileId: store.activeFileId,
      codes: store.codes,
      memos: store.memos,
      codeLinks: store.codeLinks,
    });
  };

  const handleExport = () => {
    const activeFile = store.files.find((f) => f.id === store.activeFileId);
    const activeCodes = store.codes.filter((c) => c.fileId === store.activeFileId);
    const activeCodeIds = new Set(activeCodes.map((c) => c.id));
    const activeMemos = store.memos.filter((m) => !m.codeId || activeCodeIds.has(m.codeId));
    exportHTML({
      fileName: activeFile?.fileName ?? null,
      fileContent: activeFile?.fileContent ?? null,
      codes: activeCodes,
      memos: activeMemos,
    });
  };

  const handleExportCSV = () => {
    const activeFile = store.files.find((f) => f.id === store.activeFileId);
    const defaultName = activeFile?.fileName?.replace(/\.[^.]+$/, '') ?? 'export';
    exportCSV(
      { files: store.files, codes: store.codes, memos: store.memos },
      defaultName,
    );
  };

  return (
    <header className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-violet-500 via-pink-500 to-orange-400 dark:from-dpurple-900 dark:via-violet-700 dark:to-dpurple-800 text-white shadow-lg">
      <Logo />

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileChange}
          className="hidden"
        />
        <HeaderButton
          onClick={handleFileLoad}
          label={t('header.loadFile')}
          tooltip={t('header.importTooltip')}
          icon={<ImportIcon />}
        />
        <HeaderButton
          onClick={handleSave}
          label={t('header.save')}
          tooltip={t('header.saveTooltip')}
          icon={<SaveIcon />}
        />
        <HeaderButton
          onClick={handleExportCSV}
          label={t('header.export')}
          tooltip={t('header.csvTooltip')}
          icon={<ExportIcon />}
        />
        <HeaderButton
          onClick={onOpenMap}
          label={t('header.map')}
          tooltip={t('header.mapTooltip')}
          icon={<MapIcon />}
        />

        <div className="w-px h-6 bg-white/30 mx-1" />

        <div className="relative group">
          <button
            onClick={onResetLayout}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 hover:bg-white/25 hover:border-white/35 active:scale-95 transition-all shadow-sm hover:shadow-md"
          >
            <span className="opacity-90 group-hover:opacity-100 transition-opacity">
              <ResetLayoutIcon />
            </span>
          </button>
          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-1.5 text-xs rounded-lg bg-gray-900/90 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 shadow-lg z-50">
            {t('header.resetLayoutTooltip')}
            <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-gray-900/90 rotate-45" />
          </div>
        </div>

        <div className="w-px h-6 bg-white/30 mx-1" />

        <button
          onClick={toggleTheme}
          className="px-3 py-1.5 text-sm glass rounded-full hover:brightness-110 active:scale-95 transition-all"
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
        >
          {theme === 'light' ? '☽' : '☀'}
        </button>
        <button
          onClick={toggleLanguage}
          className="px-3 py-1.5 text-sm bg-white/25 backdrop-blur-sm rounded-full hover:bg-white/35 active:scale-95 transition-all font-bold"
        >
          {i18n.language === 'ja' ? 'EN' : 'JA'}
        </button>
      </div>
    </header>
  );
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
