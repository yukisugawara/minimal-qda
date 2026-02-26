import { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useTranslation } from 'react-i18next';

export interface CategoryNodeData {
  label: string;
  childCodes: { text: string; childCount: number }[];
  totalDescendants: number;
  nodeStyle?: React.CSSProperties;
  [key: string]: unknown;
}

const MAX_TOOLTIP_ITEMS = 15;

export function CategoryNode({ data }: NodeProps) {
  const [hovered, setHovered] = useState(false);
  const { t } = useTranslation();

  const { label, childCodes, totalDescendants, nodeStyle } =
    data as CategoryNodeData;

  const hasChildren = childCodes && childCodes.length > 0;
  const displayedCodes = hasChildren
    ? childCodes.slice(0, MAX_TOOLTIP_ITEMS)
    : [];
  const remaining = hasChildren
    ? childCodes.length - MAX_TOOLTIP_ITEMS
    : 0;

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Left} />

      <div style={nodeStyle ?? {}}>
        {label as string}
      </div>

      <Handle type="source" position={Position.Right} />

      {hasChildren && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: hovered
              ? 'translate(-50%, 8px)'
              : 'translate(-50%, 4px)',
            opacity: hovered ? 1 : 0,
            pointerEvents: 'none',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            zIndex: 1000,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '8px 10px',
            maxWidth: 280,
            minWidth: 140,
            fontSize: 11,
          }}
        >
          <div
            style={{
              color: '#6b7280',
              marginBottom: 4,
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {t('categorymap.childCodes')} ({totalDescendants})
          </div>
          {displayedCodes.map((child, i) => (
            <div
              key={i}
              style={{
                color: '#1f2937',
                lineHeight: 1.6,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {child.text}
              {child.childCount > 0 && (
                <span style={{ color: '#9ca3af', marginLeft: 4 }}>
                  (+{child.childCount})
                </span>
              )}
            </div>
          ))}
          {remaining > 0 && (
            <div style={{ color: '#9ca3af', marginTop: 2 }}>
              ...+{remaining} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}
