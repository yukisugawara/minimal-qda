import { useState, type CSSProperties } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { BoundingBox } from '../store/useAppStore';

export interface CodeNodeData {
  label: string;
  sourceText?: string;
  imageDataUrl?: string;
  boundingBox?: BoundingBox;
  fileName?: string;
  nodeStyle?: CSSProperties;
  [key: string]: unknown;
}

export function CodeNode({ data }: NodeProps) {
  const [hovered, setHovered] = useState(false);

  const {
    label,
    sourceText,
    imageDataUrl,
    boundingBox,
    fileName,
    nodeStyle,
  } = data as CodeNodeData;

  const hasTooltip = !!(sourceText || (imageDataUrl && boundingBox));

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Top} />

      <div style={nodeStyle ?? {}}>
        {label as string}
      </div>

      <Handle type="source" position={Position.Bottom} />

      {hasTooltip && (
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
            maxWidth: 260,
            minWidth: 120,
            fontSize: 11,
          }}
        >
          {sourceText && (
            <div>
              <div style={{ color: '#6b7280', marginBottom: 4, fontSize: 10 }}>
                {fileName}
              </div>
              <div style={{ color: '#1f2937', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {sourceText.length > 100
                  ? sourceText.slice(0, 100) + '\u2026'
                  : sourceText}
              </div>
            </div>
          )}

          {!sourceText && imageDataUrl && boundingBox && (
            <div>
              <div style={{ color: '#6b7280', marginBottom: 4, fontSize: 10 }}>
                {fileName}
              </div>
              <div
                style={{
                  width: 240,
                  height: 140,
                  overflow: 'hidden',
                  borderRadius: 6,
                  position: 'relative',
                }}
              >
                <img
                  src={imageDataUrl}
                  alt=""
                  style={{
                    position: 'absolute',
                    // Scale image so that the bounding box region fills the container
                    width: `${100 / boundingBox.width}%`,
                    height: `${100 / boundingBox.height}%`,
                    left: `${(-boundingBox.x / boundingBox.width) * 100}%`,
                    top: `${(-boundingBox.y / boundingBox.height) * 100}%`,
                    objectFit: 'cover',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
