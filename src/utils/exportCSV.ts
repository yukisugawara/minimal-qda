import type { Code, Memo, FileEntry } from '../store/useAppStore';

const COLOR_NAMES: Record<string, string> = {
  '#E57373': 'Red',
  '#F06292': 'Pink',
  '#BA68C8': 'Purple',
  '#9575CD': 'Deep Purple',
  '#7986CB': 'Indigo',
  '#64B5F6': 'Blue',
  '#4FC3F7': 'Light Blue',
  '#4DD0E1': 'Cyan',
  '#4DB6AC': 'Teal',
  '#81C784': 'Green',
  '#DCE775': 'Lime',
  '#FFF176': 'Yellow',
  '#FFD54F': 'Amber',
  '#FFB74D': 'Orange',
  '#FF8A65': 'Deep Orange',
  '#A1887F': 'Brown',
  '#E0E0E0': 'Grey',
  '#90A4AE': 'Blue Grey',
  '#9CA3AF': 'Grey',  // group default color
};

function colorName(hex: string): string {
  return COLOR_NAMES[hex.toUpperCase()] ?? COLOR_NAMES[hex] ?? hex;
}

interface CSVExportData {
  files: FileEntry[];
  codes: Code[];
  memos: Memo[];
}

/** Escape a value for CSV (RFC 4180) */
function csvCell(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** A code is a "group node" if it has no text selection and no bounding box */
function isGroupNode(code: Code): boolean {
  return code.startOffset === 0 && code.endOffset === 0 && !code.boundingBox;
}

export async function exportCSV(data: CSVExportData, defaultName: string) {
  const { files, codes, memos } = data;
  const fileMap = new Map(files.map((f) => [f.id, f]));

  // Only include leaf codes that have actual markers (not group nodes)
  const leafCodes = codes.filter((c) => !isGroupNode(c));

  const header = ['Marked Text', 'Code', 'Color', 'Memo'];
  const rows: string[] = [header.map(csvCell).join(',')];

  for (const code of leafCodes) {
    const file = fileMap.get(code.fileId);

    // Extract marked text
    let markedText = '';
    if (code.boundingBox) {
      markedText = `[Image region] ${file?.fileName ?? ''}`;
    } else if (file?.fileContent) {
      markedText = file.fileContent.slice(code.startOffset, code.endOffset);
    }

    // Collect memos for this code
    const codeMemos = memos
      .filter((m) => m.codeId === code.id)
      .map((m) => m.content);
    const memoText = codeMemos.join(' | ');

    rows.push(
      [
        csvCell(markedText),
        csvCell(code.text),
        csvCell(colorName(code.color)),
        csvCell(memoText),
      ].join(','),
    );
  }

  const csv = '\uFEFF' + rows.join('\r\n'); // BOM for Excel compatibility
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const fileName = `${defaultName}_codes.csv`;

  // Use File System Access API if available (Chrome / Edge) for folder selection
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: 'CSV File',
            accept: { 'text/csv': ['.csv'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Fall through to legacy download
    }
  }

  // Fallback: download to browser default location
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
