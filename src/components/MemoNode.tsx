import { useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface MemoNodeData {
  label: string;
  codeName: string;
  codeColor: string;
  nodeStyle?: React.CSSProperties;
  [key: string]: unknown;
}

export function MemoNode({ data }: NodeProps) {
  const [hovered, setHovered] = useState(false);

  const { label, codeName, codeColor, nodeStyle } = data as MemoNodeData;

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Code name badge - fades in on hover */}
      <div
        style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: hovered
            ? 'translate(-50%, -6px)'
            : 'translate(-50%, 0px)',
          opacity: hovered ? 0.7 : 0,
          pointerEvents: 'none',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          zIndex: 1000,
          background: codeColor + '30',
          border: `1px solid ${codeColor}`,
          borderRadius: 8,
          padding: '2px 8px',
          fontSize: 10,
          fontWeight: 600,
          color: '#374151',
          whiteSpace: 'nowrap',
          maxWidth: 200,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {codeName}
      </div>

      <Handle type="target" position={Position.Left} />

      <div style={nodeStyle ?? {}}>
        {label as string}
      </div>
    </div>
  );
}
