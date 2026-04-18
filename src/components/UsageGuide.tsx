import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/* ── tiny inline icons (matching Header style) ── */

function ImportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 10V12.5C2.5 13.05 2.95 13.5 3.5 13.5H12.5C13.05 13.5 13.5 13.05 13.5 12.5V10" />
      <path d="M8 2.5V10" />
      <path d="M5 7L8 10L11 7" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.5 13.5H3.5C2.95 13.5 2.5 13.05 2.5 12.5V3.5C2.5 2.95 2.95 2.5 3.5 2.5H10.5L13.5 5.5V12.5C13.5 13.05 13.05 13.5 12.5 13.5Z" />
      <path d="M11 13.5V9H5V13.5" />
      <path d="M5 2.5V5.5H9.5" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2.5H3.5C2.95 2.5 2.5 2.95 2.5 3.5V12.5C2.5 13.05 2.95 13.5 3.5 13.5H12.5C13.05 13.5 13.5 13.05 13.5 12.5V7" />
      <path d="M10.5 2.5H13.5V5.5" />
      <path d="M7 9L13.5 2.5" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="4" r="2" />
      <circle cx="3.5" cy="12" r="2" />
      <circle cx="12.5" cy="12" r="2" />
      <path d="M6.5 5.5L4.5 10.5" />
      <path d="M9.5 5.5L11.5 10.5" />
    </svg>
  );
}

/* ── Section component ── */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="text-xs font-bold uppercase tracking-wider text-violet-500 dark:text-violet-400 mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

/* ── Row: icon + label + description ── */

function Row({
  icon,
  label,
  desc,
}: {
  icon?: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-2 py-1">
      {icon && (
        <span className="flex-shrink-0 mt-0.5 text-gray-500 dark:text-gray-400">
          {icon}
        </span>
      )}
      <p className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed">
        <span className="font-semibold">{label}</span>
        <span className="text-gray-500 dark:text-gray-400"> — {desc}</span>
      </p>
    </div>
  );
}

/* ── Main component ── */

export function UsageGuide() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  return (
    <>
      {/* ? icon trigger */}
      <button
        onClick={() => setShow(true)}
        className="fixed bottom-4 left-16 z-40
          flex items-center justify-center w-10 h-10 rounded-xl
          bg-white/60 dark:bg-violet-300/15 backdrop-blur-xl
          border border-white/40 dark:border-violet-400/20
          shadow-[0_8px_32px_rgba(0,0,0,0.12)]
          transition-all duration-300
          hover:bg-violet-100 dark:hover:bg-violet-400/25
          active:scale-95"
        aria-label={t('usage.title')}
      >
        <svg
          className="w-5 h-5 text-violet-600 dark:text-violet-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {/* Overlay + Guide card */}
      {show && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setShow(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white/90 dark:bg-dpurple-900/90 backdrop-blur-md rounded-2xl shadow-xl
              border border-violet-200/50 dark:border-violet-600/30
              px-7 py-6 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto animate-scale-in
              scrollbar-thin scrollbar-thumb-violet-300/40 dark:scrollbar-thumb-violet-600/40"
          >
            {/* Close button */}
            <button
              onClick={() => setShow(false)}
              className="absolute top-3 right-3 flex items-center justify-center w-7 h-7 rounded-lg
                text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300
                hover:bg-gray-200/60 dark:hover:bg-violet-700/40
                transition-all duration-200"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 2l10 10M12 2L2 12" />
              </svg>
            </button>

            <h2 className="text-lg font-bold text-center text-gray-800 dark:text-gray-100 mb-5 pr-6">
              {t('usage.title')}
            </h2>

            {/* Header Buttons */}
            <Section title={t('usage.headerButtons')}>
              <Row icon={<ImportIcon />} label="Import" desc={t('usage.btnImport')} />
              <Row icon={<SaveIcon />} label={t('usage.btnSaveLabel')} desc={t('usage.btnSave')} />
              <Row icon={<ExportIcon />} label={t('usage.btnExportLabel')} desc={t('usage.btnExport')} />
              <Row icon={<MapIcon />} label="Map" desc={t('usage.btnMap')} />
              <Row label="☽ / ☀" desc={t('usage.btnTheme')} />
              <Row label="EN / JA" desc={t('usage.btnLang')} />
            </Section>

            {/* Panels */}
            <Section title={t('usage.panels')}>
              <Row label={t('usage.panelFiles')} desc={t('usage.panelFilesDesc')} />
              <Row label={t('usage.panelCodes')} desc={t('usage.panelCodesDesc')} />
              <Row label={t('usage.panelViewer')} desc={t('usage.panelViewerDesc')} />
              <Row label={t('usage.panelMemos')} desc={t('usage.panelMemosDesc')} />
            </Section>

            {/* Coding */}
            <Section title={t('usage.coding')}>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-1">
                {t('usage.codingDesc')}
              </p>
              <Row label={t('usage.codingInVivo')} desc={t('usage.codingInVivoDesc')} />
              <Row label={t('usage.codingInterpretive')} desc={t('usage.codingInterpretiveDesc')} />
            </Section>

            {/* File Formats */}
            <Section title={t('usage.formats')}>
              <div className="space-y-1.5">
                <p className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed">
                  <span className="font-semibold">{t('usage.formatImport')}</span>{' '}
                  <code className="px-1 py-0.5 rounded bg-violet-100 dark:bg-violet-800/40 text-[11px] text-violet-700 dark:text-violet-300">
                    .txt .md .xml .pdf .png .jpg .docx .mqda .qdpx .qdc
                  </code>
                </p>
                <p className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed">
                  <span className="font-semibold">{t('usage.formatExport')}</span>{' '}
                  <code className="px-1 py-0.5 rounded bg-violet-100 dark:bg-violet-800/40 text-[11px] text-violet-700 dark:text-violet-300">
                    .mqda .csv .png .pdf .qdpx .qdc
                  </code>
                </p>
                <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed mt-1">
                  {t('usage.formatRefiQda')}
                </p>
                <div className="mt-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40">
                  <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                    {t('usage.formatMaxqdaNote')}
                  </p>
                </div>
              </div>
            </Section>

            {/* Save & Resume */}
            <Section title={t('usage.saveResume')}>
              <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-900/30 border border-violet-200/50 dark:border-violet-700/30">
                <p className="text-xs text-gray-700 dark:text-gray-200 leading-relaxed">
                  {t('usage.saveResumeDesc')}
                </p>
                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-violet-600 dark:text-violet-400 font-medium">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-200/60 dark:bg-violet-700/40">
                    <SaveIcon />
                    {t('usage.btnSaveLabel')}
                  </span>
                  <span>→</span>
                  <span className="px-2 py-0.5 rounded-md bg-violet-200/60 dark:bg-violet-700/40">.mqda</span>
                  <span>→</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-200/60 dark:bg-violet-700/40">
                    <ImportIcon />
                    Import
                  </span>
                </div>
              </div>
            </Section>
          </div>
        </div>
      )}
    </>
  );
}
