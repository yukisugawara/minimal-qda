import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface LinkLabelDialogProps {
  mode: 'create' | 'edit';
  initialLabel?: string;
  onSubmit: (label: string) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export function LinkLabelDialog({
  mode,
  initialLabel = '',
  onSubmit,
  onDelete,
  onCancel,
}: LinkLabelDialogProps) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(initialLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    onSubmit(label.trim());
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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-white/90 dark:bg-dpurple-800/90 backdrop-blur-md rounded-2xl shadow-xl p-5 w-80 max-w-[90vw] animate-scale-in border border-violet-200/50 dark:border-violet-600/30"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3">
          {mode === 'create'
            ? t('linkLabelDialog.createTitle')
            : t('linkLabelDialog.editTitle')}
        </h3>
        <input
          ref={inputRef}
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('linkLabelDialog.placeholder')}
          className="w-full border border-violet-200 dark:border-violet-600/40 rounded-xl px-3 py-2 text-sm bg-white dark:bg-dpurple-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-400 mb-3"
        />
        <div className="flex justify-between items-center">
          <div>
            {mode === 'edit' && onDelete && (
              <button
                onClick={onDelete}
                className="px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full active:scale-95 transition-all"
              >
                {t('linkLabelDialog.delete')}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-full active:scale-95 transition-all"
            >
              {t('linkLabelDialog.cancel')}
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-1.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-pink-500 rounded-full hover:from-violet-600 hover:to-pink-600 active:scale-95 transition-all shadow-md"
            >
              {t('linkLabelDialog.ok')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
