import { useMemo, useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  type ReactFlowInstance,
  type Connection,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';
import type { Code, CodeLink } from '../store/useAppStore';
import { LinkLabelDialog } from './LinkLabelDialog';
import { CategoryNode } from './CategoryNode';
import { TheoryNode } from './TheoryNode';

interface CategoryMapModalProps {
  onClose: () => void;
  embedded?: boolean;
}

/** A code is a "group node" if it has no text selection and no bounding box */
function isGroupNode(code: Code): boolean {
  return code.startOffset === 0 && code.endOffset === 0 && !code.boundingBox;
}

/** Prefix used for custom link edge IDs */
const CUSTOM_LINK_PREFIX = 'custom-link-';

/** Count all descendants recursively */
function countDescendants(codeId: string, codes: Code[]): number {
  const children = codes.filter((c) => c.parentId === codeId);
  let count = children.length;
  for (const child of children) {
    count += countDescendants(child.id, codes);
  }
  return count;
}

export function CategoryMapModal({ onClose, embedded }: CategoryMapModalProps) {
  const { t } = useTranslation();
  const allCodes = useAppStore((s) => s.codes);
  const codeLinks = useAppStore((s) => s.codeLinks);
  const addCodeLink = useAppStore((s) => s.addCodeLink);
  const removeCodeLink = useAppStore((s) => s.removeCodeLink);
  const updateCodeLinkLabel = useAppStore((s) => s.updateCodeLinkLabel);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);
  const flowWrapperRef = useRef<HTMLDivElement>(null);

  // Dialog state
  const [dialogState, setDialogState] = useState<
    | { type: 'create'; sourceNodeId: string; targetNodeId: string }
    | { type: 'edit'; link: CodeLink }
    | null
  >(null);

  const nodeTypes = useMemo(() => ({ categoryNode: CategoryNode, theoryNode: TheoryNode }), []);

  const getChildren = useCallback(
    (parentId: string | null) =>
      allCodes
        .filter((c) => c.parentId === parentId)
        .sort((a, b) => a.order - b.order),
    [allCodes],
  );

  // Categories = root-level codes that are groups or have children
  const categories = useMemo(() => {
    const rootCodes = getChildren(null);
    return rootCodes.filter(
      (c) => isGroupNode(c) || getChildren(c.id).length > 0,
    );
  }, [getChildren]);

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Root node (TheoryNode – editable)
    const rootId = 'root';
    nodes.push({
      id: rootId,
      type: 'theoryNode',
      position: { x: 0, y: 0 },
      data: {},
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });

    const catSpacingX = 250;
    const catStartX = -((categories.length - 1) * catSpacingX) / 2;

    categories.forEach((cat, i) => {
      const catNodeId = `cat-${cat.id}`;
      const catX = catStartX + i * catSpacingX;

      const children = getChildren(cat.id);
      const totalDescendants = countDescendants(cat.id, allCodes);

      const childCodes = children.map((child) => ({
        text:
          child.text.length > 40
            ? child.text.slice(0, 40) + '\u2026'
            : child.text,
        childCount: countDescendants(child.id, allCodes),
      }));

      nodes.push({
        id: catNodeId,
        type: 'categoryNode',
        position: { x: catX, y: 200 },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: {
          label: `${cat.text} (${totalDescendants})`,
          childCodes,
          totalDescendants,
          nodeStyle: {
            background: cat.color + '20',
            border: `2px solid ${cat.color}`,
            borderRadius: 14,
            fontWeight: 600,
            fontSize: 13,
            padding: '8px 16px',
          },
        },
      });

      edges.push({
        id: `e-root-${catNodeId}`,
        source: rootId,
        target: catNodeId,
        style: { stroke: cat.color, strokeWidth: 2 },
      });
    });

    // Build a set of all node IDs for custom link lookup
    const nodeIdSet = new Set(nodes.map((n) => n.id));

    const findNodeId = (rawId: string): string | null => {
      for (const prefix of ['cat-', 'code-', 'memo-', '']) {
        const candidate = prefix ? `${prefix}${rawId}` : rawId;
        if (nodeIdSet.has(candidate)) return candidate;
      }
      return rawId === 'root' && nodeIdSet.has('root') ? 'root' : null;
    };

    // Add custom link edges
    for (const link of codeLinks) {
      const sourceId = findNodeId(link.sourceCodeId);
      const targetId = findNodeId(link.targetCodeId);
      if (!sourceId || !targetId) continue;
      edges.push({
        id: `${CUSTOM_LINK_PREFIX}${link.id}`,
        source: sourceId,
        target: targetId,
        label: link.label || undefined,
        style: { stroke: '#A855F7', strokeWidth: 2, strokeDasharray: '6 3' },
        labelStyle: { fill: '#7C3AED', fontWeight: 600, fontSize: 11 },
        labelBgStyle: { fill: '#F5F3FF', fillOpacity: 0.9 },
        labelBgPadding: [4, 8] as [number, number],
        labelBgBorderRadius: 6,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#A855F7' },
        animated: true,
      });
    }

    return { initialNodes: nodes, initialEdges: edges };
  }, [categories, codeLinks, getChildren, allCodes]);

  const [nodeList, , onNodesChange] = useNodesState(initialNodes);
  const [edgeList, , onEdgesChange] = useEdgesState(initialEdges);

  const hasData = categories.length > 0;

  // Handle new connection from drag between nodes
  const handleConnect = useCallback((connection: Connection) => {
    const { source, target } = connection;
    if (!source || !target) return;
    if (source === target) return;
    setDialogState({ type: 'create', sourceNodeId: source, targetNodeId: target });
  }, []);

  // Handle click on an edge
  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (!edge.id.startsWith(CUSTOM_LINK_PREFIX)) return;
      const linkId = edge.id.slice(CUSTOM_LINK_PREFIX.length);
      const link = codeLinks.find((l) => l.id === linkId);
      if (!link) return;
      setDialogState({ type: 'edit', link });
    },
    [codeLinks],
  );

  const stripNodePrefix = (nodeId: string): string => {
    if (nodeId === 'root') return 'root';
    const idx = nodeId.indexOf('-');
    return idx >= 0 ? nodeId.slice(idx + 1) : nodeId;
  };

  // Dialog handlers
  const handleDialogSubmit = useCallback(
    (label: string) => {
      if (!dialogState) return;
      if (dialogState.type === 'create') {
        const sourceCodeId = stripNodePrefix(dialogState.sourceNodeId);
        const targetCodeId = stripNodePrefix(dialogState.targetNodeId);
        addCodeLink({
          id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          sourceCodeId,
          targetCodeId,
          label,
        });
      } else {
        updateCodeLinkLabel(dialogState.link.id, label);
      }
      setDialogState(null);
    },
    [dialogState, addCodeLink, updateCodeLinkLabel],
  );

  const handleDialogDelete = useCallback(() => {
    if (dialogState?.type === 'edit') {
      removeCodeLink(dialogState.link.id);
    }
    setDialogState(null);
  }, [dialogState, removeCodeLink]);

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
        active?.fileName?.replace(/\.[^.]+$/, '') ?? 'categorymap';

      // Convert data URL to Blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      // Use File System Access API if available
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: `${defaultName}_categorymap.png`,
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
      a.download = `${defaultName}_categorymap.png`;
      a.click();
    } catch {
      alert('Failed to export image.');
    }
  }, []);

  const flowContent = (
    <>
      <div className="flex-1" ref={flowWrapperRef}>
        {hasData ? (
          <ReactFlow
            nodes={nodeList}
            edges={edgeList}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onEdgeClick={handleEdgeClick}
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
            {t('categorymap.noData')}
          </div>
        )}
      </div>

      {dialogState && (
        <LinkLabelDialog
          mode={dialogState.type}
          initialLabel={dialogState.type === 'edit' ? dialogState.link.label : ''}
          onSubmit={handleDialogSubmit}
          onDelete={dialogState.type === 'edit' ? handleDialogDelete : undefined}
          onCancel={() => setDialogState(null)}
        />
      )}
    </>
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
              {t('categorymap.exportImage')}
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
            {t('categorymap.title')}
          </h2>
          <div className="flex items-center gap-2">
            {hasData && (
              <button
                onClick={handleExportImage}
                className="px-4 py-1.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-pink-500 rounded-full hover:from-violet-600 hover:to-pink-600 active:scale-95 transition-all shadow-md"
              >
                {t('categorymap.exportImage')}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm bg-violet-100 dark:bg-violet-800/40 text-violet-600 dark:text-violet-200 rounded-full hover:bg-violet-200 dark:hover:bg-violet-700/40 active:scale-95 transition-all"
            >
              {t('categorymap.close')}
            </button>
          </div>
        </div>

        {flowContent}
      </div>
    </div>
  );
}
