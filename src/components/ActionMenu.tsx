import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
export interface MenuAction {
  label: string;
  run(): void;
  disabled?: boolean;
  danger?: boolean;
}
export function ActionMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false),
    button = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null),
    id = useId();
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    function outside(e: Event) {
      if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [open]);
  const rect = button.current?.getBoundingClientRect();
  return (
    <>
      <button
        type="button"
        ref={button}
        className="icon-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        <MoreHorizontal size={18} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="menu"
            aria-label={label}
            className="action-menu"
            style={{
              top: Math.max(
                8,
                Math.min(rect?.bottom ?? 8, window.innerHeight - actions.length * 36 - 20),
              ),
              left: Math.max(8, Math.min((rect?.right ?? 220) - 220, window.innerWidth - 228)),
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                button.current?.focus();
              }
              if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
                e.preventDefault();
                const buttons = Array.from(
                    menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ??
                      [],
                  ),
                  current = buttons.indexOf(document.activeElement as HTMLButtonElement),
                  index =
                    e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? buttons.length - 1
                        : (current + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) %
                          buttons.length;
                buttons[index]?.focus();
              }
            }}
          >
            {actions.map((a) => (
              <button
                type="button"
                role="menuitem"
                key={a.label}
                disabled={a.disabled}
                className={a.danger ? 'danger-text' : ''}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  a.run();
                }}
              >
                {a.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
