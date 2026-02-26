import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, MARKER_COLORS } from '../store/useAppStore';
import type { Memo } from '../store/useAppStore';

let memoIdCounter = 0;
function nextMemoId() {
  return `memo-${++memoIdCounter}-${Date.now()}`;
}

/** Get all descendant IDs of a given memo (for circular reference prevention) */
function getMemoDescendantIds(memos: Memo[], parentId: string): Set<string> {
  const ids = new Set<string>();
  const stack = [parentId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const m of memos) {
      if (m.parentId === current && !ids.has(m.id)) {
        ids.add(m.id);
        stack.push(m.id);
      }
    }
  }
  return ids;
}

type DropZone = 'above' | 'child' | 'below';

export function RightPane() {
  const { t } = useTranslation();
  const memos = useAppStore((s) => s.memos);
  const allCodes = useAppStore((s) => s.codes);
  const activeFileId = useAppStore((s) => s.activeFileId);
  const selectedCodeId = useAppStore((s) => s.selectedCodeId);
  const addMemo = useAppStore((s) => s.addMemo);
  const updateMemo = useAppStore((s) => s.updateMemo);
  const removeMemo = useAppStore((s) => s.removeMemo);
  const moveMemo = useAppStore((s) => s.moveMemo);
  const updateCodeColor = useAppStore((s) => s.updateCodeColor);
  const [draft, setDraft] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [dragMemoId, setDragMemoId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ memoId: string; zone: DropZone } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [memosCollapsed, setMemosCollapsed] = useState(false);

  // Close color picker on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker]);

  // Reset color picker when selection changes
  useEffect(() => {
    setShowColorPicker(false);
  }, [selectedCodeId]);

  // Filter codes by active file
  const codes = allCodes.filter((c) => c.fileId === activeFileId);
  const codeIds = new Set(codes.map((c) => c.id));

  const selectedCode = codes.find((c) => c.id === selectedCodeId) ?? null;

  // Show memos for the selected code, or file-scoped memos if nothing selected
  const filteredMemos = selectedCodeId
    ? memos.filter((m) => m.codeId === selectedCodeId)
    : memos.filter((m) => !m.codeId || codeIds.has(m.codeId));

  // Build a code lookup map for color resolution
  const codeMap = new Map(allCodes.map((c) => [c.id, c]));

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
      filteredMemos
        .filter((m) => m.parentId === parentId)
        .sort((a, b) => a.order - b.order),
    [filteredMemos]
  );

  const handleDragStart = useCallback((e: React.DragEvent, memoId: string) => {
    e.dataTransfer.setData('text/plain', memoId);
    e.dataTransfer.effectAllowed = 'move';
    setDragMemoId(memoId);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dragMemoId || dragMemoId === targetId) return;

      // Prevent dropping onto own descendants
      const descendants = getMemoDescendantIds(filteredMemos, dragMemoId);
      if (descendants.has(targetId)) return;

      e.dataTransfer.dropEffect = 'move';

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const y = e.clientY - rect.top;
      const third = rect.height / 3;

      let zone: DropZone;
      if (y < third) zone = 'above';
      else if (y > third * 2) zone = 'below';
      else {
        // Only allow nesting if same codeId
        const dragMemo = filteredMemos.find((m) => m.id === dragMemoId);
        const targetMemo = filteredMemos.find((m) => m.id === targetId);
        if (dragMemo && targetMemo && dragMemo.codeId === targetMemo.codeId) {
          zone = 'child';
        } else {
          // Fall back to closest edge
          zone = y < rect.height / 2 ? 'above' : 'below';
        }
      }

      setDropTarget({ memoId: targetId, zone });
    },
    [dragMemoId, filteredMemos]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const memoId = e.dataTransfer.getData('text/plain');
      if (!memoId || memoId === targetId || !dropTarget) {
        setDropTarget(null);
        setDragMemoId(null);
        return;
      }

      const descendants = getMemoDescendantIds(filteredMemos, memoId);
      if (descendants.has(targetId)) {
        setDropTarget(null);
        setDragMemoId(null);
        return;
      }

      const target = filteredMemos.find((m) => m.id === targetId);
      if (!target) return;

      const { zone } = dropTarget;

      if (zone === 'child') {
        const children = filteredMemos.filter((m) => m.parentId === targetId);
        const maxOrder = children.length > 0 ? Math.max(...children.map((m) => m.order)) : -1;
        moveMemo(memoId, targetId, maxOrder + 1);
      } else {
        // Drop above or below target as sibling
        const siblings = filteredMemos
          .filter((m) => m.parentId === target.parentId && m.id !== memoId)
          .sort((a, b) => a.order - b.order);
        const targetIndex = siblings.findIndex((m) => m.id === targetId);
        const insertIndex = zone === 'above' ? targetIndex : targetIndex + 1;

        // Re-order siblings
        const reordered = [...siblings];
        reordered.splice(insertIndex, 0, { id: memoId } as Memo);

        // Batch update
        const store = useAppStore.getState();
        const newMemos = store.memos.map((m) => {
          if (m.id === memoId) {
            return { ...m, parentId: target.parentId, order: insertIndex };
          }
          const idx = reordered.findIndex((r) => r.id === m.id);
          if (idx !== -1 && m.parentId === target.parentId) {
            return { ...m, order: idx };
          }
          return m;
        });
        useAppStore.setState({ memos: newMemos });
      }

      setDropTarget(null);
      setDragMemoId(null);
    },
    [dropTarget, filteredMemos, moveMemo]
  );

  const handleDragEnd = useCallback(() => {
    setDropTarget(null);
    setDragMemoId(null);
  }, []);

  // Drop on the empty root area
  const handleRootDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (dragMemoId) {
        e.dataTransfer.dropEffect = 'move';
      }
    },
    [dragMemoId]
  );

  const handleRootDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const memoId = e.dataTransfer.getData('text/plain');
      if (!memoId) return;
      const rootSiblings = filteredMemos.filter((m) => m.parentId === null);
      const maxOrder = rootSiblings.length > 0 ? Math.max(...rootSiblings.map((m) => m.order)) : -1;
      moveMemo(memoId, null, maxOrder + 1);
      setDropTarget(null);
      setDragMemoId(null);
    },
    [filteredMemos, moveMemo]
  );

  const handleAddMemo = () => {
    if (!draft.trim()) return;
    const memo: Memo = {
      id: nextMemoId(),
      codeId: selectedCodeId,
      content: draft.trim(),
      createdAt: Date.now(),
      parentId: null,
      order: 0,
    };
    addMemo(memo);
    setDraft('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleAddMemo();
    }
  };

  const rootMemos = getSortedChildren(null);

  return (
    <div className="flex flex-col h-full bg-cream-100/60 dark:bg-dpurple-900/60">
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 border-b border-violet-200/50 dark:border-violet-700/30 cursor-pointer select-none hover:bg-violet-50/50 dark:hover:bg-violet-900/20 transition-colors"
        onClick={() => setMemosCollapsed((v) => !v)}
      >
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
          {t('rightPane.memos')} ({filteredMemos.length})
        </h2>
        <span className="text-xs text-gray-400 dark:text-gray-500 transition-transform" style={{ transform: memosCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
          ▼
        </span>
      </div>

      {!memosCollapsed && (
        <>
          {selectedCode && (
            <div className="px-3 py-1.5 border-b border-violet-200/50 dark:border-violet-700/30">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-shrink-0" ref={colorPickerRef}>
                  <button
                    onClick={() => setShowColorPicker((v) => !v)}
                    className="w-5 h-5 rounded-full ring-2 ring-white dark:ring-dpurple-800 hover:ring-violet-300 dark:hover:ring-violet-500 shadow-sm transition-all active:scale-90"
                    style={{ backgroundColor: selectedCode.color }}
                    title={t('rightPane.changeColor')}
                  />
                  {showColorPicker && (
                    <div className="absolute left-0 top-7 z-50 glass bg-white/80 dark:bg-dpurple-800/80 border border-violet-200/50 dark:border-violet-600/30 rounded-2xl shadow-lg p-2 grid grid-cols-2 gap-1.5 w-[60px] animate-scale-in">
                      {MARKER_COLORS.map((mc) => (
                        <button
                          key={mc}
                          onClick={() => {
                            updateCodeColor(selectedCode.id, mc);
                            setShowColorPicker(false);
                          }}
                          className={`w-5 h-5 rounded-full border-2 hover:scale-110 active:scale-95 transition-transform ${
                            mc === selectedCode.color
                              ? 'border-violet-500 dark:border-violet-300 ring-1 ring-violet-400'
                              : 'border-white/60 dark:border-violet-700/40'
                          }`}
                          style={{ backgroundColor: mc }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {selectedCode.text.length > 50
                    ? selectedCode.text.slice(0, 50) + '\u2026'
                    : selectedCode.text}
                </span>
              </div>
            </div>
          )}

          {/* Memo tree */}
          <div
            className="flex-1 overflow-y-auto px-3 py-2 min-h-0"
            onDragOver={handleRootDragOver}
            onDrop={handleRootDrop}
          >
            {filteredMemos.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                {t('rightPane.noMemos')}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {rootMemos.map((memo) => (
                  <MemoTreeNode
                    key={memo.id}
                    memo={memo}
                    depth={0}
                    allMemos={filteredMemos}
                    codeMap={codeMap}
                    collapsedIds={collapsedIds}
                    toggleCollapse={toggleCollapse}
                    getSortedChildren={getSortedChildren}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    dropTarget={dropTarget}
                    dragMemoId={dragMemoId}
                    editingId={editingId}
                    setEditingId={setEditingId}
                    onUpdate={updateMemo}
                    onRemove={removeMemo}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Add memo input */}
          <div className="p-3 border-t border-violet-200/50 dark:border-violet-700/30">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('rightPane.addMemo') + '...'}
              rows={3}
              className="w-full text-sm border border-violet-200 dark:border-violet-600/40 dark:bg-dpurple-800 dark:text-gray-100 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <button
              onClick={handleAddMemo}
              disabled={!draft.trim()}
              className="mt-2 w-full px-3 py-2 text-sm font-semibold text-white rounded-full bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shadow-md"
            >
              {t('rightPane.addMemo')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Speech bubble SVG icon for memos */
function MemoTagIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" fill="none" className="drop-shadow-sm flex-shrink-0">
      <path
        d="M1 2.5C1 1.67 1.67 1 2.5 1H15.5C16.33 1 17 1.67 17 2.5V10.5C17 11.33 16.33 12 15.5 12H5L2 15V12H2.5C1.67 12 1 11.33 1 10.5V2.5Z"
        fill={color}
        fillOpacity="0.6"
        stroke={color}
        strokeWidth="1.2"
      />
      {/* Two text lines inside the bubble */}
      <line x1="4.5" y1="5" x2="13.5" y2="5" stroke="white" strokeOpacity="0.8" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="4.5" y1="8.5" x2="10.5" y2="8.5" stroke="white" strokeOpacity="0.8" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

interface MemoTreeNodeProps {
  memo: Memo;
  depth: number;
  allMemos: Memo[];
  codeMap: Map<string, { color: string }>;
  collapsedIds: Set<string>;
  toggleCollapse: (id: string) => void;
  getSortedChildren: (parentId: string | null) => Memo[];
  onDragStart: (e: React.DragEvent, memoId: string) => void;
  onDragOver: (e: React.DragEvent, targetId: string) => void;
  onDrop: (e: React.DragEvent, targetId: string) => void;
  onDragEnd: () => void;
  dropTarget: { memoId: string; zone: DropZone } | null;
  dragMemoId: string | null;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onUpdate: (id: string, content: string) => void;
  onRemove: (id: string) => void;
}

function MemoTreeNode({
  memo,
  depth,
  allMemos,
  codeMap,
  collapsedIds,
  toggleCollapse,
  getSortedChildren,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dropTarget,
  dragMemoId,
  editingId,
  setEditingId,
  onUpdate,
  onRemove,
}: MemoTreeNodeProps) {
  const { t } = useTranslation();
  const children = getSortedChildren(memo.id);
  const hasChildren = children.length > 0;
  const isCollapsed = collapsedIds.has(memo.id);
  const isDragging = dragMemoId === memo.id;
  const isDropTarget = dropTarget?.memoId === memo.id;
  const dropZone = isDropTarget ? dropTarget.zone : null;
  const isEditing = editingId === memo.id;

  const code = memo.codeId ? codeMap.get(memo.codeId) : null;
  const tagColor = code?.color ?? '#9CA3AF';

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
        draggable={!isEditing}
        onDragStart={(e) => onDragStart(e, memo.id)}
        onDragOver={(e) => onDragOver(e, memo.id)}
        onDrop={(e) => onDrop(e, memo.id)}
        onDragEnd={onDragEnd}
        className={`group flex items-start gap-1.5 px-2.5 py-1.5 rounded-xl text-sm transition-all ${
          isEditing
            ? 'bg-white/70 dark:bg-dpurple-800/50 ring-1 ring-violet-300 dark:ring-violet-600 shadow-sm'
            : 'cursor-grab active:cursor-grabbing hover:bg-violet-50 dark:hover:bg-violet-900/20'
        } ${isDragging ? 'opacity-40' : ''} ${dropBorderClass}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onDoubleClick={() => {
          if (!isEditing) setEditingId(memo.id);
        }}
      >
        {/* Collapse toggle */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapse(memo.id);
            }}
            className="w-4 h-4 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 mt-0.5"
          >
            {isCollapsed ? '\u25B6' : '\u25BC'}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* Memo tag icon with code color */}
        <span className="mt-0.5">
          <MemoTagIcon color={tagColor} />
        </span>

        {/* Content area */}
        {isEditing ? (
          <MemoInlineEditor
            initialValue={memo.content}
            onSave={(text) => {
              onUpdate(memo.id, text);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div className="flex-1 min-w-0">
            <p className="whitespace-pre-wrap break-words text-gray-700 dark:text-gray-200">
              {memo.content.length > 80 ? memo.content.slice(0, 80) + '\u2026' : memo.content}
            </p>
            <div className="flex gap-1.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(memo.id);
                }}
                className="text-xs text-violet-400 hover:text-violet-600 dark:hover:text-violet-300"
              >
                {t('rightPane.edit')}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(memo.id);
                }}
                className="text-xs text-gray-400 hover:text-rose-500"
              >
                {t('rightPane.delete')}
              </button>
            </div>
          </div>
        )}

        {/* Child count badge */}
        {hasChildren && (
          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5">
            {children.length}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && !isCollapsed && (
        <ul className="space-y-0.5">
          {children.map((child) => (
            <MemoTreeNode
              key={child.id}
              memo={child}
              depth={depth + 1}
              allMemos={allMemos}
              codeMap={codeMap}
              collapsedIds={collapsedIds}
              toggleCollapse={toggleCollapse}
              getSortedChildren={getSortedChildren}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              dropTarget={dropTarget}
              dragMemoId={dragMemoId}
              editingId={editingId}
              setEditingId={setEditingId}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Inline editor for memo content (textarea with Cmd/Ctrl+Enter save) */
function MemoInlineEditor({
  initialValue,
  onSave,
  onCancel,
}: {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
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
    <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
          if (e.key === 'Escape') onCancel();
        }}
        rows={3}
        className="w-full text-sm border border-violet-200 dark:border-violet-600/40 dark:bg-dpurple-800 dark:text-gray-100 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400"
        autoFocus
      />
      <div className="flex gap-1.5 mt-1">
        <button
          onClick={handleSave}
          className="px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r from-violet-500 to-pink-500 rounded-full hover:from-violet-600 hover:to-pink-600 active:scale-95 transition-all"
        >
          {t('rightPane.save')}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-xs bg-violet-100 dark:bg-violet-800/40 text-violet-600 dark:text-violet-300 rounded-full hover:bg-violet-200 dark:hover:bg-violet-700/40 active:scale-95 transition-all"
        >
          {t('rightPane.cancel')}
        </button>
      </div>
    </div>
  );
}
