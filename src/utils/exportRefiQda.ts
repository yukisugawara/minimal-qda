import JSZip from 'jszip';
import type { Code, FileEntry, Memo } from '../store/useAppStore';

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateGuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 fallback
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

function isGroupNode(code: Code): boolean {
  return code.startOffset === 0 && code.endOffset === 0 && !code.boundingBox;
}

function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  const match = /^data:[^;,]+(?:;[^,]+)?,(.*)$/.exec(dataUrl);
  if (!match) return null;
  const base64 = match[1];
  try {
    const binary = atob(base64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function downloadBlob(blob: Blob, fileName: string, typeDescription: string, mime: string, ext: string) {
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: typeDescription, accept: { [mime]: [`.${ext}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Codebook: dedupe Codes across files                                */
/* ------------------------------------------------------------------ */

interface CodebookEntry {
  guid: string;
  name: string;
  color: string;
  parentGuid: string | null;
}

interface Codebook {
  entries: CodebookEntry[];
  /** Maps a minimal-qda Code id to the REFI-QDA code guid to reference. */
  segmentToCodeGuid: Map<string, string>;
}

function buildCodebook(codes: Code[]): Codebook {
  const byId = new Map(codes.map((c) => [c.id, c]));

  function pathKeyForGroup(code: Code): string {
    const segments: string[] = [];
    let cur: Code | undefined = code;
    while (cur) {
      segments.unshift(cur.text);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return segments.join('\u0000/'); // NUL separator to avoid clash with real "/"
  }

  function findGroupAncestor(code: Code): Code | null {
    let p = code.parentId ? byId.get(code.parentId) : undefined;
    while (p) {
      if (isGroupNode(p)) return p;
      p = p.parentId ? byId.get(p.parentId) : undefined;
    }
    return null;
  }

  const pathToGuid = new Map<string, string>();
  const entries: CodebookEntry[] = [];
  const segmentToCodeGuid = new Map<string, string>();

  // Two-pass so segment→parent lookups always resolve to the deduped guid.
  for (const code of codes) {
    if (!isGroupNode(code)) continue;
    const key = pathKeyForGroup(code);
    if (pathToGuid.has(key)) continue;
    const guid = generateGuid();
    pathToGuid.set(key, guid);
    const parentGuid = code.parentId
      ? pathToGuid.get(
          pathKeyForGroup(byId.get(code.parentId) ?? code),
        ) ?? null
      : null;
    entries.push({ guid, name: code.text, color: code.color, parentGuid });
  }

  const implicitRootKey = (text: string) => `\u0001ROOT\u0001${text}`;

  for (const code of codes) {
    if (isGroupNode(code)) {
      // Groups may themselves be "coding targets" in some flows — map them
      // to their own guid so they can still appear in CodeRefs if needed.
      const key = pathKeyForGroup(code);
      const guid = pathToGuid.get(key);
      if (guid) segmentToCodeGuid.set(code.id, guid);
      continue;
    }
    const ancestor = findGroupAncestor(code);
    if (ancestor) {
      const key = pathKeyForGroup(ancestor);
      const guid = pathToGuid.get(key);
      if (guid) {
        segmentToCodeGuid.set(code.id, guid);
        continue;
      }
    }
    // No group ancestor — emit an implicit codebook entry keyed by segment text.
    const key = implicitRootKey(code.text);
    let guid = pathToGuid.get(key);
    if (!guid) {
      guid = generateGuid();
      pathToGuid.set(key, guid);
      entries.push({ guid, name: code.text, color: code.color, parentGuid: null });
    }
    segmentToCodeGuid.set(code.id, guid);
  }

  return { entries, segmentToCodeGuid };
}

/* ------------------------------------------------------------------ */
/*  XML builders                                                       */
/* ------------------------------------------------------------------ */

function renderCodesXml(entries: CodebookEntry[], indent: string): string {
  const childrenByParent = new Map<string | null, CodebookEntry[]>();
  for (const e of entries) {
    const list = childrenByParent.get(e.parentGuid) ?? [];
    list.push(e);
    childrenByParent.set(e.parentGuid, list);
  }

  function renderNode(entry: CodebookEntry, pad: string): string {
    const children = childrenByParent.get(entry.guid) ?? [];
    const attrs = `guid="${xmlEscape(entry.guid)}" name="${xmlEscape(entry.name)}" color="${xmlEscape(entry.color)}" isCodable="true"`;
    if (children.length === 0) return `${pad}<Code ${attrs}/>`;
    const inner = children.map((c) => renderNode(c, pad + '  ')).join('\n');
    return `${pad}<Code ${attrs}>\n${inner}\n${pad}</Code>`;
  }

  const roots = childrenByParent.get(null) ?? [];
  return roots.map((e) => renderNode(e, indent)).join('\n');
}

function renderTextSelections(
  fileCodes: Code[],
  segmentToCodeGuid: Map<string, string>,
  memosByCodeId: Map<string, Memo[]>,
  pad: string,
): string {
  const out: string[] = [];
  // Sort for deterministic output
  const sorted = [...fileCodes].sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset);
  for (const code of sorted) {
    if (isGroupNode(code)) continue; // groups have no text span
    if (code.boundingBox) continue; // image/PDF selections — not emitted in partial export
    const targetGuid = segmentToCodeGuid.get(code.id);
    if (!targetGuid) continue;
    const memos = memosByCodeId.get(code.id) ?? [];
    const memoXml =
      memos.length > 0
        ? `\n${pad}  <Description>${xmlEscape(memos.map((m) => m.content).join('\n---\n'))}</Description>`
        : '';
    out.push(
      `${pad}<PlainTextSelection guid="${generateGuid()}" startPosition="${code.startOffset}" endPosition="${code.endOffset}" name="${xmlEscape(code.text)}">${memoXml}\n${pad}  <Coding guid="${generateGuid()}">\n${pad}    <CodeRef targetGUID="${targetGuid}"/>\n${pad}  </Coding>\n${pad}</PlainTextSelection>`,
    );
  }
  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Public: .qdc codebook export                                       */
/* ------------------------------------------------------------------ */

export async function exportQdc(codes: Code[], defaultName = 'codebook'): Promise<void> {
  const { entries } = buildCodebook(codes);
  if (entries.length === 0) {
    alert('エクスポートできるコードがありません。');
    return;
  }

  const codesXml = renderCodesXml(entries, '    ');
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<CodeBook xmlns="urn:QDA-XML:codebook:1.0" origin="MinimalQDA">
  <Codes>
${codesXml}
  </Codes>
</CodeBook>
`;

  const blob = new Blob([xml], { type: 'application/xml' });
  await downloadBlob(blob, `${defaultName}.qdc`, 'REFI-QDA Codebook', 'application/xml', 'qdc');
}

/* ------------------------------------------------------------------ */
/*  Public: .qdpx project export                                       */
/* ------------------------------------------------------------------ */

interface QdpxExportInput {
  files: FileEntry[];
  codes: Code[];
  memos: Memo[];
  projectName?: string;
}

export async function exportQdpx(
  input: QdpxExportInput,
  defaultName = 'project',
): Promise<void> {
  const { files, codes, memos } = input;
  if (files.length === 0) {
    alert('エクスポートできるファイルがありません。');
    return;
  }

  const { entries, segmentToCodeGuid } = buildCodebook(codes);
  const memosByCodeId = new Map<string, Memo[]>();
  for (const m of memos) {
    if (!m.codeId) continue;
    const list = memosByCodeId.get(m.codeId) ?? [];
    list.push(m);
    memosByCodeId.set(m.codeId, list);
  }

  const zip = new JSZip();
  const sourcesFolder = zip.folder('sources');
  if (!sourcesFolder) throw new Error('Failed to create sources/ folder in zip');

  const userGuid = generateGuid();
  const projectName = input.projectName?.trim() || defaultName;

  const sourceXmlParts: string[] = [];

  for (const file of sortByOrder(files.map((f, i) => ({ ...f, order: i })))) {
    const sourceGuid = generateGuid();
    const ext = (file.fileType || '').toLowerCase();
    const fileCodes = codes.filter((c) => c.fileId === file.id);

    if (file.fileDataUrl) {
      // Binary source (image or PDF)
      const bytes = dataUrlToBytes(file.fileDataUrl);
      if (!bytes) continue;
      const storedName = `${sourceGuid}.${ext || 'bin'}`;
      sourcesFolder.file(storedName, bytes);
      const internal = `internal://${storedName}`;
      const isPdf = ext === 'pdf';
      const isImage = ext === 'png' || ext === 'jpg' || ext === 'jpeg';
      const tag = isPdf ? 'PDFSource' : isImage ? 'PictureSource' : 'TextSource';
      // Binary selections (boundingBox) are intentionally skipped — our
      // coordinates are ratios 0-1 and we lack native pixel/page dims here,
      // so round-trip precision can't be guaranteed in this partial export.
      sourceXmlParts.push(
        `    <${tag} guid="${sourceGuid}" name="${xmlEscape(file.fileName)}" path="${xmlEscape(internal)}"/>`,
      );
      continue;
    }

    // Text source
    const content = file.fileContent ?? '';
    const storedName = `${sourceGuid}.txt`;
    sourcesFolder.file(storedName, content);
    const internal = `internal://${storedName}`;
    const selectionsXml = renderTextSelections(fileCodes, segmentToCodeGuid, memosByCodeId, '      ');
    if (selectionsXml) {
      sourceXmlParts.push(
        `    <TextSource guid="${sourceGuid}" name="${xmlEscape(file.fileName)}" plainTextPath="${xmlEscape(internal)}">\n${selectionsXml}\n    </TextSource>`,
      );
    } else {
      sourceXmlParts.push(
        `    <TextSource guid="${sourceGuid}" name="${xmlEscape(file.fileName)}" plainTextPath="${xmlEscape(internal)}"/>`,
      );
    }
  }

  const codesXml = renderCodesXml(entries, '      ');
  const nowIso = new Date().toISOString();

  const projectXml = `<?xml version="1.0" encoding="utf-8"?>
<Project xmlns="urn:QDA-XML:project:1.0" name="${xmlEscape(projectName)}" origin="MinimalQDA" creationDateTime="${nowIso}">
  <Users>
    <User guid="${userGuid}" name="MinimalQDA"/>
  </Users>
  <CodeBook>
    <Codes>
${codesXml || '      '}
    </Codes>
  </CodeBook>
  <Sources>
${sourceXmlParts.join('\n')}
  </Sources>
</Project>
`;

  zip.file('project.qde', projectXml);

  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
  await downloadBlob(
    blob,
    `${defaultName}.qdpx`,
    'REFI-QDA Project',
    'application/zip',
    'qdpx',
  );
}
