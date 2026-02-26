import type { Code, Memo } from '../store/useAppStore';

interface ExportData {
  fileName: string | null;
  fileContent: string | null;
  codes: Code[];
  memos: Memo[];
}

/** A code is a "group node" if it has no text selection and no bounding box */
function isGroupNode(code: Code): boolean {
  return code.startOffset === 0 && code.endOffset === 0 && !code.boundingBox;
}

export function exportHTML(data: ExportData) {
  const { fileName, codes, memos } = data;

  const getChildren = (parentId: string | null) =>
    codes
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.order - b.order);

  const rootCodes = getChildren(null);

  // Separate root-level groups from ungrouped leaf codes
  const rootGroups = rootCodes.filter(
    (c) => isGroupNode(c) || getChildren(c.id).length > 0
  );
  const rootLeaves = rootCodes.filter(
    (c) => !isGroupNode(c) && getChildren(c.id).length === 0
  );

  const renderTree = (children: Code[], depth: number): string => {
    if (children.length === 0) return '';
    return children
      .map((code) => {
        const grandchildren = getChildren(code.id);
        const codeHtml = renderCode(code, memos);
        const childHtml = grandchildren.length > 0
          ? `<div style="margin-left:${depth > 0 ? 20 : 0}px">${renderTree(grandchildren, depth + 1)}</div>`
          : '';
        return codeHtml + childHtml;
      })
      .join('\n');
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MinimalQDA Export – ${escapeHTML(fileName ?? 'Untitled')}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; color: #1f2937; }
  h1 { font-size: 1.5rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
  h2 { font-size: 1.15rem; margin-top: 2rem; }
  .category-header { display: flex; align-items: center; gap: 0.5rem; }
  .color-dot { width: 14px; height: 14px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .code-item { margin: 0.5rem 0; padding: 0.5rem 0.75rem; border-left: 4px solid; border-radius: 4px; background: #f9fafb; }
  .code-text { font-weight: 500; }
  .memo { margin-top: 0.25rem; font-size: 0.875rem; color: #6b7280; padding-left: 0.5rem; border-left: 2px solid #d1d5db; }
  .meta { font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem; }
  .uncategorized { color: #6b7280; font-style: italic; }
</style>
</head>
<body>
<h1>MinimalQDA – ${escapeHTML(fileName ?? 'Untitled')}</h1>
<p class="meta">Exported: ${new Date().toLocaleString()}</p>

${rootGroups.map((group) => {
  const children = getChildren(group.id);
  return `
<h2 class="category-header">
  <span class="color-dot" style="background:${group.color}"></span>
  ${escapeHTML(group.text)} (${children.length})
</h2>
${children.length === 0 ? '<p class="meta">No codes</p>' : renderTree(children, 1)}
`;
}).join('\n')}

${rootLeaves.length > 0 ? `
<h2 class="uncategorized">Uncategorized (${rootLeaves.length})</h2>
${rootLeaves.map((code) => renderCode(code, memos)).join('\n')}
` : ''}

</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const name = fileName?.replace(/\.[^.]+$/, '') ?? 'export';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}_export.html`;
  a.click();
  URL.revokeObjectURL(url);
}

function renderCode(code: Code, memos: Memo[]): string {
  const codeMemos = memos.filter((m) => m.codeId === code.id);
  return `<div class="code-item" style="border-color:${code.color}">
  <div class="code-text"><span class="color-dot" style="background:${code.color}"></span> ${escapeHTML(code.text)}</div>
  ${codeMemos.map((m) => `<div class="memo">${escapeHTML(m.content)}</div>`).join('\n')}
</div>`;
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
