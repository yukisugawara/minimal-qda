import { useRef, useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Code, BoundingBox } from '../store/useAppStore';
import { CodeNameDialog } from './CodeNameDialog';

let codeIdCounter = 0;
function nextCodeId() {
  return `code-${++codeIdCounter}-${Date.now()}`;
}

export function ImageViewer() {
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
  const imgRef = useRef<HTMLImageElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [pendingBoundingBox, setPendingBoundingBox] = useState<BoundingBox | null>(null);

  const getRelativePos = useCallback((e: React.MouseEvent) => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start drawing on left click on the image
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG' || target.closest('.image-overlay')) {
      setStartPos(getRelativePos(e));
      setCurrentPos(getRelativePos(e));
      setDrawing(true);
    }
  }, [getRelativePos]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawing) return;
    setCurrentPos(getRelativePos(e));
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

    // Ignore very small selections
    if (width > 0.01 && height > 0.01) {
      const bb: BoundingBox = { x, y, width, height };
      if (codingMode === 'interpretive') {
        setPendingBoundingBox(bb);
      } else {
        const code: Code = {
          id: nextCodeId(),
          text: `Region (${Math.round(x * 100)}%, ${Math.round(y * 100)}%) ${Math.round(width * 100)}%×${Math.round(height * 100)}%`,
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
  }, [drawing, startPos, currentPos, activeMarkerColor, addCode, codingMode, activeFileId]);

  if (!fileDataUrl) return null;

  // Compute the drawing rectangle
  const drawRect = drawing && startPos && currentPos
    ? {
        left: `${Math.min(startPos.x, currentPos.x) * 100}%`,
        top: `${Math.min(startPos.y, currentPos.y) * 100}%`,
        width: `${Math.abs(currentPos.x - startPos.x) * 100}%`,
        height: `${Math.abs(currentPos.y - startPos.y) * 100}%`,
      }
    : null;

  const boxCodes = codes.filter((c) => c.boundingBox);

  return (
    <div
      ref={containerRef}
      className="relative inline-block select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { if (drawing) handleMouseUp(); }}
    >
      <img
        ref={imgRef}
        src={fileDataUrl}
        alt=""
        className="max-w-full"
        draggable={false}
      />

      {/* Overlay for existing bounding boxes */}
      <div className="image-overlay absolute inset-0 pointer-events-none">
        {boxCodes.map((code) => {
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
                boxShadow: isSelected ? `0 0 0 2px #1f2937` : undefined,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCodeId(code.id);
              }}
            />
          );
        })}

        {/* Currently drawing rectangle */}
        {drawRect && (
          <div
            className="absolute"
            style={{
              ...drawRect,
              backgroundColor: activeMarkerColor + '30',
              border: `2px dashed ${activeMarkerColor}`,
            }}
          />
        )}
      </div>

      {/* Code name dialog for interpretive mode */}
      {pendingBoundingBox && activeFileId && (
        <CodeNameDialog
          contextText={`Region (${Math.round(pendingBoundingBox.x * 100)}%, ${Math.round(pendingBoundingBox.y * 100)}%) ${Math.round(pendingBoundingBox.width * 100)}%\u00d7${Math.round(pendingBoundingBox.height * 100)}%`}
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
