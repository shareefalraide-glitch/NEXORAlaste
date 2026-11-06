import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

import { IconButton } from './UiButtons';
// Keep focus within the top-most dialog and restore it after close.
// Keep focus within the top-most dialog and restore it after close.
function useDialogFocus(ref, onClose) {
  useEffect(() => {
    const previous = document.activeElement,
      frame = requestAnimationFrame(() => {
        const dialog = ref.current,
          dialogs = document.querySelectorAll('.overlay [role="dialog"]');
        if (
          !dialog ||
          dialogs[dialogs.length - 1] !== dialog ||
          dialog.contains(document.activeElement)
        )
          return;
        const preferred = dialog.querySelector('[data-dialog-autofocus]');
        if (preferred && !preferred.disabled && preferred.getClientRects().length)
          preferred.focus();
        else dialog.focus();
      });
    const onKey = e => {
      const el = ref.current,
        dialogs = document.querySelectorAll('.overlay [role="dialog"]');
      if (!el || dialogs[dialogs.length - 1] !== el) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = Array.from(
        el.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(x => x.getClientRects().length);
      if (!list.length) {
        e.preventDefault();
        el.focus();
        return;
      }
      const first = list[0],
        last = list[list.length - 1],
        active = document.activeElement;
      if (
        !el.contains(active) ||
        (e.shiftKey && (active === first || active === el || !list.includes(active)))
      ) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [ref, onClose]);
}
export function Modal({ title, subtitle, onClose, children, wide = false, className = '' }) {
  const ref = useRef(null);
  useDialogFocus(ref, onClose);
  return (
    <div
      className="overlay"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? 'modal-wide' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton icon={X} label="إغلاق" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}
export function Drawer({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
  scrollMemory,
  scrollKey,
  workspaceControl,
}) {
  const ref = useRef(null),
    bodyRef = useRef(null),
    [expanded, setExpanded] = useState(false);
  useDialogFocus(ref, onClose);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body || !scrollMemory || !scrollKey) return;
    const saved = scrollMemory.current.__drawerScroll || (scrollMemory.current.__drawerScroll = {});
    body.scrollTop = saved[scrollKey] || 0;
    return () => {
      saved[scrollKey] = body.scrollTop;
    };
  }, [scrollMemory, scrollKey]);
  return (
    <div
      className="overlay drawer-overlay"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`drawer ${workspaceControl ? 'drawer-has-workspace' : ''} ${wide ? 'drawer-wide' : ''} ${wide && expanded ? 'drawer-expanded' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="drawer-header">
          <div>
            <span className="drawer-kicker">تفاصيل السجل</span>
            <h2 tabIndex="-1" data-dialog-autofocus="true">
              {title}
            </h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="drawer-header-actions">
            {wide && (
              <IconButton
                className="drawer-resize"
                icon={expanded ? Minimize2 : Maximize2}
                label={expanded ? 'تصغير مساحة التحقيق' : 'توسيع مساحة التحقيق'}
                onClick={() => setExpanded(v => !v)}
              />
            )}
            <IconButton icon={X} label="إغلاق" onClick={onClose} />
          </div>
        </div>
        {workspaceControl && <div className="drawer-workspace">{workspaceControl}</div>}
        <div className="drawer-body" ref={bodyRef}>
          {children}
        </div>
      </div>
    </div>
  );
}
