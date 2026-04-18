import { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, nextFileId } from '../store/useAppStore';
import { saveProject, saveProjectAs, hasSavedFileHandle, supportsNativeSave } from '../utils/fileIO';
import { exportHTML } from '../utils/exportHTML';
import { exportCSV } from '../utils/exportCSV';
import { exportPNG, exportPDF } from '../utils/exportViewer';
import { exportQdc, exportQdpx } from '../utils/exportRefiQda';
import { importFile } from '../utils/importFile';
import { Logo } from './Logo';
import { GoogleDriveSettingsModal } from './GoogleDriveSettingsModal';
import { isGoogleDriveConfigured } from '../utils/googleDrive';
import { useAutoSaveStatus } from '../hooks/useAutoSaveStatus';

const ACCEPTED_TYPES = '.txt,.md,.xml,.pdf,.png,.jpg,.jpeg,.docx,.mqda,.qdpx,.qdc';

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

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4.5C2 3.67 2.67 3 3.5 3H6L7.5 5H12.5C13.33 5 14 5.67 14 6.5V11.5C14 12.33 13.33 13 12.5 13H3.5C2.67 13 2 12.33 2 11.5V4.5Z" />
    </svg>
  );
}

function CloudSyncIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12.5H3.5C2.12 12.5 1 11.38 1 10C1 8.62 2.12 7.5 3.5 7.5C3.57 7.5 3.64 7.5 3.71 7.51C4.16 5.49 5.94 4 8 4C10.06 4 11.84 5.49 12.29 7.51C12.36 7.5 12.43 7.5 12.5 7.5C13.88 7.5 15 8.62 15 10C15 11.38 13.88 12.5 12.5 12.5H11.5" />
      <path d="M8 10V15" />
      <path d="M6 12L8 10L10 12" />
    </svg>
  );
}

/* --- Sample data definitions --- */

interface SampleFile {
  path: string;     // relative to public/
  fileName: string;
  fileType: string;  // MIME type
}

interface SampleItem {
  id: string;
  labelKey: string;        // i18n key under "samples."
  descriptionKey: string;  // i18n key under "samples."
  files: SampleFile[];
}

const SAMPLES: SampleItem[] = [
  {
    id: 'roomba',
    labelKey: 'samples.roomba',
    descriptionKey: 'samples.roombaDesc',
    files: [
      { path: 'samples/roomba_kawaii_35tweets_sample.txt', fileName: 'roomba_kawaii_35tweets_sample.txt', fileType: 'text/plain' },
    ],
  },
  {
    id: 'instagram-career',
    labelKey: 'samples.instagramCareer',
    descriptionKey: 'samples.instagramCareerDesc',
    files: [
      { path: 'samples/instagram_career_1_cover.png', fileName: '1_cover.png', fileType: 'image/png' },
      { path: 'samples/instagram_career_2_profile.png', fileName: '2_profile.png', fileType: 'image/png' },
      { path: 'samples/instagram_career_3_why_grad_school.png', fileName: '3_why_grad_school.png', fileType: 'image/png' },
      { path: 'samples/instagram_career_4_why_osaka_u.png', fileName: '4_why_osaka_u.png', fileType: 'image/png' },
      { path: 'samples/instagram_career_5_future_career.png', fileName: '5_future_career.png', fileType: 'image/png' },
      { path: 'samples/instagram_career_6_current_efforts.png', fileName: '6_current_efforts.png', fileType: 'image/png' },
      { path: 'samples/instagram_career_7_thankyou.png', fileName: '7_thankyou.png', fileType: 'image/png' },
    ],
  },
];

function SampleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2.5H10L13 5.5V13.5C13 14.05 12.55 14.5 12 14.5H3C2.45 14.5 2 14.05 2 13.5V3.5C2 2.95 2.45 2.5 3 2.5Z" />
      <path d="M10 2.5V5.5H13" />
      <path d="M5 8.5H10" />
      <path d="M5 11H8" />
    </svg>
  );
}

function SampleDropdown({
  onSelect,
}: {
  onSelect: (sample: SampleItem) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, close]);

  return (
    <div ref={ref} className="relative group">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/25 hover:border-white/35 active:scale-95 transition-all shadow-sm hover:shadow-md"
      >
        <span className="flex-shrink-0 opacity-90 group-hover:opacity-100 transition-opacity">
          <SampleIcon />
        </span>
        <span>{t('header.sample')}</span>
      </button>
      {!open && (
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-1.5 text-xs rounded-lg bg-gray-900/90 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 shadow-lg z-50">
          {t('header.sampleTooltip')}
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-gray-900/90 rotate-45" />
        </div>
      )}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 min-w-[260px] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200/50 dark:border-gray-600/30 py-1 z-50">
          {SAMPLES.map((sample) => (
            <button
              key={sample.id}
              onClick={() => { onSelect(sample); close(); }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors text-left"
            >
              <span className="flex-shrink-0 text-gray-500 dark:text-gray-400"><SampleIcon /></span>
              <div className="min-w-0">
                <div className="font-medium">{t(sample.labelKey)}</div>
                <div className="text-[10px] text-gray-400 dark:text-gray-500">{t(sample.descriptionKey)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SaveDropdown({
  onSave,
  onSaveAs,
  labels,
}: {
  onSave: () => void;
  onSaveAs: () => void;
  labels: { save: string; saveAs: string; saveTooltip: string; saveAsTooltip: string; browserHint: string };
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, close]);

  const nativeSupported = supportsNativeSave();
  const hasHandle = hasSavedFileHandle();

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl shadow-sm hover:shadow-md transition-all">
        {/* Main save button */}
        <button
          onClick={() => { onSave(); close(); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium hover:bg-white/10 rounded-l-xl active:scale-95 transition-all"
          title={labels.saveTooltip}
        >
          <span className="flex-shrink-0 opacity-90"><SaveIcon /></span>
          <span>{labels.save}</span>
        </button>
        {/* Dropdown toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center px-1.5 py-1.5 border-l border-white/20 hover:bg-white/10 rounded-r-xl active:scale-95 transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 5L6 8L9 5" />
          </svg>
        </button>
      </div>
      {/* Dropdown menu */}
      {open && (
        <div className="absolute right-0 top-full mt-1.5 min-w-[220px] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200/50 dark:border-gray-600/30 py-1 z-50">
          {/* Overwrite save */}
          <button
            onClick={() => { onSave(); close(); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors text-left"
          >
            <span className="flex-shrink-0 text-gray-500 dark:text-gray-400"><SaveIcon /></span>
            <div className="min-w-0">
              <div className="font-medium">{labels.save}</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                {hasHandle ? labels.saveTooltip : labels.saveAsTooltip}
              </div>
            </div>
          </button>

          <div className="mx-2 my-0.5 border-t border-gray-200/50 dark:border-gray-600/30" />

          {/* Save as (choose location) */}
          <button
            onClick={() => { onSaveAs(); close(); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors text-left"
          >
            <span className="flex-shrink-0 text-gray-500 dark:text-gray-400"><FolderIcon /></span>
            <div className="min-w-0">
              <div className="font-medium">{labels.saveAs}</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">{labels.saveAsTooltip}</div>
            </div>
          </button>

          {/* Browser hint for Safari / Firefox */}
          {!nativeSupported && (
            <>
              <div className="mx-2 my-0.5 border-t border-gray-200/50 dark:border-gray-600/30" />
              <div className="px-3 py-2 text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed">
                {labels.browserHint}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CsvIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2.5H10L13 5.5V13.5C13 14.05 12.55 14.5 12 14.5H3C2.45 14.5 2 14.05 2 13.5V3.5C2 2.95 2.45 2.5 3 2.5Z" />
      <path d="M10 2.5V5.5H13" />
      <path d="M5 9H11" />
      <path d="M5 11.5H11" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <circle cx="5.5" cy="5.5" r="1.25" />
      <path d="M14 10.5L11 7.5L4 13.5" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2.5H10L13 5.5V13.5C13 14.05 12.55 14.5 12 14.5H3C2.45 14.5 2 14.05 2 13.5V3.5C2 2.95 2.45 2.5 3 2.5Z" />
      <path d="M10 2.5V5.5H13" />
      <path d="M5 8.5H7" />
      <path d="M5 10.5H10" />
      <path d="M5 12.5H8" />
    </svg>
  );
}

function ExportDropdown({
  onCSV,
  onPNG,
  onPDF,
  onQdpx,
  onQdc,
}: {
  onCSV: () => void;
  onPNG: () => void;
  onPDF: () => void;
  onQdpx: () => void;
  onQdc: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, close]);

  return (
    <div ref={ref} className="relative group">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/25 hover:border-white/35 active:scale-95 transition-all shadow-sm hover:shadow-md"
      >
        <span className="flex-shrink-0 opacity-90 group-hover:opacity-100 transition-opacity">
          <ExportIcon />
        </span>
        <span>{t('header.export')}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5 opacity-70">
          <path d="M2.5 4L5 6.5L7.5 4" />
        </svg>
      </button>
      {!open && (
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-1.5 text-xs rounded-lg bg-gray-900/90 text-white whitespace-nowrap opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 shadow-lg z-50">
          {t('header.csvTooltip')}
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-gray-900/90 rotate-45" />
        </div>
      )}
      {open && (
        <div className="absolute left-0 top-full mt-1.5 min-w-[240px] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200/50 dark:border-gray-600/30 py-1 z-50">
          <button
            onClick={() => { onCSV(); close(); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors text-left"
          >
            <span className="flex-shrink-0 text-gray-500 dark:text-gray-400"><CsvIcon /></span>
            <div className="min-w-0">
              <div className="font-medium">{t('header.exportCsv')}</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">{t('header.csvTooltip')}</div>
            </div>
          </button>

          <div className="mx-2 my-0.5 border-t border-gray-200/50 dark:border-gray-600/30" />

          <button
            onClick={() => { onPNG(); close(); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors text-left"
          >
            <span className="flex-shrink-0 text-gray-500 dark:text-gray-400"><ImageIcon /></span>
            <div className="min-w-0">
              <div className="font-medium">{t('header.exportPng')}</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">{t('header.pngTooltip')}</div>
            </div>
          </button>

          <div className="mx-2 my-0.5 border-t border-gray-200/50 dark:border-gray-600/30" />

          <button
            onClick={() => { onPDF(); close(); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors text-left"
          >
            <span className="flex-shrink-0 text-gray-500 dark:text-gray-400"><PdfIcon /></span>
            <div className="min-w-0">
              <div className="font-medium">{t('header.exportPdf')}</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">{t('header.pdfTooltip')}</div>
            </div>
          </button>

          <div className="mx-2 my-0.5 border-t border-gray-200/50 dark:border-gray-600/30" />

          <button
            onClick={() => { onQdpx(); close(); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors text-left"
          >
            <span className="flex-shrink-0 text-gray-500 dark:text-gray-400"><CsvIcon /></span>
            <div className="min-w-0">
              <div className="font-medium">{t('header.exportQdpx')}</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">{t('header.qdpxTooltip')}</div>
            </div>
          </button>

          <div className="mx-2 my-0.5 border-t border-gray-200/50 dark:border-gray-600/30" />

          <button
            onClick={() => { onQdc(); close(); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors text-left"
          >
            <span className="flex-shrink-0 text-gray-500 dark:text-gray-400"><CsvIcon /></span>
            <div className="min-w-0">
              <div className="font-medium">{t('header.exportQdc')}</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">{t('header.qdcTooltip')}</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    idle: 'bg-gray-400',
    pending: 'bg-yellow-400 animate-pulse',
    saving: 'bg-blue-400 animate-pulse',
    saved: 'bg-green-400',
    error: 'bg-red-400',
  };
  return (
    <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white/30 ${colorMap[status] ?? 'bg-gray-400'}`} />
  );
}

export function Header({ onOpenMap, onResetLayout }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const store = useAppStore();
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showDriveSettings, setShowDriveSettings] = useState(false);
  const autoSaveStatus = useAutoSaveStatus();

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'ja' ? 'en' : 'ja');
  };

  const handleFileLoad = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await importFile(file);
    if (result?.type === 'project') {
      store.restoreState(result.data);
    } else if (result?.type === 'file') {
      store.addFile(result.entry);
    } else if (result?.type === 'codebook') {
      const targetFileId = store.activeFileId;
      if (!targetFileId) {
        alert('コードブック (.qdc) を取り込むには、先にファイルを開いてください。');
      } else {
        store.addCodes(result.codes.map((c) => ({ ...c, fileId: targetFileId })));
      }
    }
    e.target.value = '';
  };

  const projectData = () => ({
    files: store.files,
    activeFileId: store.activeFileId,
    codes: store.codes,
    memos: store.memos,
    codeLinks: store.codeLinks,
  });

  const handleSave = async () => {
    await saveProject(projectData());
  };

  const handleSaveAs = async () => {
    await saveProjectAs(projectData());
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

  const handleSampleSelect = async (sample: SampleItem) => {
    try {
      const base = import.meta.env.BASE_URL;
      for (const file of sample.files) {
        const url = `${base}${file.path}`.replace(/\/\//g, '/');
        const res = await fetch(url);
        const ext = file.fileName.split('.').pop()?.toLowerCase() ?? '';
        const isImage = ['png', 'jpg', 'jpeg'].includes(ext);

        if (isImage) {
          const blob = await res.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          store.addFile({
            id: nextFileId(),
            fileName: file.fileName,
            fileContent: `[Image] ${file.fileName}`,
            fileType: ext,
            fileDataUrl: dataUrl,
          });
        } else {
          const text = await res.text();
          store.addFile({
            id: nextFileId(),
            fileName: file.fileName,
            fileContent: text,
            fileType: ext,
            fileDataUrl: null,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load sample:', err);
    }
  };

  const handleExportCSV = () => {
    const activeFile = store.files.find((f) => f.id === store.activeFileId);
    const defaultName = activeFile?.fileName?.replace(/\.[^.]+$/, '') ?? 'export';
    exportCSV(
      { files: store.files, codes: store.codes, memos: store.memos },
      defaultName,
    );
  };

  const getViewerExportData = () => {
    const activeFile = store.files.find((f) => f.id === store.activeFileId);
    if (!activeFile) return null;
    const activeCodes = store.codes.filter((c) => c.fileId === store.activeFileId);
    const activeCodeIds = new Set(activeCodes.map((c) => c.id));
    const activeMemos = store.memos.filter((m) => !m.codeId || activeCodeIds.has(m.codeId));
    return { file: activeFile, codes: activeCodes, memos: activeMemos };
  };

  const handleExportPNG = () => {
    const data = getViewerExportData();
    if (data) exportPNG(data);
  };

  const handleExportPDF = () => {
    const data = getViewerExportData();
    if (data) exportPDF(data);
  };

  const handleExportQdpx = async () => {
    const activeFile = store.files.find((f) => f.id === store.activeFileId);
    const defaultName = activeFile?.fileName?.replace(/\.[^.]+$/, '') ?? 'project';
    await exportQdpx(
      { files: store.files, codes: store.codes, memos: store.memos, projectName: defaultName },
      defaultName,
    );
  };

  const handleExportQdc = async () => {
    const activeFile = store.files.find((f) => f.id === store.activeFileId);
    const defaultName = activeFile?.fileName?.replace(/\.[^.]+$/, '') ?? 'codebook';
    await exportQdc(store.codes, defaultName);
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
        <SampleDropdown onSelect={handleSampleSelect} />
        <SaveDropdown
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          labels={{
            save: t('header.save'),
            saveAs: t('header.saveAs'),
            saveTooltip: t('header.saveTooltip'),
            saveAsTooltip: t('header.saveAsTooltip'),
            browserHint: t('header.browserHint'),
          }}
        />
        <ExportDropdown
          onCSV={handleExportCSV}
          onPNG={handleExportPNG}
          onPDF={handleExportPDF}
          onQdpx={handleExportQdpx}
          onQdc={handleExportQdc}
        />
        <HeaderButton
          onClick={onOpenMap}
          label={t('header.map')}
          tooltip={t('header.mapTooltip')}
          icon={<MapIcon />}
        />

        {isGoogleDriveConfigured() && (
          <>
            <div className="w-px h-6 bg-white/30 mx-1" />

            {/* Cloud Sync button */}
            <div className="relative group">
              <button
                onClick={() => setShowDriveSettings(true)}
                className="relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white/15 backdrop-blur-sm border border-white/20 rounded-xl hover:bg-white/25 hover:border-white/35 active:scale-95 transition-all shadow-sm hover:shadow-md"
              >
                <span className="flex-shrink-0 opacity-90 group-hover:opacity-100 transition-opacity">
                  <CloudSyncIcon />
                </span>
                <span>{t('header.cloudSync')}</span>
                {autoSaveStatus !== 'idle' && <StatusDot status={autoSaveStatus} />}
              </button>
              <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-1.5 text-xs rounded-lg bg-gray-900/90 text-white opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 shadow-lg z-50 w-56 text-center leading-relaxed">
                {t('driveSync.syncTooltip')}
                <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-gray-900/90 rotate-45" />
              </div>
            </div>
          </>
        )}

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
      {showDriveSettings && (
        <GoogleDriveSettingsModal onClose={() => setShowDriveSettings(false)} />
      )}
    </header>
  );
}

