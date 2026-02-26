import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, MARKER_COLORS } from '../store/useAppStore';
import type { Code } from '../store/useAppStore';

/** A code is a "group node" if it has no text selection and no bounding box */
function isGroupNode(code: Code): boolean {
  return code.startOffset === 0 && code.endOffset === 0 && !code.boundingBox;
}

/** Get all descendant IDs of a given code (for circular reference prevention) */
function getDescendantIds(codes: Code[], parentId: string): Set<string> {
  const ids = new Set<string>();
  const stack = [parentId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const c of codes) {
      if (c.parentId === current && !ids.has(c.id)) {
        ids.add(c.id);
        stack.push(c.id);
      }
    }
  }
  return ids;
}

/** Count non-group descendant codes (actual text/image codes, not categories) */
function countDescendantCodes(codes: Code[], parentId: string): number {
  const descendantIds = getDescendantIds(codes, parentId);
  let count = 0;
  for (const c of codes) {
    if (descendantIds.has(c.id) && !isGroupNode(c)) {
      count++;
    }
  }
  return count;
}

type DropZone = 'above' | 'child' | 'below';

export function CodesPanel() {
  const { t } = useTranslation();
  const allCodes = useAppStore((s) => s.codes);
  const activeFileId = useAppStore((s) => s.activeFileId);
  const selectedCodeId = useAppStore((s) => s.selectedCodeId);
  const setSelectedCodeId = useAppStore((s) => s.setSelectedCodeId);
  const removeCode = useAppStore((s) => s.removeCode);
  const updateCodeColor = useAppStore((s) => s.updateCodeColor);
  const moveCode = useAppStore((s) => s.moveCode);
  const updateCodeText = useAppStore((s) => s.updateCodeText);

  // Filter codes by active file
  const codes = allCodes.filter((c) => c.fileId === activeFileId);

  const [colorPickerCodeId, setColorPickerCodeId] = useState<string | null>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [dragCodeId, setDragCodeId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ codeId: string; zone: DropZone } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [codesCollapsed, setCodesCollapsed] = useState(false);

  useEffect(() => {
    if (!colorPickerCodeId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setColorPickerCodeId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [colorPickerCodeId]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const getSortedChildren = useCallback(
    (parentId: string | null) =>
      codes
        .filter((c) => c.parentId === parentId)
        .sort((a, b) => a.order - b.order),
    [codes]
  );

  const handleDragStart = useCallback((e: React.DragEvent, codeId: string) => {
    e.dataTransfer.setData('text/plain', codeId);
    e.dataTransfer.effectAllowed = 'move';
    setDragCodeId(codeId);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dragCodeId || dragCodeId === targetId) return;

      // Prevent dropping onto own descendants
      const descendants = getDescendantIds(codes, dragCodeId);
      if (descendants.has(targetId)) return;

      e.dataTransfer.dropEffect = 'move';

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const y = e.clientY - rect.top;
      const third = rect.height / 3;

      let zone: DropZone;
      if (y < third) zone = 'above';
      else if (y > third * 2) zone = 'below';
      else zone = 'child';

      setDropTarget({ codeId: targetId, zone });
    },
    [dragCodeId, codes]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const codeId = e.dataTransfer.getData('text/plain');
      if (!codeId || codeId === targetId || !dropTarget) {
        setDropTarget(null);
        setDragCodeId(null);
        return;
      }

      const descendants = getDescendantIds(codes, codeId);
      if (descendants.has(targetId)) {
        setDropTarget(null);
        setDragCodeId(null);
        return;
      }

      const target = codes.find((c) => c.id === targetId);
      if (!target) return;

      const { zone } = dropTarget;

      if (zone === 'child') {
        // Drop as child of target
        const children = codes.filter((c) => c.parentId === targetId);
        const maxOrder = children.length > 0 ? Math.max(...children.map((c) => c.order)) : -1;
        moveCode(codeId, targetId, maxOrder + 1);
      } else {
        // Drop above or below target as sibling
        const siblings = codes
          .filter((c) => c.parentId === target.parentId && c.id !== codeId)
          .sort((a, b) => a.order - b.order);
        const targetIndex = siblings.findIndex((c) => c.id === targetId);
        const insertIndex = zone === 'above' ? targetIndex : targetIndex + 1;

        // Re-order siblings
        const reordered = [...siblings];
        reordered.splice(insertIndex, 0, { id: codeId } as Code);

        // Batch updates: set the dragged code's parent and order, then re-order siblings
        const store = useAppStore.getState();
        const newCodes = store.codes.map((c) => {
          if (c.id === codeId) {
            return { ...c, parentId: target.parentId, order: insertIndex };
          }
          const idx = reordered.findIndex((r) => r.id === c.id);
          if (idx !== -1 && c.parentId === target.parentId) {
            return { ...c, order: idx };
          }
          return c;
        });
        useAppStore.setState({ codes: newCodes });
      }

      setDropTarget(null);
      setDragCodeId(null);
    },
    [dropTarget, codes, moveCode]
  );

  const handleDragEnd = useCallback(() => {
    setDropTarget(null);
    setDragCodeId(null);
  }, []);

  // Drop on the empty root area
  const handleRootDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (dragCodeId) {
        e.dataTransfer.dropEffect = 'move';
      }
    },
    [dragCodeId]
  );

  const handleRootDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const codeId = e.dataTransfer.getData('text/plain');
      if (!codeId) return;
      const rootSiblings = codes.filter((c) => c.parentId === null);
      const maxOrder = rootSiblings.length > 0 ? Math.max(...rootSiblings.map((c) => c.order)) : -1;
      moveCode(codeId, null, maxOrder + 1);
      setDropTarget(null);
      setDragCodeId(null);
    },
    [codes, moveCode]
  );

  const rootCodes = getSortedChildren(null);

  return (
    <div className="flex flex-col h-full bg-cream-100/60 dark:bg-dpurple-900/60">
      {/* Code tree section */}
      <div
        className="flex items-center justify-between px-3 pt-3 pb-1 cursor-pointer select-none hover:bg-violet-50/50 dark:hover:bg-violet-900/20 transition-colors"
        onClick={() => setCodesCollapsed((v) => !v)}
      >
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
          {t('leftPane.codes')} ({codes.length})
        </h2>
        <span className="text-xs text-gray-400 dark:text-gray-500 transition-transform" style={{ transform: codesCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </div>

      {!codesCollapsed && (
        <div
          className="flex-1 overflow-y-auto px-3 pb-3 min-h-0"
          onDragOver={handleRootDragOver}
          onDrop={handleRootDrop}
        >
          {codes.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-2">
              {t('leftPane.noItems')}
            </p>
          ) : (
            <ul className="space-y-0.5 mt-1">
              {rootCodes.map((code) => (
                <TreeNode
                  key={code.id}
                  code={code}
                  depth={0}
                  codes={codes}
                  selectedCodeId={selectedCodeId}
                  setSelectedCodeId={setSelectedCodeId}
                  removeCode={removeCode}
                  updateCodeColor={updateCodeColor}
                  updateCodeText={updateCodeText}
                  colorPickerCodeId={colorPickerCodeId}
                  setColorPickerCodeId={setColorPickerCodeId}
                  colorPickerRef={colorPickerRef}
                  collapsedIds={collapsedIds}
                  toggleCollapse={toggleCollapse}
                  getSortedChildren={getSortedChildren}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  dropTarget={dropTarget}
                  dragCodeId={dragCodeId}
                  editingId={editingId}
                  setEditingId={setEditingId}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

interface TreeNodeProps {
  code: Code;
  depth: number;
  codes: Code[];
  selectedCodeId: string | null;
  setSelectedCodeId: (id: string | null) => void;
  removeCode: (id: string) => void;
  updateCodeColor: (id: string, color: string) => void;
  updateCodeText: (id: string, text: string) => void;
  colorPickerCodeId: string | null;
  setColorPickerCodeId: (id: string | null) => void;
  colorPickerRef: React.RefObject<HTMLDivElement | null>;
  collapsedIds: Set<string>;
  toggleCollapse: (id: string) => void;
  getSortedChildren: (parentId: string | null) => Code[];
  onDragStart: (e: React.DragEvent, codeId: string) => void;
  onDragOver: (e: React.DragEvent, targetId: string) => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
  onDragEnd: () => void;
  dropTarget: { codeId: string; zone: DropZone } | null;
  dragCodeId: string | null;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
}

function TreeNode({
  code,
  depth,
  codes,
  selectedCodeId,
  setSelectedCodeId,
  removeCode,
  updateCodeColor,
  updateCodeText,
  colorPickerCodeId,
  setColorPickerCodeId,
  colorPickerRef,
  collapsedIds,
  toggleCollapse,
  getSortedChildren,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dropTarget,
  dragCodeId,
  editingId,
  setEditingId,
}: TreeNodeProps) {
  const children = getSortedChildren(code.id);
  const hasChildren = children.length > 0;
  const isGroup = isGroupNode(code);
  const isCollapsed = collapsedIds.has(code.id);
  const isDragging = dragCodeId === code.id;
  const isDropTarget = dropTarget?.codeId === code.id;
  const dropZone = isDropTarget ? dropTarget.zone : null;
  // Count: self (1 if actual code) + all descendant non-group codes
  const selfCount = isGroup ? 0 : 1;
  const descendantCodeCount = countDescendantCodes(codes, code.id);
  const totalCodeCount = selfCount + descendantCodeCount;

  const dropBorderClass =
    dropZone === 'above'
      ? 'border-t-2 border-t-violet-400'
      : dropZone === 'below'
        ? 'border-b-2 border-b-violet-400'
        : dropZone === 'child'
          ? 'ring-2 ring-violet-400'
          : '';

  return (
    <li>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, code.id)}
        onDragOver={(e) => onDragOver(e, code.id)}
        onDrop={(e) => onDrop(e, code.id)}
        onDragEnd={onDragEnd}
        onClick={() => setSelectedCodeId(code.id)}
        className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm cursor-grab active:cursor-grabbing transition-all ${
          selectedCodeId === code.id
            ? 'bg-gradient-to-r from-violet-100 to-pink-50 dark:from-violet-800/30 dark:to-pink-900/20 ring-1 ring-violet-300 dark:ring-violet-600 shadow-sm'
            : 'hover:bg-violet-50 dark:hover:bg-violet-900/20'
        } ${isDragging ? 'opacity-40' : ''} ${dropBorderClass}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Collapse toggle for groups or nodes with children */}
        {(isGroup || hasChildren) ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(code.id);
            }}
            className="w-4 h-4 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
          >
            {isCollapsed ? '▶' : '▼'}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* Color tag */}
        <div className="relative flex-shrink-0" ref={colorPickerCodeId === code.id ? colorPickerRef : undefined}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setColorPickerCodeId(colorPickerCodeId === code.id ? null : code.id);
            }}
            className="flex items-center hover:brightness-110 active:scale-95 transition-all"
            title="Change color"
          >
            {isGroup ? (
              /* Folder-style tag for groups */
              <svg width="18" height="16" viewBox="0 0 18 16" fill="none" className="drop-shadow-sm">
                <path d="M1 3C1 1.9 1.9 1 3 1H7L9 3H15C16.1 3 17 3.9 17 5V13C17 14.1 16.1 15 15 15H3C1.9 15 1 14.1 1 13V3Z" fill={code.color} fillOpacity="0.7" stroke={code.color} strokeWidth="1.2"/>
              </svg>
            ) : (
              /* Tag-shape mark for codes */
              <svg width="18" height="16" viewBox="0 0 18 16" fill="none" className="drop-shadow-sm">
                <path d="M1 2.5C1 1.67 1.67 1 2.5 1H11.3C11.72 1 12.12 1.17 12.42 1.47L16.5 6.5C17.17 7.17 17.17 8.83 16.5 9.5L12.42 14.53C12.12 14.83 11.72 15 11.3 15H2.5C1.67 15 1 14.33 1 13.5V2.5Z" fill={code.color} fillOpacity="0.6" stroke={code.color} strokeWidth="1.2"/>
                <circle cx="13" cy="8" r="1.5" fill="white" fillOpacity="0.8"/>
              </svg>
            )}
          </button>
          {colorPickerCodeId === code.id && (
            <div className="absolute left-0 top-6 z-50 glass bg-white/80 dark:bg-dpurple-800/80 border border-violet-200/50 dark:border-violet-600/30 rounded-2xl shadow-lg p-2 grid grid-cols-2 gap-1.5 w-[60px] animate-scale-in">
              {MARKER_COLORS.map((mc) => (
                <button
                  key={mc}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateCodeColor(code.id, mc);
                    setColorPickerCodeId(null);
                  }}
                  className={`w-5 h-5 rounded-full border-2 hover:scale-110 active:scale-95 transition-transform ${
                    mc === code.color
                      ? 'border-violet-500 dark:border-violet-300 ring-1 ring-violet-400'
                      : 'border-white/60 dark:border-violet-700/40'
                  }`}
                  style={{ backgroundColor: mc }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Text / Editable name */}
        {editingId === code.id ? (
          <InlineEditor
            initialValue={code.text}
            onSave={(text) => {
              updateCodeText(code.id, text);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <span
            className={`truncate flex-1 ${isGroup ? 'font-semibold' : ''}`}
            title={code.text}
            onDoubleClick={(e) => {
              if (isGroup) {
                e.stopPropagation();
                setEditingId(code.id);
              }
            }}
          >
            {code.text.length > 30 ? code.text.slice(0, 30) + '\u2026' : code.text}
          </span>
        )}

        {/* Code count: all codes show their total (self + descendants) */}
        {totalCodeCount > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 tabular-nums">
            {totalCodeCount}
          </span>
        )}

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeCode(code.id);
          }}
          className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-500 hover:text-red-500 text-xs flex-shrink-0 transition-opacity"
          title="Delete"
        >
          ✕
        </button>
      </div>

      {/* Children */}
      {hasChildren && !isCollapsed && (
        <ul className="space-y-0.5">
          {children.map((child) => (
            <TreeNode
              key={child.id}
              code={child}
              depth={depth + 1}
              codes={codes}
              selectedCodeId={selectedCodeId}
              setSelectedCodeId={setSelectedCodeId}
              removeCode={removeCode}
              updateCodeColor={updateCodeColor}
              updateCodeText={updateCodeText}
              colorPickerCodeId={colorPickerCodeId}
              setColorPickerCodeId={setColorPickerCodeId}
              colorPickerRef={colorPickerRef}
              collapsedIds={collapsedIds}
              toggleCollapse={toggleCollapse}
              getSortedChildren={getSortedChildren}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              dropTarget={dropTarget}
              dragCodeId={dragCodeId}
              editingId={editingId}
              setEditingId={setEditingId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Inline text editor for renaming group nodes */
function InlineEditor({
  initialValue,
  onSave,
  onCancel,
}: {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onSave(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') onCancel();
      }}
      onClick={(e) => e.stopPropagation()}
      className="flex-1 min-w-0 text-sm border border-violet-300 dark:border-violet-600 dark:bg-dpurple-800 dark:text-gray-100 rounded-lg px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
      autoFocus
    />
  );
}
