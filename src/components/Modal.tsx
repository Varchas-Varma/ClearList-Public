import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  canClose = true,
}: {
  title: string;
  children: ReactNode;
  onClose(): void;
  wide?: boolean;
  canClose?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      className={wide ? 'modal preview-modal' : 'modal'}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close.current();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close.current();
        }
      }}
    >
      <header className="modal-header">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          disabled={!canClose}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      {children}
    </dialog>,
    document.body,
  );
}
