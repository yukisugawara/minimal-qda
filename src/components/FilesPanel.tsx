import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';

export function FilesPanel() {
  const { t } = useTranslation();
  const files = useAppStore((s) => s.files);
  const activeFileId = useAppStore((s) => s.activeFileId);
  const setActiveFileId = useAppStore((s) => s.setActiveFileId);
  const removeFile = useAppStore((s) => s.removeFile);

  const [filesCollapsed, setFilesCollapsed] = useState(false);

  return (
    <div className="flex flex-col h-full bg-cream-100/60 dark:bg-dpurple-900/60">
      {/* File list section */}
      <div
        className="flex items-center justify-between px-3 pt-3 pb-1 cursor-pointer select-none hover:bg-violet-50/50 dark:hover:bg-violet-900/20 transition-colors"
        onClick={() => setFilesCollapsed((v) => !v)}
      >
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
          {t('leftPane.files')} ({files.length})
        </h2>
        <span className="text-xs text-gray-400 dark:text-gray-500 transition-transform" style={{ transform: filesCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </div>
      {!filesCollapsed && (
        <div className="flex-1 overflow-y-auto px-3 pb-2 min-h-0">
          {files.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-1">
              {t('leftPane.noFiles')}
            </p>
          ) : (
            <ul className="space-y-0.5 mt-1">
              {files.map((file) => (
                <li
                  key={file.id}
                  onClick={(e) => { e.stopPropagation(); setActiveFileId(file.id); }}
                  className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm cursor-pointer transition-all ${
                    activeFileId === file.id
                      ? 'bg-gradient-to-r from-violet-100 to-pink-50 dark:from-violet-800/40 dark:to-pink-900/20 text-violet-800 dark:text-violet-200 font-semibold ring-1 ring-violet-300 dark:ring-violet-600 shadow-sm'
                      : 'hover:bg-violet-50 dark:hover:bg-violet-900/20 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="truncate flex-1" title={file.fileName}>
                    {file.fileName}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(file.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-500 hover:text-red-500 text-xs flex-shrink-0 transition-opacity"
                    title="Remove"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
