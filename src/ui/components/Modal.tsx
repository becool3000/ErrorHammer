import { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  shellClassName?: string;
}

export function Modal({ open, title, onClose, children, shellClassName }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="overlay-backdrop" role="presentation" onClick={onClose}>
      <section
        className={shellClassName ? `modal-shell chrome-card ${shellClassName}` : "modal-shell chrome-card"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="overlay-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label={`Close ${title}`}>
            Close
          </button>
        </div>
        <div className="overlay-body">{children}</div>
      </section>
    </div>
  );
}
