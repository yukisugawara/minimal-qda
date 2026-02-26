import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MindMapModal } from './MindMapModal';
import { CategoryMapModal } from './CategoryMapModal';
import { MemoMapModal } from './MemoMapModal';

type TabKey = 'code' | 'category' | 'memo';

interface MapModalProps {
  onClose: () => void;
}

export function MapModal({ onClose }: MapModalProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>('code');

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'code', label: t('header.mindmap') },
    { key: 'category', label: t('header.categorymap') },
    { key: 'memo', label: t('header.memomap') },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
      <div className="bg-white/90 dark:bg-dpurple-900/90 backdrop-blur-md rounded-2xl shadow-xl w-[90vw] h-[85vh] flex flex-col border border-violet-200/50 dark:border-violet-600/30 animate-scale-in">
        {/* Header with tabs + close */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-violet-200/50 dark:border-violet-700/30">
          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-all active:scale-95 ${
                  activeTab === tab.key
                    ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-violet-100 dark:hover:bg-violet-800/40'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-violet-100 dark:bg-violet-800/40 text-violet-600 dark:text-violet-200 rounded-full hover:bg-violet-200 dark:hover:bg-violet-700/40 active:scale-95 transition-all"
          >
            {t('mindmap.close')}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0">
          {activeTab === 'code' && (
            <MindMapModal onClose={onClose} embedded />
          )}
          {activeTab === 'category' && (
            <CategoryMapModal onClose={onClose} embedded />
          )}
          {activeTab === 'memo' && (
            <MemoMapModal onClose={onClose} embedded />
          )}
        </div>
      </div>
    </div>
  );
}
