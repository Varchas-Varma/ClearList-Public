import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { cleanTitle } from '../domain';
export function AddField({
  label,
  id,
  onAdd,
  autoFocus = false,
  onCancel,
}: {
  label: string;
  id?: string;
  onAdd(value: string): Promise<boolean>;
  autoFocus?: boolean;
  onCancel?(): void;
}) {
  const [value, setValue] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    input = useRef<HTMLInputElement>(null);
  return (
    <form
      className="add-field"
      autoComplete="off"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        let title: string;
        try {
          title = cleanTitle(value);
        } catch (error) {
          setError((error as Error).message);
          return;
        }
        setError('');
        setBusy(true);
        const ok = await onAdd(title);
        setBusy(false);
        if (ok) {
          setValue('');
          requestAnimationFrame(() => input.current?.focus());
        }
      }}
    >
      <div className="add-field-inner">
        <Plus size={18} aria-hidden="true" />
        <input
          ref={input}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          id={id}
          aria-label={label}
          placeholder={label}
          value={value}
          autoFocus={autoFocus}
          readOnly={busy}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && onCancel) {
              e.stopPropagation();
              onCancel();
            }
          }}
        />
        {value.trim() && (
          <button type="submit" disabled={busy} className="text-button">
            Add
          </button>
        )}
      </div>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}
