import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

interface ModalShellProps {
  title: string;
  // A line under the title that says what the form is for
  intro?: ReactNode;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  // The foot: the primary action, and any hint or error above it. It stays put while the body scrolls
  footer: ReactNode;
  children: ReactNode;
}

// Every Atlas form modal: add a spot, suggest an edit, report a problem. A header with the title and
// a 44px close, a body that scrolls, and a foot that holds the submit. On desktop it's a 2xl card
// over a scrim; on a phone it's the whole page, and the close is its way out.
export default function ModalShell({ title, intro, onClose, onSubmit, footer, children }: ModalShellProps) {
  const titleId = useRef(`modal-${Math.random().toString(36).slice(2)}`).current;

  // Escape closes; focus goes back to whatever opened the modal
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div className="browse-modal-backdrop" onClick={onClose}>
      <form
        className="browse-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="x" weight="bold" size={20} />
          </button>
        </header>
        <div className="modal-body">
          {intro && <p className="modal-intro">{intro}</p>}
          {children}
        </div>
        <footer className="modal-foot">{footer}</footer>
      </form>
    </div>,
    document.body,
  );
}
