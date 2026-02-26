import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { importFile } from '../utils/importFile';

export function FilesPanel() {
  const { t } = useTranslation();
  const files = useAppStore((s) => s.files);
  const activeFileId = useAppStore((s) => s.activeFileId);
  const setActiveFileId = useAppStore((s) => s.setActiveFileId);
  const removeFile = useAppStore((s) => s.removeFile);
  const addFile = useAppStore((s) => s.addFile);
  const restoreState = useAppStore((s) => s.restoreState);

  const [filesCollapsed, setFilesCollapsed] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      for (const file of droppedFiles) {
        const result = await importFile(file);
        if (result?.type === 'project') {
          restoreState(result.data);
        } else if (result?.type === 'file') {
          addFile(result.entry);
        }
      }
    },
    [addFile, restoreState],
  );

  return (
    <div
      className={`flex flex-col h-full bg-cream-100/60 dark:bg-dpurple-900/60 transition-colors ${
        dragOver ? 'ring-2 ring-inset ring-violet-400 dark:ring-violet-500 bg-violet-50/50 dark:bg-violet-900/30' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                {t('leftPane.noFiles')}
              </p>
              <p className="text-[10px] text-gray-400/70 dark:text-gray-500/70 mt-1">
                {t('leftPane.dropHint', 'Drop files here')}
              </p>
            </div>
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

      {/* Drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-violet-100/60 dark:bg-violet-900/40 backdrop-blur-[2px] rounded-lg pointer-events-none z-10">
          <div className="flex flex-col items-center gap-1 text-violet-600 dark:text-violet-300">
            <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 10V12.5C2.5 13.05 2.95 13.5 3.5 13.5H12.5C13.05 13.5 13.5 13.05 13.5 12.5V10" />
              <path d="M8 2.5V10" />
              <path d="M5 7L8 10L11 7" />
            </svg>
            <span className="text-xs font-medium">Drop to import</span>
          </div>
        </div>
      )}
    </div>
  );
}
