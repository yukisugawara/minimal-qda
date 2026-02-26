import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { Code, Memo, FileEntry } from '../store/useAppStore';

interface ExportViewerData {
  file: FileEntry;
  codes: Code[];
  memos: Memo[];
}

/* ------------------------------------------------------------------ */
/*  Segment builder (same logic as CenterPane)                         */
/* ------------------------------------------------------------------ */

function buildSegments(text: string, codes: Code[]) {
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

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ */
/*  Gutter constants (matching CenterPane)                             */
/* ------------------------------------------------------------------ */

const BAR_WIDTH = 54;
const BAR_GAP = 3;
const GUTTER_PAD = 4;

/* ------------------------------------------------------------------ */
/*  Build text-only DOM, capture with html2canvas, then draw gutter    */
/*  bars directly on the canvas with Canvas API.                       */
/* ------------------------------------------------------------------ */

interface BarInfo {
  text: string;
  color: string;
  top: number;
  height: number;
  column: number;
}

async function buildExportCanvas(
  data: ExportViewerData,
  pixelRatio: number,
): Promise<HTMLCanvasElement> {
  const { file, codes, memos } = data;

  const textCodes = codes.filter((c) => !c.boundingBox && c.endOffset > c.startOffset);
  const content = file.fileContent ?? '';

  // Measure the widest code label to determine bar column width dynamically
  let barWidth = BAR_WIDTH; // default minimum
  if (textCodes.length > 0) {
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d')!;
    measureCtx.font = `600 9px 'Nunito', system-ui, sans-serif`;
    const labelPadX = 4;
    const stripeAndGap = 8; // 3px stripe + 5px gap
    for (const code of textCodes) {
      const w = measureCtx.measureText(code.text).width + labelPadX * 2 + stripeAndGap;
      if (w > barWidth) barWidth = w;
    }
    barWidth = Math.ceil(barWidth);
  }

  // Pre-calculate gutter width from code overlap
  let preMaxCol = 0;
  if (textCodes.length > 0) {
    const sorted = [...textCodes].sort((a, b) => a.startOffset - b.startOffset);
    const preCols: number[] = new Array(sorted.length).fill(0);
    for (let i = 0; i < sorted.length; i++) {
      const usedCols = new Set<number>();
      for (let j = 0; j < i; j++) {
        if (sorted[j].endOffset > sorted[i].startOffset) usedCols.add(preCols[j]);
      }
      let col = 0;
      while (usedCols.has(col)) col++;
      preCols[i] = col;
      if (col > preMaxCol) preMaxCol = col;
    }
  }
  // Cap total gutter width at 40% of page, shrink barWidth if needed
  const maxGutterW = 800 * 0.4;
  let gutterW = textCodes.length > 0
    ? (preMaxCol + 1) * (barWidth + BAR_GAP) + GUTTER_PAD * 2
    : 0;
  if (gutterW > maxGutterW && textCodes.length > 0) {
    barWidth = Math.floor((maxGutterW - GUTTER_PAD * 2) / (preMaxCol + 1) - BAR_GAP);
    gutterW = (preMaxCol + 1) * (barWidth + BAR_GAP) + GUTTER_PAD * 2;
  }

  // --- Build text-only container (NO gutter bars in DOM) ---
  const textContainerWidth = 800 - gutterW;

  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed; left: 0; top: 0; z-index: 99999;
    width: ${textContainerWidth}px; padding: 32px;
    font-family: 'Nunito', system-ui, -apple-system, sans-serif;
    background: #ffffff; color: #1f2937;
    line-height: 1.7; font-size: 14px;
    pointer-events: none;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb;';
  header.innerHTML = `
    <div style="font-size: 18px; font-weight: 700; color: #111827;">${escapeHTML(file.fileName)}</div>
    <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">Exported: ${new Date().toLocaleString()}</div>
  `;
  container.appendChild(header);

  // Memos map
  const memosByCode = new Map<string, Memo[]>();
  for (const memo of memos) {
    if (!memo.codeId) continue;
    const list = memosByCode.get(memo.codeId) ?? [];
    list.push(memo);
    memosByCode.set(memo.codeId, list);
  }

  // Text content with highlights
  const textCol = document.createElement('div');
  textCol.style.cssText = 'white-space: pre-wrap; word-break: break-word;';

  if (content) {
    const segments = buildSegments(content, textCodes);
    const renderedMemos = new Set<string>();

    for (const seg of segments) {
      if (seg.codes.length === 0) {
        const span = document.createElement('span');
        span.textContent = seg.text;
        textCol.appendChild(span);
      } else {
        const topCode = seg.codes[seg.codes.length - 1];
        const mark = document.createElement('mark');
        mark.style.cssText = `background-color: ${topCode.color}50; border-radius: 2px; padding: 0 1px;`;
        mark.textContent = seg.text;
        mark.dataset.codeIds = seg.codes.map((c) => c.id).join(',');
        textCol.appendChild(mark);

        for (const code of seg.codes) {
          if (!renderedMemos.has(code.id)) {
            const isLast = seg === segments.filter((s) => s.codes.includes(code)).pop();
            if (isLast) {
              renderedMemos.add(code.id);
              const codeMemos = memosByCode.get(code.id);
              if (codeMemos && codeMemos.length > 0) {
                const memoEl = document.createElement('span');
                memoEl.style.cssText =
                  'display: inline-block; font-size: 11px; color: #6b7280; margin-left: 4px; font-style: italic;';
                memoEl.textContent = codeMemos.map((m) => m.content).join(' | ');
                textCol.appendChild(memoEl);
              }
            }
          }
        }
      }
    }
  }

  container.appendChild(textCol);

  // --- Insert into DOM & wait for layout ---
  document.body.appendChild(container);
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => requestAnimationFrame(r));

  // --- Measure mark positions relative to textCol ---
  const bars: BarInfo[] = [];
  if (textCodes.length > 0) {
    const textColRect = textCol.getBoundingClientRect();
    const marks = textCol.querySelectorAll<HTMLElement>('[data-code-ids]');
    const ranges = new Map<string, { top: number; bottom: number }>();

    marks.forEach((mark) => {
      const ids = mark.dataset.codeIds?.split(',') ?? [];
      for (const rect of Array.from(mark.getClientRects())) {
        const relTop = rect.top - textColRect.top;
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
          text: code.text,
          color: code.color,
          top: range.top,
          height: Math.max(range.bottom - range.top, 4),
          column: 0,
        });
      }
    }

    bars.sort((a, b) => a.top - b.top);
    for (let i = 0; i < bars.length; i++) {
      const used = new Set<number>();
      for (let j = 0; j < i; j++) {
        if (bars[j].top + bars[j].height > bars[i].top) used.add(bars[j].column);
      }
      let col = 0;
      while (used.has(col)) col++;
      bars[i].column = col;
    }
  }

  // --- Measure the offset from container top to textCol top ---
  const containerRect = container.getBoundingClientRect();
  const textColRect = textCol.getBoundingClientRect();
  const textOffsetY = textColRect.top - containerRect.top;

  // --- Capture text content with html2canvas ---
  let textCanvas: HTMLCanvasElement;
  try {
    textCanvas = await html2canvas(container, {
      scale: pixelRatio,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
  } finally {
    container.remove();
  }

  // --- If no codes, return text canvas as-is ---
  if (gutterW === 0) return textCanvas;

  // --- Compose final canvas: text first, then gutter bars on top ---
  const pr = pixelRatio;
  const gx = gutterW * pr;
  const totalW = gx + textCanvas.width;
  const totalH = textCanvas.height;

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = totalW;
  finalCanvas.height = totalH;
  const ctx = finalCanvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, totalW, totalH);

  // Draw text canvas first (right side)
  ctx.drawImage(textCanvas, gx, 0);

  // Draw gutter separator line
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1 * pr;
  ctx.beginPath();
  ctx.moveTo(gx, 0);
  ctx.lineTo(gx, totalH);
  ctx.stroke();

  // --- Pre-calculate label sizes for collision detection ---
  const fontSize = 9 * pr;
  ctx.font = `600 ${fontSize}px 'Nunito', system-ui, sans-serif`;
  const labelPadX = 4 * pr;
  const labelPadY = 2 * pr;
  const labelH = fontSize + labelPadY * 2;

  // Calculate label Y positions with collision avoidance
  // Track occupied Y ranges per column so overlapping labels get pushed down
  const occupiedByCol = new Map<number, number[]>(); // column -> sorted list of label bottom Y positions
  const labelPositions: { labelY: number }[] = [];

  for (const bar of bars) {
    const by = (textOffsetY + bar.top) * pr;
    let labelY = by;

    // Check collision with previous labels in the same column
    const colOccupied = occupiedByCol.get(bar.column) ?? [];
    for (const prevBottom of colOccupied) {
      if (labelY < prevBottom) {
        labelY = prevBottom + 1 * pr; // 1px gap between stacked labels
      }
    }

    colOccupied.push(labelY + labelH);
    occupiedByCol.set(bar.column, colOccupied);
    labelPositions.push({ labelY });
  }

  // --- Draw gutter bars ---
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const bx = (GUTTER_PAD + bar.column * (barWidth + BAR_GAP)) * pr;
    const by = (textOffsetY + bar.top) * pr;
    const bh = bar.height * pr;
    const { labelY } = labelPositions[i];

    // Vertical stripe (3px wide, full bar height)
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = bar.color;
    ctx.beginPath();
    ctx.roundRect(bx, by, 3 * pr, bh, 2 * pr);
    ctx.fill();

    // Label background
    ctx.globalAlpha = 0.85;
    const labelText = bar.text;
    ctx.font = `600 ${fontSize}px 'Nunito', system-ui, sans-serif`;
    const textMetrics = ctx.measureText(labelText);
    const labelW = textMetrics.width + labelPadX * 2;
    const labelX = bx + 5 * pr;

    ctx.fillStyle = bar.color;
    ctx.beginPath();
    ctx.roundRect(labelX, labelY, labelW, labelH, 3 * pr);
    ctx.fill();

    // Label text
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.fillText(labelText, labelX + labelPadX, labelY + labelPadY);
  }

  ctx.globalAlpha = 1;
  return finalCanvas;
}

/* ------------------------------------------------------------------ */
/*  PNG export                                                         */
/* ------------------------------------------------------------------ */

export async function exportPNG(data: ExportViewerData) {
  const canvas = await buildExportCanvas(data, 2);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
      'image/png',
    );
  });

  const defaultName = data.file.fileName.replace(/\.[^.]+$/, '');
  const fileName = `${defaultName}_viewer.png`;

  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ------------------------------------------------------------------ */
/*  PDF export                                                         */
/* ------------------------------------------------------------------ */

/** Convert a canvas to a JPEG base64 data URL via toBlob */
async function canvasToJpegDataUrl(canvas: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/jpeg',
      0.92,
    );
  });
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  }
  return 'data:image/jpeg;base64,' + btoa(chunks.join(''));
}

/**
 * Find a good page break Y position near `targetY` by scanning for a
 * row of pixels that is entirely (or nearly) white — i.e. between lines.
 * Searches within ±searchRange pixels of targetY.
 */
function findBreakY(
  ctx: CanvasRenderingContext2D,
  imgW: number,
  imgH: number,
  targetY: number,
  searchRange: number,
): number {
  const lo = Math.max(0, Math.floor(targetY - searchRange));
  const hi = Math.min(imgH - 1, Math.ceil(targetY + searchRange));
  if (lo >= hi) return Math.min(targetY, imgH);

  // Sample a horizontal strip in the text area (skip gutter on the left)
  const sampleX = Math.floor(imgW * 0.15); // start after gutter
  const sampleW = Math.floor(imgW * 0.8);  // most of the text area

  let bestY = Math.round(targetY);
  let bestScore = -1; // higher = more white = better break point

  for (let y = lo; y <= hi; y++) {
    const row = ctx.getImageData(sampleX, y, sampleW, 1).data;
    let whitePixels = 0;
    for (let i = 0; i < row.length; i += 4) {
      // Check if pixel is close to white (r,g,b all > 240)
      if (row[i] > 240 && row[i + 1] > 240 && row[i + 2] > 240) {
        whitePixels++;
      }
    }
    const score = whitePixels / (sampleW);
    if (score > bestScore) {
      bestScore = score;
      bestY = y;
    }
    // Perfect white row — use immediately
    if (score > 0.99) break;
  }

  return bestY;
}

export async function exportPDF(data: ExportViewerData) {
  try {
    const srcCanvas = await buildExportCanvas(data, 2);

    const imgW = srcCanvas.width;
    const imgH = srcCanvas.height;

    const pageW = 210;
    const pageH = 297;
    const margin = 10;
    const contentW = pageW - margin * 2;
    const contentH = pageH - margin * 2;

    const scale = contentW / imgW;
    const scaledH = imgH * scale;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    if (scaledH <= contentH) {
      const dataUrl = await canvasToJpegDataUrl(srcCanvas);
      pdf.addImage(dataUrl, 'JPEG', margin, margin, contentW, scaledH);
    } else {
      // Read source canvas pixels for break-point scanning
      const srcCtx = srcCanvas.getContext('2d')!;

      // Calculate page breaks, snapping to white rows between text lines
      const idealSliceH = contentH / scale;
      // Search range: ~3 text lines (line-height 1.7 * 14px * pixelRatio 2 ≈ 48px)
      const searchRange = Math.round(48 * 3);

      const breakYs: number[] = [0]; // start of each page slice
      let currentY = 0;
      while (currentY + idealSliceH < imgH) {
        const targetY = currentY + idealSliceH;
        const breakY = findBreakY(srcCtx, imgW, imgH, targetY, searchRange);
        breakYs.push(breakY);
        currentY = breakY;
      }

      const sliceCanvas = document.createElement('canvas');
      const ctx = sliceCanvas.getContext('2d')!;

      for (let i = 0; i < breakYs.length; i++) {
        if (i > 0) pdf.addPage();
        const srcY = breakYs[i];
        const srcEnd = i + 1 < breakYs.length ? breakYs[i + 1] : imgH;
        const srcH = srcEnd - srcY;
        const destH = srcH * scale;

        sliceCanvas.width = imgW;
        sliceCanvas.height = srcH;
        ctx.clearRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(srcCanvas, 0, srcY, imgW, srcH, 0, 0, imgW, srcH);

        const sliceData = await canvasToJpegDataUrl(sliceCanvas);
        pdf.addImage(sliceData, 'JPEG', margin, margin, contentW, destH);
      }
    }

    const defaultName = data.file.fileName.replace(/\.[^.]+$/, '');
    const fileName = `${defaultName}_viewer.pdf`;

    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }],
        });
        const pdfBlob = pdf.output('blob');
        const writable = await handle.createWritable();
        await writable.write(pdfBlob);
        await writable.close();
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }

    pdf.save(fileName);
  } catch (err) {
    console.error('PDF export failed:', err);
    alert(`PDF export failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
