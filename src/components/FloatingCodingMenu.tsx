import { Quote, Sparkles } from 'lucide-react';

interface FloatingCodingMenuProps {
  onInVivo: () => void;
  onNewCode: () => void;
  hideInVivo?: boolean;
}

export const FloatingCodingMenu = ({ onInVivo, onNewCode, hideInVivo }: FloatingCodingMenuProps) => {
  return (
    <div className="flex items-center gap-1 p-1 bg-white/60 dark:bg-violet-300/15 backdrop-blur-xl border border-white/40 dark:border-violet-400/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-2xl">

      {/* 1. Code in vivo */}
      {!hideInVivo && (
        <>
          <button
            onClick={onInVivo}
            className="group relative flex items-center gap-2 p-2 rounded-xl transition-all duration-300 hover:bg-white/80 dark:hover:bg-violet-400/20 active:scale-95 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-violet-400/20 to-fuchsia-400/20 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-500" />
            <Quote className="relative w-4 h-4 text-violet-400 dark:text-violet-300 group-hover:text-violet-500 dark:group-hover:text-violet-200 transition-all duration-300 group-hover:-translate-y-0.5" />
            <span className="relative max-w-0 overflow-hidden whitespace-nowrap opacity-0 group-hover:max-w-40 group-hover:opacity-100 group-hover:pr-1 transition-all duration-300 ease-out font-medium text-xs text-slate-600 dark:text-violet-200 group-hover:text-violet-700 dark:group-hover:text-violet-100">
              Code <i className="font-serif text-violet-500/90 dark:text-violet-300 tracking-wide">in vivo</i>
            </span>
          </button>

          <div className="w-[1px] h-5 bg-slate-200/60 dark:bg-violet-400/30" />
        </>
      )}

      {/* 2. Code with a new code */}
      <button
        onClick={onNewCode}
        className="group relative flex items-center gap-2 p-2 rounded-xl transition-all duration-300 hover:bg-white/80 dark:hover:bg-cyan-400/20 active:scale-95 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-blue-400/20 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-500" />
        <Sparkles className="relative w-4 h-4 text-cyan-400 dark:text-cyan-300 group-hover:text-cyan-500 dark:group-hover:text-cyan-200 transition-all duration-300 group-hover:rotate-12 group-hover:scale-110" />
        <span className="relative max-w-0 overflow-hidden whitespace-nowrap opacity-0 group-hover:max-w-48 group-hover:opacity-100 group-hover:pr-1 transition-all duration-300 ease-out font-medium text-xs text-slate-600 dark:text-cyan-200 group-hover:text-cyan-700 dark:group-hover:text-cyan-100">
          Code with a new code
        </span>
      </button>

    </div>
  );
};
