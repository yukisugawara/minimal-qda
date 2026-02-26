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
import { CodeNode } from './CodeNode';
import { TheoryNode } from './TheoryNode';

interface MindMapModalProps {
  onClose: () => void;
  embedded?: boolean;
}

/** A code is a "group node" if it has no text selection and no bounding box */
function isGroupNode(code: Code): boolean {
  return code.startOffset === 0 && code.endOffset === 0 && !code.boundingBox;
}

/** Prefix used for custom link edge IDs */
const CUSTOM_LINK_PREFIX = 'custom-link-';

export function MindMapModal({ onClose, embedded }: MindMapModalProps) {
  const { t } = useTranslation();
  const allCodes = useAppStore((s) => s.codes);
  const codeLinks = useAppStore((s) => s.codeLinks);
  const files = useAppStore((s) => s.files);
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

  const codes = allCodes;

  // Build a set of all code IDs for filtering links
  const allCodeIds = useMemo(() => new Set(codes.map((c) => c.id)), [codes]);

  const nodeTypes = useMemo(() => ({ codeNode: CodeNode, theoryNode: TheoryNode }), []);

  // Build a map of file IDs to file entries for tooltip data
  const fileMap = useMemo(
    () => new Map(files.map((f) => [f.id, f])),
    [files],
  );

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
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });

    const getChildren = (parentId: string | null) =>
      codes
        .filter((c) => c.parentId === parentId)
        .sort((a, b) => a.order - b.order);

    // Root-level codes
    const rootCodes = getChildren(null);

    // Separate: codes with children (category-like) and codes without (uncategorized)
    const rootGroups = rootCodes.filter(
      (c) => isGroupNode(c) || getChildren(c.id).length > 0
    );
    const rootLeaves = rootCodes.filter(
      (c) => !isGroupNode(c) && getChildren(c.id).length === 0
    );

    const allGroups: { id: string; name: string; color: string; children: Code[] }[] = [];

    for (const group of rootGroups) {
      allGroups.push({
        id: group.id,
        name: group.text,
        color: group.color,
        children: getChildren(group.id),
      });
    }

    if (rootLeaves.length > 0) {
      allGroups.push({
        id: 'uncat',
        name: t('mindmap.uncategorized'),
        color: '#9ca3af',
        children: rootLeaves,
      });
    }

    // Recursive helper to add nodes for a subtree
    let currentX = 300;
    const addSubtree = (
      parentNodeId: string,
      children: Code[],
      x: number,
      baseY: number,
      parentColor: string,
    ): number => {
      const spacingY = 60;
      const startY = baseY - ((children.length - 1) * spacingY) / 2;

      children.forEach((code, ci) => {
        const codeNodeId = `code-${code.id}`;
        const y = startY + ci * spacingY;

        const file = fileMap.get(code.fileId);
        const isText = code.startOffset !== 0 || code.endOffset !== 0;
        const isImage = !!code.boundingBox;

        const nodeData: Record<string, unknown> = {
          label: code.text.length > 40 ? code.text.slice(0, 40) + '\u2026' : code.text,
          nodeStyle: {
            background: code.color + '30',
            border: `2px solid ${code.color}`,
            borderRadius: 12,
            fontSize: 11,
            padding: '6px 12px',
            maxWidth: 220,
          },
          fileName: file?.fileName,
        };

        if (isText && file?.fileContent) {
          nodeData.sourceText = file.fileContent.slice(code.startOffset, code.endOffset);
        } else if (isImage && file?.fileDataUrl) {
          nodeData.imageDataUrl = file.fileDataUrl;
          nodeData.boundingBox = code.boundingBox;
        }

        nodes.push({
          id: codeNodeId,
          type: 'codeNode',
          position: { x, y },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
          data: nodeData,
        });

        edges.push({
          id: `e-${parentNodeId}-${codeNodeId}`,
          source: parentNodeId,
          target: codeNodeId,
          style: { stroke: parentColor, strokeWidth: 1.5 },
        });

        // Recursively add grandchildren
        const grandchildren = getChildren(code.id);
        if (grandchildren.length > 0) {
          addSubtree(codeNodeId, grandchildren, x + 280, y, code.color);
        }
      });

      return children.length;
    };

    const catSpacingY = 140;
    const catStartY = -((allGroups.length - 1) * catSpacingY) / 2;

    allGroups.forEach((group, gi) => {
      const catNodeId = `cat-${group.id}`;
      const catY = catStartY + gi * catSpacingY;

      nodes.push({
        id: catNodeId,
        position: { x: currentX, y: catY },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: { label: `${group.name} (${group.children.length})` },
        style: {
          background: group.color + '20',
          border: `2px solid ${group.color}`,
          borderRadius: 14,
          fontWeight: 600,
          fontSize: 13,
          padding: '8px 16px',
        },
      });

      edges.push({
        id: `e-root-${catNodeId}`,
        source: rootId,
        target: catNodeId,
        style: { stroke: group.color, strokeWidth: 2 },
      });

      if (group.children.length > 0) {
        addSubtree(catNodeId, group.children, currentX + 320, catY, group.color);
      }
    });

    // Add custom link edges from codeLinks
    for (const link of codeLinks) {
      if (!allCodeIds.has(link.sourceCodeId) || !allCodeIds.has(link.targetCodeId)) continue;
      edges.push({
        id: `${CUSTOM_LINK_PREFIX}${link.id}`,
        source: `code-${link.sourceCodeId}`,
        target: `code-${link.targetCodeId}`,
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
  }, [codes, codeLinks, t, allCodeIds, fileMap]);

  const [nodeList, , onNodesChange] = useNodesState(initialNodes);
  const [edgeList, , onEdgesChange] = useEdgesState(initialEdges);

  const hasData = codes.length > 0;

  // Handle new connection from drag between nodes
  const handleConnect = useCallback((connection: Connection) => {
    const { source, target } = connection;
    if (!source || !target) return;
    // Only allow connections between code nodes (not root/cat)
    if (!source.startsWith('code-') || !target.startsWith('code-')) return;
    // Prevent self-links
    if (source === target) return;
    setDialogState({ type: 'create', sourceNodeId: source, targetNodeId: target });
  }, []);

  // Handle click on an edge
  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      // Only respond to custom link edges
      if (!edge.id.startsWith(CUSTOM_LINK_PREFIX)) return;
      const linkId = edge.id.slice(CUSTOM_LINK_PREFIX.length);
      const link = codeLinks.find((l) => l.id === linkId);
      if (!link) return;
      setDialogState({ type: 'edit', link });
    },
    [codeLinks],
  );

  // Dialog handlers
  const handleDialogSubmit = useCallback(
    (label: string) => {
      if (!dialogState) return;
      if (dialogState.type === 'create') {
        const sourceCodeId = dialogState.sourceNodeId.replace('code-', '');
        const targetCodeId = dialogState.targetNodeId.replace('code-', '');
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
          // Exclude controls and minimap from export
          const classList = (node as HTMLElement).classList;
          if (!classList) return true;
          return !classList.contains('react-flow__controls') &&
                 !classList.contains('react-flow__minimap');
        },
      });

      const store = useAppStore.getState();
      const active = store.files.find((f) => f.id === store.activeFileId);
      const defaultName = active?.fileName?.replace(/\.[^.]+$/, '') ?? 'mindmap';

      // Convert data URL to Blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      // Use File System Access API if available (Chrome / Edge)
      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: `${defaultName}_mindmap.png`,
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

      // Fallback: download with default name
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${defaultName}_mindmap.png`;
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
            {t('mindmap.noData')}
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
              {t('mindmap.exportImage')}
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
            {t('mindmap.title')}
          </h2>
          <div className="flex items-center gap-2">
            {hasData && (
              <button
                onClick={handleExportImage}
                className="px-4 py-1.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-pink-500 rounded-full hover:from-violet-600 hover:to-pink-600 active:scale-95 transition-all shadow-md"
              >
                {t('mindmap.exportImage')}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm bg-violet-100 dark:bg-violet-800/40 text-violet-600 dark:text-violet-200 rounded-full hover:bg-violet-200 dark:hover:bg-violet-700/40 active:scale-95 transition-all"
            >
              {t('mindmap.close')}
            </button>
          </div>
        </div>

        {flowContent}
      </div>
    </div>
  );
}
