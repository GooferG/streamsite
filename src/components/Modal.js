import { useEffect, useRef } from 'react';

// Accessible modal shell: backdrop + centered panel with dialog semantics.
// - role="dialog" + aria-modal + aria-label for screen readers
// - Escape closes from anywhere in the dialog (not just a focused input)
// - Click/touch on the backdrop closes; clicks inside the panel don't
// - Restores focus to whatever was focused before the modal opened
//
// Initial focus is left to the caller's autoFocus on its primary input.
export default function Modal({ onClose, label, panelClassName = '', children }) {
  const restoreRef = useRef(null);

  useEffect(() => {
    // Remember the trigger element so focus can return to it on close.
    restoreRef.current = document.activeElement;
    return () => {
      const el = restoreRef.current;
      if (el && typeof el.focus === 'function') el.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className={panelClassName} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
