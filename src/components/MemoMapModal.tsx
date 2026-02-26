import { useMemo, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  type ReactFlowInstance,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import { MemoNode } from './MemoNode';
import { TheoryNode } from './TheoryNode';

interface MemoMapModalProps {
  onClose: () => void;
  embedded?: boolean;
}

export function MemoMapModal({ onClose, embedded }: MemoMapModalProps) {
  const { t } = useTranslation();
  const allCodes = useAppStore((s) => s.codes);
  const allMemos = useAppStore((s) => s.memos);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const flowWrapperRef = useRef<HTMLDivElement>(null);

  const nodeTypes = useMemo(() => ({ memoNode: MemoNode, theoryNode: TheoryNode }), []);

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    if (allMemos.length === 0) return { initialNodes: nodes, initialEdges: edges };

    // Group memos by codeId
    const memosByCode = new Map<string | null, typeof allMemos>();
    for (const memo of allMemos) {
      const key = memo.codeId;
      if (!memosByCode.has(key)) memosByCode.set(key, []);
      memosByCode.get(key)!.push(memo);
    }

    // Root node (TheoryNode – editable)
    const rootId = 'root';
    nodes.push({
      id: rootId,
      type: 'theoryNode',
      position: { x: 0, y: 0 },
      data: {},
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });

    // Build code groups (codes that have memos + unassigned group)
    const codeGroups: { id: string; name: string; color: string; memos: typeof allMemos }[] = [];

    for (const [codeId, memos] of memosByCode.entries()) {
      if (codeId === null) {
        codeGroups.push({
          id: 'unassigned',
          name: t('memomap.unassigned'),
          color: '#9CA3AF',
          memos,
        });
      } else {
        const code = allCodes.find((c) => c.id === codeId);
        if (code) {
          codeGroups.push({
            id: code.id,
            name: code.text,
            color: code.color,
            memos,
          });
        }
      }
    }

    // Layout: code nodes vertically, memo nodes to their right
    const codeSpacingY = 140;
    const codeStartY = -((codeGroups.length - 1) * codeSpacingY) / 2;
    const codeX = 300;
    const memoX = 600;
    const memoSpacingY = 70;

    codeGroups.forEach((group, gi) => {
      const codeNodeId = `code-${group.id}`;
      const codeY = codeStartY + gi * codeSpacingY;

      // Code node
      nodes.push({
        id: codeNodeId,
        position: { x: codeX, y: codeY },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          label: `${group.name} (${group.memos.length})`,
        },
        style: {
          background: group.color + '20',
          border: `2px solid ${group.color}`,
          borderRadius: 14,
          fontWeight: 600,
          fontSize: 13,
          padding: '8px 16px',
        },
      });

      // Edge from root to code
      edges.push({
        id: `e-root-${codeNodeId}`,
        source: rootId,
        target: codeNodeId,
        style: { stroke: group.color, strokeWidth: 2 },
      });

      // Memo nodes
      const memoStartY = codeY - ((group.memos.length - 1) * memoSpacingY) / 2;

      group.memos.forEach((memo, mi) => {
        const memoNodeId = `memo-${memo.id}`;
        const truncated =
          memo.content.length > 80
            ? memo.content.slice(0, 80) + '\u2026'
            : memo.content;

        nodes.push({
          id: memoNodeId,
          type: 'memoNode',
          position: { x: memoX, y: memoStartY + mi * memoSpacingY },
          targetPosition: Position.Left,
          data: {
            label: truncated,
            codeName: group.name,
            codeColor: group.color,
            nodeStyle: {
              background: '#fff',
              border: `1.5px solid ${group.color}40`,
              borderRadius: 12,
              fontSize: 11,
              padding: '6px 12px',
              maxWidth: 260,
              lineHeight: '1.5',
              color: '#374151',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            },
          },
        });

        edges.push({
          id: `e-${codeNodeId}-${memoNodeId}`,
          source: codeNodeId,
          target: memoNodeId,
          style: { stroke: group.color + '60', strokeWidth: 1.5 },
        });
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [allCodes, allMemos, t]);

  const [nodeList, , onNodesChange] = useNodesState(initialNodes);
  const [edgeList, , onEdgesChange] = useEdgesState(initialEdges);

  const hasData = allMemos.length > 0;

  const handleExportImage = useCallback(async () => {
    const instance = rfInstanceRef.current;
    const wrapper = flowWrapperRef.current;
    if (!instance || !wrapper) return;

    try {
      instance.fitView({ padding: 0.2 });
      await new Promise((r) => setTimeout(r, 300));

      const dataUrl = await toPng(wrapper, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        filter: (node) => {
          const classList = (node as HTMLElement).classList;
          if (!classList) return true;
          return (
            !classList.contains('react-flow__controls') &&
            !classList.contains('react-flow__minimap')
          );
        },
      });

      const store = useAppStore.getState();
      const active = store.files.find((f) => f.id === store.activeFileId);
      const defaultName =
        active?.fileName?.replace(/\.[^.]+$/, '') ?? 'memomap';

      const res = await fetch(dataUrl);
      const blob = await res.blob();

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: `${defaultName}_memomap.png`,
            types: [
              {
                description: 'PNG Image',
                accept: { 'image/png': ['.png'] },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
        }
      }

      // Fallback
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${defaultName}_memomap.png`;
      a.click();
    } catch {
      alert('Failed to export image.');
    }
  }, []);

  const flowContent = (
    <div className="flex-1" ref={flowWrapperRef}>
      {hasData ? (
        <ReactFlow
          nodes={nodeList}
          edges={edgeList}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onInit={(instance) => {
            rfInstanceRef.current = instance;
            instance.fitView({ padding: 0.3 });
          }}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm">
          {t('memomap.noData')}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className="flex flex-col h-full">
        {hasData && (
          <div className="flex justify-end px-4 py-2">
            <button
              onClick={handleExportImage}
              className="px-4 py-1.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-pink-500 rounded-full hover:from-violet-600 hover:to-pink-600 active:scale-95 transition-all shadow-md"
            >
              {t('memomap.exportImage')}
            </button>
          </div>
        )}
        {flowContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
      <div className="bg-white/90 dark:bg-dpurple-900/90 backdrop-blur-md rounded-2xl shadow-xl w-[90vw] h-[85vh] flex flex-col border border-violet-200/50 dark:border-violet-600/30 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-violet-200/50 dark:border-violet-700/30">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {t('memomap.title')}
          </h2>
          <div className="flex items-center gap-2">
            {hasData && (
              <button
                onClick={handleExportImage}
                className="px-4 py-1.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-pink-500 rounded-full hover:from-violet-600 hover:to-pink-600 active:scale-95 transition-all shadow-md"
              >
                {t('memomap.exportImage')}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm bg-violet-100 dark:bg-violet-800/40 text-violet-600 dark:text-violet-200 rounded-full hover:bg-violet-200 dark:hover:bg-violet-700/40 active:scale-95 transition-all"
            >
              {t('memomap.close')}
            </button>
          </div>
        </div>

        {flowContent}
      </div>
    </div>
  );
}
