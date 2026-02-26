import { useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/useAppStore';

interface TheoryNodeProps {
  data: Record<string, unknown>;
}

export function TheoryNode({ data }: TheoryNodeProps) {
  const { t } = useTranslation();
  const theoryLabel = useAppStore((s) => s.theoryLabel);
  const setTheoryLabel = useAppStore((s) => s.setTheoryLabel);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(theoryLabel);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const _ = data; // acknowledge data prop

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = useCallback(() => {
    setTheoryLabel(draft.trim());
    setEditing(false);
  }, [draft, setTheoryLabel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === 'Escape') {
        setDraft(theoryLabel);
        setEditing(false);
      }
    },
    [handleSave, theoryLabel],
  );

  const isEmpty = !theoryLabel.trim();

  if (editing) {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
          borderRadius: 16,
          padding: '8px 12px',
          boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
          minWidth: 180,
          maxWidth: 280,
        }}
      >
        <Handle type="source" position={Position.Right} />
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          rows={3}
          className="nodrag nowheel"
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 8,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            padding: '6px 8px',
            resize: 'none',
            outline: 'none',
            lineHeight: '1.4',
          }}
          placeholder={t('mindmap.theoryPlaceholder')}
        />
        <div
          style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: 10,
            marginTop: 4,
            textAlign: 'center',
          }}
        >
          Enter ⏎
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        setDraft(theoryLabel);
        setEditing(true);
      }}
      style={{
        background: 'linear-gradient(135deg, #8B5CF6, #EC4899)',
        borderRadius: 16,
        padding: isEmpty ? '10px 16px' : '10px 20px',
        boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
        cursor: 'pointer',
        minWidth: 140,
        maxWidth: 280,
        textAlign: 'center',
      }}
    >
      <Handle type="source" position={Position.Right} />
      {isEmpty ? (
        <div>
          <div
            style={{
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
              marginBottom: 4,
            }}
          >
            Theory
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 11,
              fontStyle: 'italic',
              borderTop: '1px dashed rgba(255,255,255,0.4)',
              paddingTop: 4,
            }}
          >
            ✎ {t('mindmap.theoryPlaceholder')}
          </div>
        </div>
      ) : (
        <div
          style={{
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: '1.4',
          }}
        >
          {theoryLabel}
        </div>
      )}
    </div>
  );
}
