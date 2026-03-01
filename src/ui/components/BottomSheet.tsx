import { ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="overlay-backdrop sheet-backdrop" role="presentation" onClick={onClose}>
      <section className="sheet-shell chrome-card" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
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
