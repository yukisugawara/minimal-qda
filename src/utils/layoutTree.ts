export type PanelId = 'files' | 'codes' | 'center' | 'memos';

export type LayoutNode =
  | { type: 'leaf'; panelId: PanelId }
  | {
      type: 'split';
      direction: 'horizontal' | 'vertical';
      first: LayoutNode;
      second: LayoutNode;
      ratio: number;
    };

export type DropEdge = 'top' | 'bottom' | 'left' | 'right' | 'center';

/** Default layout: Files + Codes (vertical) on left, Viewer center, Memos right */
export const DEFAULT_LAYOUT: LayoutNode = {
  type: 'split',
  direction: 'horizontal',
  ratio: 0.25,
  first: {
    type: 'split',
    direction: 'vertical',
    ratio: 0.4,
    first: { type: 'leaf', panelId: 'files' },
    second: { type: 'leaf', panelId: 'codes' },
  },
  second: {
    type: 'split',
    direction: 'horizontal',
    ratio: 0.67,
    first: { type: 'leaf', panelId: 'center' },
    second: { type: 'leaf', panelId: 'memos' },
  },
};

/** Remove a panel from the tree. Returns the cleaned-up tree, or null if the tree becomes empty. */
export function removePanel(tree: LayoutNode, panelId: PanelId): LayoutNode | null {
  if (tree.type === 'leaf') {
    return tree.panelId === panelId ? null : tree;
  }

  const first = removePanel(tree.first, panelId);
  const second = removePanel(tree.second, panelId);

  if (first === null && second === null) return null;
  if (first === null) return second;
  if (second === null) return first;

  return { ...tree, first, second };
}

/** Insert a panel next to a target panel at the specified edge. */
export function insertPanel(
  tree: LayoutNode,
  targetPanelId: PanelId,
  edge: DropEdge,
  panelId: PanelId,
): LayoutNode {
  if (tree.type === 'leaf') {
    if (tree.panelId !== targetPanelId) return tree;

    const newLeaf: LayoutNode = { type: 'leaf', panelId };

    if (edge === 'center') {
      // Swap: just return the new leaf (caller handles swap via swapPanels)
      return tree;
    }

    const direction: 'horizontal' | 'vertical' =
      edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical';
    const isFirst = edge === 'left' || edge === 'top';

    return {
      type: 'split',
      direction,
      ratio: 0.5,
      first: isFirst ? newLeaf : tree,
      second: isFirst ? tree : newLeaf,
    };
  }

  return {
    ...tree,
    first: insertPanel(tree.first, targetPanelId, edge, panelId),
    second: insertPanel(tree.second, targetPanelId, edge, panelId),
  };
}

/** Swap two panels' positions in the tree. */
export function swapPanels(
  tree: LayoutNode,
  panelId1: PanelId,
  panelId2: PanelId,
): LayoutNode {
  if (tree.type === 'leaf') {
    if (tree.panelId === panelId1) return { type: 'leaf', panelId: panelId2 };
    if (tree.panelId === panelId2) return { type: 'leaf', panelId: panelId1 };
    return tree;
  }

  return {
    ...tree,
    first: swapPanels(tree.first, panelId1, panelId2),
    second: swapPanels(tree.second, panelId1, panelId2),
  };
}

/**
 * Update the ratio of a split node at the given path.
 * Path is an array of 'first' | 'second' to navigate the tree.
 */
export function updateRatio(
  tree: LayoutNode,
  path: ('first' | 'second')[],
  newRatio: number,
): LayoutNode {
  if (tree.type === 'leaf') return tree;

  if (path.length === 0) {
    return { ...tree, ratio: newRatio };
  }

  const [head, ...rest] = path;
  if (head === 'first') {
    return { ...tree, first: updateRatio(tree.first, rest, newRatio) };
  } else {
    return { ...tree, second: updateRatio(tree.second, rest, newRatio) };
  }
}

/** Find the path to a panel in the tree. Returns null if not found. */
export function findPanelPath(
  tree: LayoutNode,
  panelId: PanelId,
): ('first' | 'second')[] | null {
  if (tree.type === 'leaf') {
    return tree.panelId === panelId ? [] : null;
  }

  const inFirst = findPanelPath(tree.first, panelId);
  if (inFirst !== null) return ['first', ...inFirst];

  const inSecond = findPanelPath(tree.second, panelId);
  if (inSecond !== null) return ['second', ...inSecond];

  return null;
}

/** Move a panel: remove it from current position, then insert at target edge. */
export function movePanel(
  tree: LayoutNode,
  panelId: PanelId,
  targetPanelId: PanelId,
  edge: DropEdge,
): LayoutNode {
  if (panelId === targetPanelId && edge === 'center') return tree;

  if (edge === 'center') {
    // Swap the two panels
    return swapPanels(tree, panelId, targetPanelId);
  }

  // Remove the panel, then insert at the target edge
  const afterRemove = removePanel(tree, panelId);
  if (!afterRemove) return tree; // shouldn't happen

  return insertPanel(afterRemove, targetPanelId, edge, panelId);
}
