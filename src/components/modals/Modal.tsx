import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../ui';

/** A large WoW-framed modal dialog. Esc, the close button or a click outside closes it. */
export function Modal({
  title,
  icon,
  subtitle,
  onClose,
  children,
}: {
  title: ReactNode;
  icon?: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="panel modal"
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog itself, outside its box.
        const box = ref.current?.getBoundingClientRect();
        if (e.target !== ref.current || !box) return;
        const inside =
          e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom;
        if (!inside) onClose();
      }}
    >
      <header className="panel-title modal-title">
        {icon && <Icon icon={icon} size={24} />}
        <h2>{title}</h2>
        {subtitle && <span className="modal-subtitle">{subtitle}</span>}
        <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
