import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * A modal dialog over a dimmed backdrop (spec #2 §7.1): title bar in the panel header colour,
 * a close button, Esc to close (§7.3). Focus moves into it when it opens.
 */
export function Dialog({ title, onClose, children, className }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-layer live">
      <div className="backdrop" onClick={onClose} />
      <div ref={panelRef} className={className ? `dialog panel ${className}` : 'dialog panel'} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="dialog-head">
          <h2 id={titleId} className="display">
            {title}
          </h2>
          <button type="button" className="round-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}
