import { useState } from 'react';
import { Modal } from './Modal';
export function Confirm({
  title,
  message,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  onConfirm(): Promise<boolean>;
  onClose(): void;
}) {
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <p>{message}</p>
      {failed && <p role="alert">Could not delete this item. Please retry.</p>}
      <div className="dialog-actions">
        <button type="button" autoFocus disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="danger-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await onConfirm();
            setBusy(false);
            if (ok) onClose();
            else setFailed(true);
          }}
        >
          {busy ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </Modal>
  );
}
