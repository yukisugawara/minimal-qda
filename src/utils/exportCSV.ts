import type { Code, Memo, FileEntry } from '../store/useAppStore';

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

export function exportCSV(data: CSVExportData, defaultName: string) {
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
        csvCell(code.color),
        csvCell(memoText),
      ].join(','),
    );
  }

  const csv = '\uFEFF' + rows.join('\r\n'); // BOM for Excel compatibility
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${defaultName}_codes.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
