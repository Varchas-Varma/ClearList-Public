import { useEffect, useRef, useState } from 'react';
import { cleanTitle } from '../domain';
export function EditableText({
  value,
  label,
  onSave,
  onSelect,
  editOnClick = false,
  editing: controlled,
  setEditing: setControlled,
  className = '',
}: {
  value: string;
  label: string;
  onSave(value: string): Promise<boolean>;
  onSelect?(): void;
  editOnClick?: boolean;
  editing?: boolean;
  setEditing?(value: boolean): void;
  className?: string;
}) {
  const [local, setLocal] = useState(false),
    editing = controlled ?? local,
    setEditing = setControlled ?? setLocal;
  const [draft, setDraft] = useState(value),
    [error, setError] = useState(''),
    input = useRef<HTMLInputElement>(null),
    cancelled = useRef(false),
    committing = useRef(false),
    currentValue = useRef(value);
  currentValue.current = value;
  useEffect(() => {
    if (editing) {
      setDraft(currentValue.current);
      setError('');
      cancelled.current = false;
      input.current?.focus();
      input.current?.select();
    }
  }, [editing]);
  async function commit(blur = false) {
    if (cancelled.current || committing.current) return;
    let title: string;
    try {
      title = cleanTitle(draft);
    } catch (error) {
      setError((error as Error).message);
      if (blur) {
        setDraft(value);
        setEditing(false);
      }
      return;
    }
    committing.current = true;
    const ok = title === value || (await onSave(title));
    committing.current = false;
    if (ok) setEditing(false);
  }
  if (!editing)
    return (
      <button
        type="button"
        className={`editable-text ${className}`}
        aria-label={label}
        title={value}
        onClick={() => {
          onSelect?.();
          if (editOnClick) setEditing(true);
        }}
        onDoubleClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === 'F2') {
            e.preventDefault();
            setEditing(true);
          }
        }}
      >
        {value}
      </button>
    );
  return (
    <div className={`inline-editor ${className}`} onClick={(e) => e.stopPropagation()}>
      <input
        ref={input}
        value={draft}
        aria-label={label}
        maxLength={1000}
        aria-invalid={!!error}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          void commit(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            void commit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancelled.current = true;
            setDraft(value);
            setEditing(false);
          }
        }}
      />
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
