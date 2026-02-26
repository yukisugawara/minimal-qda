import { useCallback, useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore, MARKER_COLORS } from '../store/useAppStore';
import type { Code } from '../store/useAppStore';
import { ImageViewer } from './ImageViewer';
import { PdfViewer } from './PdfViewer';
import { CodeNameDialog } from './CodeNameDialog';
import { FloatingCodingMenu } from './FloatingCodingMenu';

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg']);

let codeIdCounter = 0;
function nextCodeId() {
  return `code-${++codeIdCounter}-${Date.now()}`;
}

/** Build segments from text-based codes for rendering highlighted text */
function buildSegments(text: string, codes: Code[]) {
  // Only use codes that have text offsets (not bounding-box codes)
  const textCodes = codes.filter((c) => !c.boundingBox && c.endOffset > c.startOffset);

  type Event = { offset: number; type: 'start' | 'end'; code: Code };
  const events: Event[] = [];
  for (const code of textCodes) {
    events.push({ offset: code.startOffset, type: 'start', code });
    events.push({ offset: code.endOffset, type: 'end', code });
  }
  events.sort((a, b) => a.offset - b.offset || (a.type === 'end' ? -1 : 1));

  const segments: { text: string; codes: Code[] }[] = [];
  const activeCodes = new Set<Code>();
  let pos = 0;

  for (const ev of events) {
    if (ev.offset > pos) {
      segments.push({ text: text.slice(pos, ev.offset), codes: [...activeCodes] });
    }
    if (ev.type === 'start') {
      activeCodes.add(ev.code);
    } else {
      activeCodes.delete(ev.code);
    }
    pos = ev.offset;
  }

  if (pos < text.length) {
    segments.push({ text: text.slice(pos), codes: [...activeCodes] });
  }

  return segments;
}

/* ------------------------------------------------------------------ */
/*  Code Gutter (annotation stripe)                                   */
/* ------------------------------------------------------------------ */

interface CodeBar {
  codeId: string;
  text: string;
  color: string;
  top: number;
  height: number;
  column: number;
}

const BAR_WIDTH = 54;
const BAR_GAP = 3;
const GUTTER_PAD = 4;

export function CenterPane() {
  const { t } = useTranslation();
  const files = useAppStore((s) => s.files);
  const activeFileId = useAppStore((s) => s.activeFileId);
  const allCodes = useAppStore((s) => s.codes);
  const activeMarkerColor = useAppStore((s) => s.activeMarkerColor);
  const setActiveMarkerColor = useAppStore((s) => s.setActiveMarkerColor);
  const addCode = useAppStore((s) => s.addCode);
  const codingMode = useAppStore((s) => s.codingMode);
  const setCodingMode = useAppStore((s) => s.setCodingMode);
  const selectedCodeId = useAppStore((s) => s.selectedCodeId);
  const setSelectedCodeId = useAppStore((s) => s.setSelectedCodeId);
  const updateCodeColor = useAppStore((s) => s.updateCodeColor);
  const contentRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [pendingSelection, setPendingSelection] = useState<{
    selectedText: string;
    lo: number;
    hi: number;
  } | null>(null);

  const activeFile = files.find((f) => f.id === activeFileId) ?? null;
  const fileContent = activeFile?.fileContent ?? null;
  const fileName = activeFile?.fileName ?? null;
  const fileType = activeFile?.fileType ?? null;

  const codes = allCodes.filter((c) => c.fileId === activeFileId);

  const isImage = fileType && IMAGE_EXTS.has(fileType);
  const isPdf = fileType === 'pdf';
  const isText = fileType && !isImage && !isPdf;

  // Switch to interpretive mode for image/pdf files (in-vivo not available)
  useEffect(() => {
    if ((isImage || isPdf) && codingMode === 'in-vivo') {
      setCodingMode('interpretive');
    }
  }, [isImage, isPdf, codingMode, setCodingMode]);

  // Codes that appear in the gutter
  const textCodes = codes.filter((c) => !c.boundingBox && c.endOffset > c.startOffset);
  const imageCodes = codes.filter((c) => !!c.boundingBox);
  const showGutter =
    (!!isText && textCodes.length > 0) ||
    (!!isImage && imageCodes.length > 0);

  // Gutter bar positions
  const [codeBars, setCodeBars] = useState<CodeBar[]>([]);

  // Measure code positions after render
  useEffect(() => {
    if (!showGutter) {
      setCodeBars([]);
      return;
    }

    const gutter = gutterRef.current;
    if (!gutter) return;

    const measure = () => {
      const gutterRect = gutter.getBoundingClientRect();
      const bars: CodeBar[] = [];

      if (isText && contentRef.current) {
        // --- Text mode: measure <mark> positions ---
        const marks = contentRef.current.querySelectorAll<HTMLElement>('[data-code-ids]');
        const ranges = new Map<string, { top: number; bottom: number }>();

        marks.forEach((mark) => {
          const ids = mark.dataset.codeIds?.split(',') ?? [];
          const rects = mark.getClientRects();
          for (const rect of Array.from(rects)) {
            const relTop = rect.top - gutterRect.top;
            const relBottom = relTop + rect.height;
            for (const id of ids) {
              const existing = ranges.get(id);
              if (existing) {
                existing.top = Math.min(existing.top, relTop);
                existing.bottom = Math.max(existing.bottom, relBottom);
              } else {
                ranges.set(id, { top: relTop, bottom: relBottom });
              }
            }
          }
        });

        for (const code of textCodes) {
          const range = ranges.get(code.id);
          if (range) {
            bars.push({
              codeId: code.id,
              text: code.text,
              color: code.color,
              top: range.top,
              height: Math.max(range.bottom - range.top, 4),
              column: 0,
            });
          }
        }
      } else if (isImage) {
        // --- Image mode: map bounding-box ratios to pixel positions ---
        const scrollContainer = gutter.closest('.overflow-y-auto');
        const img = scrollContainer?.querySelector('img');
        if (img) {
          const imgRect = img.getBoundingClientRect();
          const imgTop = imgRect.top - gutterRect.top;
          const imgHeight = imgRect.height;

          for (const code of imageCodes) {
            const bb = code.boundingBox!;
            bars.push({
              codeId: code.id,
              text: code.text,
              color: code.color,
              top: imgTop + bb.y * imgHeight,
              height: Math.max(bb.height * imgHeight, 4),
              column: 0,
            });
          }
        }
      }

      // Assign columns for overlapping bars (greedy)
      bars.sort((a, b) => a.top - b.top);
      for (let i = 0; i < bars.length; i++) {
        const used = new Set<number>();
        for (let j = 0; j < i; j++) {
          if (bars[j].top + bars[j].height > bars[i].top) {
            used.add(bars[j].column);
          }
        }
        let col = 0;
        while (used.has(col)) col++;
        bars[i].column = col;
      }

      setCodeBars(bars);
    };

    const raf = requestAnimationFrame(measure);

    // Re-measure on resize
    const target = contentRef.current ?? gutter.parentElement;
    let observer: ResizeObserver | null = null;
    if (target) {
      observer = new ResizeObserver(measure);
      observer.observe(target);
    }

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes, activeFileId, isText, isImage, showGutter]);

  const maxColumn = codeBars.length > 0 ? Math.max(...codeBars.map((b) => b.column)) : 0;
  const gutterWidth = showGutter
    ? (maxColumn + 1) * (BAR_WIDTH + BAR_GAP) + GUTTER_PAD * 2
    : 0;

  const handleMouseUp = useCallback(() => {
    if (!fileContent || !contentRef.current || !isText || !activeFileId) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    if (!contentRef.current.contains(range.startContainer) || !contentRef.current.contains(range.endContainer)) {
      return;
    }

    const startOffset = getTextOffset(contentRef.current, range.startContainer, range.startOffset);
    const endOffset = getTextOffset(contentRef.current, range.endContainer, range.endOffset);

    if (startOffset === endOffset) return;

    const lo = Math.min(startOffset, endOffset);
    const hi = Math.max(startOffset, endOffset);
    const selectedText = fileContent.slice(lo, hi);

    if (!selectedText.trim()) return;

    if (codingMode === 'interpretive') {
      setPendingSelection({ selectedText, lo, hi });
    } else {
      const newCode: Code = {
        id: nextCodeId(),
        text: selectedText,
        color: activeMarkerColor,
        parentId: null,
        order: 0,
        fileId: activeFileId,
        startOffset: lo,
        endOffset: hi,
      };
      addCode(newCode);
    }
    selection.removeAllRanges();
  }, [fileContent, activeMarkerColor, addCode, isText, codingMode, activeFileId]);

  const segments = isText && fileContent ? buildSegments(fileContent, codes) : [];

  // Render the gutter column
  const gutterEl = showGutter && (
    <div
      ref={gutterRef}
      className="relative flex-shrink-0 border-r border-violet-200/30 dark:border-violet-700/20"
      style={{ width: Math.max(gutterWidth, 24) }}
    >
      {codeBars.map((bar) => {
        const isSelected = selectedCodeId === bar.codeId;
        const label = bar.text.length > 7 ? bar.text.slice(0, 7) + '…' : bar.text;
        return (
          <div
            key={bar.codeId}
            className="absolute group/bar"
            style={{
              left: GUTTER_PAD + bar.column * (BAR_WIDTH + BAR_GAP),
              top: bar.top,
              width: BAR_WIDTH,
              height: bar.height,
            }}
          >
            {/* Thin vertical stripe */}
            <div
              onClick={() => setSelectedCodeId(bar.codeId)}
              className={`absolute left-0 w-[3px] h-full rounded-full cursor-pointer transition-opacity ${
                isSelected ? 'opacity-100' : 'opacity-60 hover:opacity-100'
              }`}
              style={{ backgroundColor: bar.color }}
            />
            {/* Code name label */}
            <div
              onClick={() => setSelectedCodeId(bar.codeId)}
              className={`absolute left-1 top-0 cursor-pointer select-none truncate rounded px-1 py-px text-[9px] leading-tight font-semibold text-white/90 transition-opacity ${
                isSelected ? 'opacity-100 ring-1 ring-gray-700 dark:ring-gray-300' : 'opacity-75 hover:opacity-100'
              }`}
              style={{
                backgroundColor: bar.color,
                maxWidth: BAR_WIDTH - 6,
              }}
              title={bar.text}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-cream-50 dark:bg-dpurple-950">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-violet-200/50 dark:border-violet-700/30 glass">
        {/* Floating coding menu */}
        <FloatingCodingMenu
          onInVivo={() => setCodingMode('in-vivo')}
          onNewCode={() => setCodingMode('interpretive')}
          hideInVivo={!!isImage || !!isPdf}
          codingMode={codingMode}
        />

        <div className="grid grid-cols-9 gap-1.5">
          {MARKER_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => {
                setActiveMarkerColor(color);
                if (selectedCodeId) {
                  updateCodeColor(selectedCodeId, color);
                }
              }}
              className={`w-6 h-6 rounded-full border-2 transition-all active:scale-95 ${
                activeMarkerColor === color
                  ? 'border-violet-500 dark:border-violet-300 scale-110 ring-2 ring-violet-300/50 shadow-md'
                  : 'border-white/60 dark:border-violet-700/40 hover:scale-105 hover:shadow-sm'
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {!activeFile ? (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm p-4">
            {t('centerPane.placeholder')}
          </div>
        ) : (
          <div className="flex min-h-full">
            {/* Code gutter */}
            {gutterEl}

            {/* Main content */}
            <div className="flex-1 p-4 min-w-0">
              {isImage ? (
                <div>
                  {fileName && <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">{fileName}</div>}
                  <ImageViewer />
                </div>
              ) : isPdf ? (
                <div>
                  {fileName && <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">{fileName}</div>}
                  <PdfViewer />
                </div>
              ) : (
                <div>
                  {fileName && <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">{fileName}</div>}
                  <div
                    ref={contentRef}
                    onMouseUp={handleMouseUp}
                    className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200"
                  >
                    {segments.map((seg, i) => {
                      if (seg.codes.length === 0) {
                        return <span key={i}>{seg.text}</span>;
                      }
                      const topCode = seg.codes[seg.codes.length - 1];
                      const isSelected = seg.codes.some((c) => c.id === selectedCodeId);
                      return (
                        <mark
                          key={i}
                          data-code-ids={seg.codes.map((c) => c.id).join(',')}
                          onClick={() => setSelectedCodeId(topCode.id)}
                          className={`cursor-pointer rounded-sm ${isSelected ? 'ring-2 ring-gray-800' : ''}`}
                          style={{ backgroundColor: topCode.color + '80' }}
                        >
                          {seg.text}
                        </mark>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Code name dialog for interpretive mode */}
      {pendingSelection && activeFileId && (
        <CodeNameDialog
          contextText={pendingSelection.selectedText}
          onSubmit={(name) => {
            addCode({
              id: nextCodeId(),
              text: name,
              color: activeMarkerColor,
              parentId: null,
              order: 0,
              fileId: activeFileId,
              startOffset: pendingSelection.lo,
              endOffset: pendingSelection.hi,
            });
            setPendingSelection(null);
          }}
          onCancel={() => setPendingSelection(null)}
        />
      )}
    </div>
  );
}

/** Calculate the text offset of a position within the content element */
function getTextOffset(root: Node, node: Node, offset: number): number {
  let totalOffset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    if (walker.currentNode === node) {
      return totalOffset + offset;
    }
    totalOffset += walker.currentNode.textContent?.length ?? 0;
  }

  return totalOffset + offset;
}
