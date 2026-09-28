import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  'iframe:not([tabindex="-1"])', 'summary', '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useAccessibleDialog<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const dialogRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const modalStack = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"]'));
    if (modalStack[modalStack.length - 1] !== dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter((element) => element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0);
    const frame = window.requestAnimationFrame(() => (focusable()[0] || dialog).focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (!elements.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) window.requestAnimationFrame(() => previousFocus.focus());
    };
  }, [open]);

  return dialogRef;
}
