import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useAppStore } from '../store/useAppStore';
import type { Code, BoundingBox } from '../store/useAppStore';
import { CodeNameDialog } from './CodeNameDialog';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

let codeIdCounter = 0;
function nextCodeId() {
  return `code-${++codeIdCounter}-${Date.now()}`;
}

interface PageData {
  pageNum: number;
  canvas: HTMLCanvasElement;
  viewport: pdfjsLib.PageViewport;
}

export function PdfViewer() {
  const files = useAppStore((s) => s.files);
  const activeFileId = useAppStore((s) => s.activeFileId);
  const allCodes = useAppStore((s) => s.codes);
  const activeMarkerColor = useAppStore((s) => s.activeMarkerColor);
  const addCode = useAppStore((s) => s.addCode);
  const codingMode = useAppStore((s) => s.codingMode);
  const selectedCodeId = useAppStore((s) => s.selectedCodeId);
  const setSelectedCodeId = useAppStore((s) => s.setSelectedCodeId);

  const activeFile = files.find((f) => f.id === activeFileId) ?? null;
  const fileDataUrl = activeFile?.fileDataUrl ?? null;
  const codes = allCodes.filter((c) => c.fileId === activeFileId);

  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Drawing state for rectangle selection
  const [drawing, setDrawing] = useState(false);
  const [drawPage, setDrawPage] = useState<number>(0);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [pendingBoundingBox, setPendingBoundingBox] = useState<BoundingBox | null>(null);
  const [pendingPage, setPendingPage] = useState<number>(0);

  // Load and render PDF
  useEffect(() => {
    if (!fileDataUrl) return;

    let cancelled = false;

    async function loadPdf() {
      try {
        // Convert data URL to ArrayBuffer
        const base64 = fileDataUrl!.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
        const rendered: PageData[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const scale = 1.5;
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;

          await page.render({ canvasContext: ctx, viewport }).promise;
          rendered.push({ pageNum: i - 1, canvas, viewport });
        }

        if (!cancelled) {
          setPages(rendered);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load PDF: ' + (err instanceof Error ? err.message : String(err)));
        }
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [fileDataUrl]);

  const getRelativePos = useCallback((e: React.MouseEvent, pageEl: HTMLElement) => {
    const rect = pageEl.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, pageNum: number) => {
    if (e.button !== 0) return;
    const pageEl = (e.currentTarget as HTMLElement);
    setStartPos(getRelativePos(e, pageEl));
    setCurrentPos(getRelativePos(e, pageEl));
    setDrawPage(pageNum);
    setDrawing(true);
  }, [getRelativePos]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawing) return;
    const pageEl = (e.currentTarget as HTMLElement);
    setCurrentPos(getRelativePos(e, pageEl));
  }, [drawing, getRelativePos]);

  const handleMouseUp = useCallback(() => {
    if (!drawing || !startPos || !currentPos || !activeFileId) {
      setDrawing(false);
      return;
    }

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);

    if (width > 0.01 && height > 0.01) {
      const bb: BoundingBox = { x, y, width, height, page: drawPage };
      if (codingMode === 'interpretive') {
        setPendingBoundingBox(bb);
        setPendingPage(drawPage);
      } else {
        const code: Code = {
          id: nextCodeId(),
          text: `PDF p.${drawPage + 1} (${Math.round(x * 100)}%, ${Math.round(y * 100)}%) ${Math.round(width * 100)}%\u00d7${Math.round(height * 100)}%`,
          color: activeMarkerColor,
          parentId: null,
          order: 0,
          fileId: activeFileId,
          startOffset: 0,
          endOffset: 0,
          boundingBox: bb,
        };
        addCode(code);
      }
    }

    setDrawing(false);
    setStartPos(null);
    setCurrentPos(null);
  }, [drawing, startPos, currentPos, drawPage, activeMarkerColor, addCode, codingMode, activeFileId]);

  if (error) {
    return <div className="p-4 text-red-500 text-sm">{error}</div>;
  }

  if (pages.length === 0) {
    return <div className="p-4 text-gray-400 text-sm">Loading PDF...</div>;
  }

  // Compute the drawing rectangle for the active page
  const drawRect = drawing && startPos && currentPos
    ? {
        left: `${Math.min(startPos.x, currentPos.x) * 100}%`,
        top: `${Math.min(startPos.y, currentPos.y) * 100}%`,
        width: `${Math.abs(currentPos.x - startPos.x) * 100}%`,
        height: `${Math.abs(currentPos.y - startPos.y) * 100}%`,
      }
    : null;

  return (
    <div ref={containerRef} className="space-y-4">
      {pages.map((page) => (
        <PdfPage
          key={page.pageNum}
          page={page}
          codes={codes.filter((c) => c.boundingBox?.page === page.pageNum)}
          selectedCodeId={selectedCodeId}
          onSelectCode={setSelectedCodeId}
          onMouseDown={(e) => handleMouseDown(e, page.pageNum)}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          drawRect={drawing && drawPage === page.pageNum ? drawRect : null}
          drawColor={activeMarkerColor}
        />
      ))}

      {/* Code name dialog for interpretive mode */}
      {pendingBoundingBox && activeFileId && (
        <CodeNameDialog
          contextText={`PDF p.${pendingPage + 1} (${Math.round(pendingBoundingBox.x * 100)}%, ${Math.round(pendingBoundingBox.y * 100)}%) ${Math.round(pendingBoundingBox.width * 100)}%\u00d7${Math.round(pendingBoundingBox.height * 100)}%`}
          onSubmit={(name) => {
            addCode({
              id: nextCodeId(),
              text: name,
              color: activeMarkerColor,
              parentId: null,
          order: 0,
              fileId: activeFileId,
              startOffset: 0,
              endOffset: 0,
              boundingBox: pendingBoundingBox,
            });
            setPendingBoundingBox(null);
          }}
          onCancel={() => setPendingBoundingBox(null)}
        />
      )}
    </div>
  );
}

function PdfPage({
  page,
  codes,
  selectedCodeId,
  onSelectCode,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  drawRect,
  drawColor,
}: {
  page: PageData;
  codes: Code[];
  selectedCodeId: string | null;
  onSelectCode: (id: string) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  drawRect: Record<string, string> | null;
  drawColor: string;
}) {
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    container.innerHTML = '';
    // Set canvas to fill width
    page.canvas.style.width = '100%';
    page.canvas.style.height = 'auto';
    container.appendChild(page.canvas);
  }, [page]);

  return (
    <div
      className="relative select-none border border-violet-200/50 dark:border-violet-700/30 rounded-xl overflow-hidden"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div ref={canvasContainerRef} className="w-full" />

      {/* Bounding box overlays */}
      <div className="absolute inset-0 pointer-events-none">
        {codes.map((code) => {
          const bb = code.boundingBox!;
          const isSelected = code.id === selectedCodeId;
          return (
            <div
              key={code.id}
              className="absolute pointer-events-auto cursor-pointer"
              style={{
                left: `${bb.x * 100}%`,
                top: `${bb.y * 100}%`,
                width: `${bb.width * 100}%`,
                height: `${bb.height * 100}%`,
                backgroundColor: code.color + '30',
                border: `2px solid ${code.color}`,
                boxShadow: isSelected ? '0 0 0 2px #1f2937' : undefined,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectCode(code.id);
              }}
            />
          );
        })}

        {/* Currently drawing */}
        {drawRect && (
          <div
            className="absolute"
            style={{
              ...drawRect,
              backgroundColor: drawColor + '30',
              border: `2px dashed ${drawColor}`,
            }}
          />
        )}
      </div>

      {/* Page label */}
      <div className="absolute top-2 right-3 text-xs text-violet-400 bg-white/70 dark:bg-dpurple-900/70 backdrop-blur-sm px-2 py-0.5 rounded-full font-semibold">
        p.{page.pageNum + 1}
      </div>
    </div>
  );
}
