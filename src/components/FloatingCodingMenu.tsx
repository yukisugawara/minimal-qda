import { Quote, Sparkles } from 'lucide-react';

interface FloatingCodingMenuProps {
  onInVivo: () => void;
  onNewCode: () => void;
  hideInVivo?: boolean;
  codingMode: 'in-vivo' | 'interpretive';
}

export const FloatingCodingMenu = ({ onInVivo, onNewCode, hideInVivo, codingMode }: FloatingCodingMenuProps) => {
  const isInVivo = codingMode === 'in-vivo';
  const isInterpretive = codingMode === 'interpretive';
  return (
    <div className="flex items-center gap-1 p-1 bg-white/60 dark:bg-violet-300/15 backdrop-blur-xl border border-white/40 dark:border-violet-400/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-2xl">

      {/* 1. Code in vivo */}
      {!hideInVivo && (
        <>
          <button
            onClick={onInVivo}
            className={`group relative flex items-center gap-2 p-2 rounded-xl transition-all duration-300 active:scale-95 overflow-hidden ${
              isInVivo
                ? 'bg-violet-100/80 dark:bg-violet-400/25 ring-1 ring-violet-300/60 dark:ring-violet-400/40'
                : 'hover:bg-white/80 dark:hover:bg-violet-400/20'
            }`}
          >
            <div className={`absolute inset-0 bg-gradient-to-r from-violet-400/20 to-fuchsia-400/20 blur-md transition-opacity duration-500 ${isInVivo ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
            <Quote className={`relative w-4 h-4 transition-all duration-300 ${
              isInVivo
                ? 'text-violet-500 dark:text-violet-200 -translate-y-0.5'
                : 'text-violet-400 dark:text-violet-300 group-hover:text-violet-500 dark:group-hover:text-violet-200 group-hover:-translate-y-0.5'
            }`} />
            <span className={`relative overflow-hidden whitespace-nowrap transition-all duration-300 ease-out font-medium text-xs ${
              isInVivo
                ? 'max-w-40 opacity-100 pr-1 text-violet-700 dark:text-violet-100'
                : 'max-w-0 opacity-0 group-hover:max-w-40 group-hover:opacity-100 group-hover:pr-1 text-slate-600 dark:text-violet-200 group-hover:text-violet-700 dark:group-hover:text-violet-100'
            }`}>
              Code <i className="font-serif text-violet-500/90 dark:text-violet-300 tracking-wide">in vivo</i>
            </span>
          </button>

          <div className="w-[1px] h-5 bg-slate-200/60 dark:bg-violet-400/30" />
        </>
      )}

      {/* 2. Code with a new code */}
      <button
        onClick={onNewCode}
        className={`group relative flex items-center gap-2 p-2 rounded-xl transition-all duration-300 active:scale-95 overflow-hidden ${
          isInterpretive
            ? 'bg-cyan-100/80 dark:bg-cyan-400/25 ring-1 ring-cyan-300/60 dark:ring-cyan-400/40'
            : 'hover:bg-white/80 dark:hover:bg-cyan-400/20'
        }`}
      >
        <div className={`absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-blue-400/20 blur-md transition-opacity duration-500 ${isInterpretive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
        <Sparkles className={`relative w-4 h-4 transition-all duration-300 ${
          isInterpretive
            ? 'text-cyan-500 dark:text-cyan-200 rotate-12 scale-110'
            : 'text-cyan-400 dark:text-cyan-300 group-hover:text-cyan-500 dark:group-hover:text-cyan-200 group-hover:rotate-12 group-hover:scale-110'
        }`} />
        <span className={`relative overflow-hidden whitespace-nowrap transition-all duration-300 ease-out font-medium text-xs ${
          isInterpretive
            ? 'max-w-48 opacity-100 pr-1 text-cyan-700 dark:text-cyan-100'
            : 'max-w-0 opacity-0 group-hover:max-w-48 group-hover:opacity-100 group-hover:pr-1 text-slate-600 dark:text-cyan-200 group-hover:text-cyan-700 dark:group-hover:text-cyan-100'
        }`}>
          Code with a new code
        </span>
      </button>

    </div>
  );
};
