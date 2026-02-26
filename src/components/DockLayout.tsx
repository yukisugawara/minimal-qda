import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { LayoutNode, PanelId, DropEdge } from '../utils/layoutTree';
import { DEFAULT_LAYOUT, movePanel, updateRatio } from '../utils/layoutTree';
import { FilesPanel } from './FilesPanel';
import { CodesPanel } from './CodesPanel';
import { CenterPane } from './CenterPane';
import { RightPane } from './RightPane';

const MIN_RATIO = 0.15;

const PANEL_COMPONENTS: Record<PanelId, React.FC> = {
  files: FilesPanel,
  codes: CodesPanel,
  center: CenterPane,
  memos: RightPane,
};

const PANEL_TITLE_KEYS: Record<PanelId, string> = {
  files: 'panel.files',
  codes: 'panel.codes',
  center: 'panel.viewer',
  memos: 'panel.memos',
};

interface DockLayoutProps {
  layout: LayoutNode;
  onLayoutChange: (layout: LayoutNode) => void;
}

export function DockLayout({ layout, onLayoutChange }: DockLayoutProps) {
  const [dragPanelId, setDragPanelId] = useState<PanelId | null>(null);

  const handleDragStart = useCallback((panelId: PanelId) => {
    setDragPanelId(panelId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragPanelId(null);
  }, []);

  const handleDrop = useCallback(
    (targetPanelId: PanelId, edge: DropEdge) => {
      if (!dragPanelId || (dragPanelId === targetPanelId && edge === 'center')) {
        setDragPanelId(null);
        return;
      }
      const newLayout = movePanel(layout, dragPanelId, targetPanelId, edge);
      onLayoutChange(newLayout);
      setDragPanelId(null);
    },
    [dragPanelId, layout, onLayoutChange],
  );

  const handleRatioChange = useCallback(
    (path: ('first' | 'second')[], newRatio: number) => {
      const clamped = Math.max(MIN_RATIO, Math.min(1 - MIN_RATIO, newRatio));
      onLayoutChange(updateRatio(layout, path, clamped));
    },
    [layout, onLayoutChange],
  );

  return (
    <SplitContainer
      node={layout}
      path={[]}
      dragPanelId={dragPanelId}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDrop={handleDrop}
      onRatioChange={handleRatioChange}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  SplitContainer — recursive layout renderer                        */
/* ------------------------------------------------------------------ */

interface SplitContainerProps {
  node: LayoutNode;
  path: ('first' | 'second')[];
  dragPanelId: PanelId | null;
  onDragStart: (panelId: PanelId) => void;
  onDragEnd: () => void;
  onDrop: (targetPanelId: PanelId, edge: DropEdge) => void;
  onRatioChange: (path: ('first' | 'second')[], newRatio: number) => void;
}

function SplitContainer({
  node,
  path,
  dragPanelId,
  onDragStart,
  onDragEnd,
  onDrop,
  onRatioChange,
}: SplitContainerProps) {
  if (node.type === 'leaf') {
    return (
      <PanelFrame
        panelId={node.panelId}
        dragPanelId={dragPanelId}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDrop={onDrop}
      />
    );
  }

  const isHorizontal = node.direction === 'horizontal';

  return (
    <div className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} w-full h-full`}>
      <div
        style={
          isHorizontal
            ? { width: `${node.ratio * 100}%` }
            : { height: `${node.ratio * 100}%` }
        }
        className="min-w-0 min-h-0 overflow-hidden"
      >
        <SplitContainer
          node={node.first}
          path={[...path, 'first']}
          dragPanelId={dragPanelId}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDrop={onDrop}
          onRatioChange={onRatioChange}
        />
      </div>

      <Resizer
        direction={node.direction}
        path={path}
        onRatioChange={onRatioChange}
      />

      <div
        style={
          isHorizontal
            ? { width: `${(1 - node.ratio) * 100}%` }
            : { height: `${(1 - node.ratio) * 100}%` }
        }
        className="min-w-0 min-h-0 overflow-hidden"
      >
        <SplitContainer
          node={node.second}
          path={[...path, 'second']}
          dragPanelId={dragPanelId}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDrop={onDrop}
          onRatioChange={onRatioChange}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Resizer                                                            */
/* ------------------------------------------------------------------ */

interface ResizerProps {
  direction: 'horizontal' | 'vertical';
  path: ('first' | 'second')[];
  onRatioChange: (path: ('first' | 'second')[], newRatio: number) => void;
}

function Resizer({ direction, path, onRatioChange }: ResizerProps) {
  const isHorizontal = direction === 'horizontal';
  const resizerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const resizer = resizerRef.current;
      if (!resizer) return;
      const parent = resizer.parentElement;
      if (!parent) return;

      document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (ev: MouseEvent) => {
        const rect = parent.getBoundingClientRect();
        let ratio: number;
        if (isHorizontal) {
          ratio = (ev.clientX - rect.left) / rect.width;
        } else {
          ratio = (ev.clientY - rect.top) / rect.height;
        }
        ratio = Math.max(MIN_RATIO, Math.min(1 - MIN_RATIO, ratio));
        onRatioChange(path, ratio);
      };

      const handleMouseUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [isHorizontal, path, onRatioChange],
  );

  return (
    <div
      ref={resizerRef}
      onMouseDown={handleMouseDown}
      className={`flex-shrink-0 ${
        isHorizontal
          ? 'w-1.5 cursor-col-resize'
          : 'h-1.5 cursor-row-resize'
      } rounded-full bg-violet-200 dark:bg-violet-700/40 hover:bg-gradient-to-b hover:from-violet-400 hover:to-pink-400 dark:hover:from-violet-500 dark:hover:to-pink-500 transition-colors`}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  PanelFrame — wraps each panel with drag handle + drop zones       */
/* ------------------------------------------------------------------ */

interface PanelFrameProps {
  panelId: PanelId;
  dragPanelId: PanelId | null;
  onDragStart: (panelId: PanelId) => void;
  onDragEnd: () => void;
  onDrop: (targetPanelId: PanelId, edge: DropEdge) => void;
}

function PanelFrame({
  panelId,
  dragPanelId,
  onDragStart,
  onDragEnd,
  onDrop,
}: PanelFrameProps) {
  const { t } = useTranslation();
  const PaneComponent = PANEL_COMPONENTS[panelId];
  const [dropEdge, setDropEdge] = useState<DropEdge | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('application/panel-id', panelId);
      e.dataTransfer.effectAllowed = 'move';
      onDragStart(panelId);
    },
    [panelId, onDragStart],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes('application/panel-id')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      if (!dragPanelId || dragPanelId === panelId) {
        setDropEdge(null);
        return;
      }

      const rect = (frameRef.current ?? e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      // Determine which edge the cursor is closest to (25% threshold)
      let edge: DropEdge = 'center';
      if (y < 0.25) edge = 'top';
      else if (y > 0.75) edge = 'bottom';
      else if (x < 0.25) edge = 'left';
      else if (x > 0.75) edge = 'right';

      setDropEdge(edge);
    },
    [dragPanelId, panelId],
  );

  const handleDragLeave = useCallback(() => {
    setDropEdge(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (dropEdge && dragPanelId && dragPanelId !== panelId) {
        onDrop(panelId, dropEdge);
      }
      setDropEdge(null);
    },
    [dropEdge, dragPanelId, panelId, onDrop],
  );

  const isDragging = dragPanelId === panelId;

  return (
    <div
      ref={frameRef}
      className={`flex flex-col w-full h-full overflow-hidden ${
        isDragging ? 'opacity-50' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag handle bar */}
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        className="flex items-center justify-center h-5 flex-shrink-0 cursor-grab active:cursor-grabbing bg-cream-100/60 dark:bg-dpurple-900/60 border-b border-violet-200/50 dark:border-violet-700/30 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors group/handle select-none"
        title={t('layout.dragToReorder')}
      >
        {/* Panel title */}
        <span className="text-[10px] text-gray-400 dark:text-gray-500 group-hover/handle:text-violet-500 dark:group-hover/handle:text-violet-400 font-medium uppercase tracking-wider transition-colors mr-1">
          {t(PANEL_TITLE_KEYS[panelId])}
        </span>
        {/* Grip icon */}
        <svg
          width="16"
          height="6"
          viewBox="0 0 16 6"
          fill="none"
          className="text-gray-300 dark:text-gray-600 group-hover/handle:text-violet-400 dark:group-hover/handle:text-violet-400 transition-colors"
        >
          <circle cx="4" cy="1.5" r="1.2" fill="currentColor" />
          <circle cx="8" cy="1.5" r="1.2" fill="currentColor" />
          <circle cx="12" cy="1.5" r="1.2" fill="currentColor" />
          <circle cx="4" cy="4.5" r="1.2" fill="currentColor" />
          <circle cx="8" cy="4.5" r="1.2" fill="currentColor" />
          <circle cx="12" cy="4.5" r="1.2" fill="currentColor" />
        </svg>
      </div>

      {/* Panel content + drop overlay */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <PaneComponent />

        {/* Drop zone overlay */}
        {dropEdge && dragPanelId && dragPanelId !== panelId && (
          <DropOverlay edge={dropEdge} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DropOverlay — visual indicator for drop target edge               */
/* ------------------------------------------------------------------ */

function DropOverlay({ edge }: { edge: DropEdge }) {
  const baseClass = 'absolute pointer-events-none transition-all';

  if (edge === 'center') {
    return (
      <div className={`${baseClass} inset-0 bg-violet-400/20 border-2 border-violet-400 rounded-lg`} />
    );
  }

  const edgeStyles: Record<Exclude<DropEdge, 'center'>, string> = {
    top: 'inset-x-0 top-0 h-1/4',
    bottom: 'inset-x-0 bottom-0 h-1/4',
    left: 'inset-y-0 left-0 w-1/4',
    right: 'inset-y-0 right-0 w-1/4',
  };

  return (
    <div className={`${baseClass} ${edgeStyles[edge]} bg-violet-400/25 border-2 border-violet-400 rounded-sm`} />
  );
}
