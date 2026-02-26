import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface CodeNameDialogProps {
  contextText: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export function CodeNameDialog({ contextText, onSubmit, onCancel }: CodeNameDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (trimmed) {
      onSubmit(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onCancel}>
      <div
        className="bg-white/90 dark:bg-dpurple-800/90 backdrop-blur-md rounded-2xl shadow-xl p-5 w-80 max-w-[90vw] animate-scale-in border border-violet-200/50 dark:border-violet-600/30"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">
          {t('codeNameDialog.title')}
        </h3>
        <div className="text-xs text-gray-500 dark:text-violet-300/60 mb-1">
          {t('codeNameDialog.context')}:
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-300 bg-violet-50 dark:bg-dpurple-900/60 rounded-xl px-3 py-2 mb-3 max-h-20 overflow-y-auto break-words">
          {contextText}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('codeNameDialog.placeholder')}
          className="w-full border border-violet-200 dark:border-violet-600/40 rounded-xl px-3 py-2 text-sm bg-white dark:bg-dpurple-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400 mb-3"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-full active:scale-95 transition-all"
          >
            {t('codeNameDialog.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-4 py-1.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-pink-500 rounded-full hover:from-violet-600 hover:to-pink-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-md"
          >
            {t('codeNameDialog.ok')}
          </button>
        </div>
      </div>
    </div>
  );
}
