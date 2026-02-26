import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const steps = [
  'coding',
  'organise',
  'group',
  'categorise',
  'refineCategories',
  'relational',
  'theory',
] as const;

export function MethodologyGuide() {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);

  return (
    <>
      {/* Book icon trigger */}
      <button
        onClick={() => setShow(true)}
        className="fixed bottom-4 left-4 z-40
          flex items-center justify-center w-10 h-10 rounded-xl
          bg-white/60 dark:bg-violet-300/15 backdrop-blur-xl
          border border-white/40 dark:border-violet-400/20
          shadow-[0_8px_32px_rgba(0,0,0,0.12)]
          transition-all duration-300
          hover:bg-violet-100 dark:hover:bg-violet-400/25
          active:scale-95"
        aria-label={t('guide.title')}
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
            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
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
              px-6 py-5 max-w-sm w-full mx-4 max-h-[85vh] overflow-y-auto animate-scale-in"
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

            <h2 className="text-base font-bold text-center text-gray-800 dark:text-gray-100 mb-2 pr-6">
              {t('guide.title')}
            </h2>

            {/* Goal description */}
            <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed text-center mb-4">
              {t('guide.goal')}
            </p>

            {/* Steps */}
            <div className="flex flex-col items-center">
              {steps.map((key, i) => {
                const isLast = i === steps.length - 1;
                return (
                  <div key={key} className="flex flex-col items-center w-full">
                    {/* Step row */}
                    <div className={`flex items-start gap-2.5 w-full ${isLast ? 'p-2 -mx-2 rounded-xl bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-900/30 dark:to-pink-900/20 border border-violet-200/40 dark:border-violet-600/20' : ''}`}>
                      {/* Number badge */}
                      <span
                        className={`flex-shrink-0 flex items-center justify-center rounded-full text-white font-bold shadow-md
                          ${isLast
                            ? 'w-7 h-7 text-[11px] bg-gradient-to-br from-amber-400 to-orange-500'
                            : 'w-6 h-6 text-[10px] bg-gradient-to-br from-violet-500 to-pink-500'
                          }`}
                      >
                        {isLast ? '★' : i + 1}
                      </span>
                      <div className="pt-0.5 min-w-0">
                        <p className={`font-semibold leading-snug ${isLast ? 'text-xs text-amber-700 dark:text-amber-300' : 'text-xs text-gray-800 dark:text-gray-100'}`}>
                          {t(`guide.steps.${key}.title`)}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                          {t(`guide.steps.${key}.desc`)}
                        </p>
                      </div>
                    </div>

                    {/* Arrow connector */}
                    {!isLast && (
                      <span className="text-violet-400 dark:text-violet-500 text-xs my-0.5 select-none">
                        ↓
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Memo callout */}
            <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/30">
              <div className="flex items-start gap-2">
                {/* Memo icon */}
                <svg
                  className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500 dark:text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                <div>
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mb-0.5">
                    {t('guide.memoTitle')}
                  </p>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-200/70 leading-relaxed">
                    {t('guide.memoDesc')}
                  </p>
                </div>
              </div>
            </div>

            {/* Hint */}
            <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 mt-3 leading-relaxed">
              {t('guide.hint')}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
