import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, Compass, Lightbulb, X } from 'lucide-react';
import { ar } from '../../shared/ui/index';
import { guideChapters, guideSteps } from './guide-data';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const visible = e =>
  !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
const focusable = dialog =>
  Array.from(
    dialog.querySelectorAll(
      'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    ),
  ).filter(visible);

// An accessible, read-only spotlight. The app and any automatically opened
// sample drawer are inert while explaining them; no record actions are invoked.
export default function GuideTour({ index, onStep, onPause, onSkip, onFinish }) {
  const step = guideSteps[index],
    chapter = guideChapters.find(c => c.id === step.chapter);
  const layerRef = useRef(null),
    dialogRef = useRef(null),
    headingRef = useRef(null),
    scrollRef = useRef(null);
  const [indexOpen, setIndexOpen] = useState(false),
    [layout, setLayout] = useState(null),
    [scrollable, setScrollable] = useState(false);
  useEffect(() => setIndexOpen(false), [step.id]);

  // Keep the browser and assistive-technology focus in the topmost dialog.
  // Save and restore prior attributes rather than disturbing other overlay layers.
  useLayoutEffect(() => {
    const layer = layerRef.current,
      dialog = dialogRef.current,
      app = layer?.parentElement;
    if (!layer || !dialog || !app) return undefined;
    headingRef.current?.focus({ preventScroll: true });
    const siblings = Array.from(app.children)
      .filter(el => el !== layer)
      .map(el => ({ el, inert: el.hasAttribute('inert'), aria: el.getAttribute('aria-hidden') }));
    siblings.forEach(({ el }) => {
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    });
    const onKey = e => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onPause();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusable(dialog),
        active = document.activeElement;
      if (!items.length) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0],
        last = items[items.length - 1];
      if (
        !dialog.contains(active) ||
        (e.shiftKey && (active === first || active === dialog || !items.includes(active)))
      ) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      siblings.forEach(({ el, inert, aria }) => {
        if (!inert) el.removeAttribute('inert');
        if (aria === null) el.removeAttribute('aria-hidden');
        else el.setAttribute('aria-hidden', aria);
      });
    };
  }, [step.id, onPause]);

  // Scroll to the target and track its real viewport geometry during page,
  // drawer and orientation changes. CSS animates the spotlight between steps.
  useLayoutEffect(() => {
    let frame = 0,
      disposed = false,
      observer = null;
    const target = () => {
      const selector =
        window.innerWidth <= 760 && step.mobileTarget ? step.mobileTarget : step.target;
      const selected = document.querySelector(selector);
      return {
        element: visible(selected) ? selected : document.querySelector('.page-heading h1'),
        found: visible(selected),
        selector,
      };
    };
    const draw = () => {
      frame = 0;
      if (disposed) return;
      const { element, found, selector } = target(),
        r = element?.getBoundingClientRect(),
        w = window.innerWidth,
        h = window.innerHeight;
      let rect = null;
      if (
        r &&
        r.width > 0 &&
        r.height > 0 &&
        r.right > 0 &&
        r.left < w &&
        r.bottom > 0 &&
        r.top < h
      ) {
        const left = clamp(r.left - 6, 4, w - 4),
          right = clamp(r.right + 6, 4, w - 4),
          top = clamp(r.top - 6, 4, h - 4),
          bottom = clamp(r.bottom + 6, 4, h - 4);
        if (right > left && bottom > top)
          rect = { left, top, width: right - left, height: bottom - top };
      }
      let card = null;
      if (w > 760 && rect && dialogRef.current) {
        const box = dialogRef.current.getBoundingClientRect(),
          cw = box.width || 390,
          ch = box.height || 320,
          gap = 18,
          margin = 12;
        const right = rect.left + rect.width,
          bottom = rect.top + rect.height;
        let x, y;
        if (rect.left >= cw + gap + margin) {
          x = rect.left - cw - gap;
          y = rect.top + (rect.height - ch) / 2;
        } else if (w - right >= cw + gap + margin) {
          x = right + gap;
          y = rect.top + (rect.height - ch) / 2;
        } else if (h - bottom >= ch + gap + margin) {
          x = rect.left + (rect.width - cw) / 2;
          y = bottom + gap;
        } else if (rect.top >= ch + gap + margin) {
          x = rect.left + (rect.width - cw) / 2;
          y = rect.top - ch - gap;
        } else {
          x = (w - cw) / 2;
          y = h - ch - margin;
        }
        card = {
          left: clamp(x, margin, Math.max(margin, w - cw - margin)),
          top: clamp(y, margin, Math.max(margin, h - ch - margin)),
        };
      }
      const area = scrollRef.current;
      if (area) setScrollable(area.scrollHeight > area.clientHeight + 2);
      const next = { rect, card, found, selector, stepId: step.id };
      setLayout(old => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const align = () => {
      const { element } = target();
      if (!element) return;
      const r = element.getBoundingClientRect(),
        reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const behavior = reduce ? 'auto' : 'smooth',
        desired = window.innerWidth <= 760 ? 76 : 105;
      const drawer = element.closest('.drawer-body');
      if (drawer) {
        const header = drawer.previousElementSibling?.getBoundingClientRect();
        const destination = Math.max(desired, (header?.bottom || 0) + 12);
        drawer.scrollTo({ top: Math.max(0, drawer.scrollTop + r.top - destination), behavior });
      } else if (element.closest('.sidebar-nav'))
        element.scrollIntoView({ block: 'nearest', behavior });
      else if (!element.closest('.sidebar,.topbar'))
        window.scrollTo({ top: Math.max(0, window.scrollY + r.top - desired), behavior });
      schedule();
    };
    const onResize = () => {
      align();
      schedule();
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('scroll', schedule, true);
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(schedule);
      const { element } = target();
      if (element) observer.observe(element);
      if (dialogRef.current) observer.observe(dialogRef.current);
    }
    align();
    schedule();
    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('scroll', schedule, true);
    };
  }, [step.id, indexOpen]);

  const visitChapter = id => {
    const next = guideSteps.findIndex(item => item.chapter === id);
    if (next >= 0) {
      setIndexOpen(false);
      onStep(next);
    }
  };
  return (
    <div
      ref={layerRef}
      className="overlay tour-layer"
      data-guide-step={step.id}
      data-target-found={layout?.stepId === step.id && layout?.found ? 'true' : 'false'}
    >
      {layout?.rect ? (
        <div
          className="tour-spotlight"
          aria-hidden="true"
          style={{
            left: layout.rect.left,
            top: layout.rect.top,
            width: layout.rect.width,
            height: layout.rect.height,
          }}
        >
          <i />
        </div>
      ) : (
        <div className="tour-scrim" aria-hidden="true" />
      )}
      <section
        ref={dialogRef}
        className="tour-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-dialog-name tour-step-title"
        aria-describedby="tour-step-description"
        tabIndex={-1}
        style={layout?.card || undefined}
      >
        <div className="tour-head">
          <div className="tour-head-brand">
            <span>
              <Compass size={17} />
            </span>
            <div>
              <strong id="tour-dialog-name">الجولة التعليمية</strong>
              <small>دليلك التفاعلي في NEXORA</small>
            </div>
          </div>
          <button
            type="button"
            className="tour-close"
            aria-label="إيقاف الجولة مؤقتًا"
            title="إيقاف الجولة مؤقتًا"
            onClick={onPause}
          >
            <X size={18} />
          </button>
        </div>
        <div className="tour-body">
          <div className="tour-scroll" ref={scrollRef}>
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              الخطوة {ar(index + 1)} من {ar(guideSteps.length)}. {chapter.title}. {step.title}.{' '}
              {step.body}
            </div>
            <div className="tour-meta">
              <span>
                <BookOpen size={14} /> {chapter.title}
              </span>
              <b>
                الخطوة {ar(index + 1)} من {ar(guideSteps.length)}
              </b>
            </div>
            <div
              className="tour-position"
              role="progressbar"
              aria-label="موضعك في الجولة"
              aria-valuemin={1}
              aria-valuemax={guideSteps.length}
              aria-valuenow={index + 1}
            >
              <span style={{ width: `${((index + 1) / guideSteps.length) * 100}%` }} />
            </div>
            <h2 id="tour-step-title" ref={headingRef} tabIndex={-1}>
              {step.title}
            </h2>
            <p id="tour-step-description">{step.body}</p>
            {step.tip && (
              <div className="tour-tip">
                <Lightbulb size={16} />
                <span>{step.tip}</span>
              </div>
            )}
            {layout?.stepId === step.id && !layout.found && (
              <p className="tour-missing" role="status">
                العنصر المحدد غير متاح في العينة الحالية؛ يمكنك متابعة الجولة.
              </p>
            )}
            <div className="tour-utilities">
              <button
                type="button"
                aria-expanded={indexOpen}
                aria-controls="guide-index"
                onClick={() => setIndexOpen(value => !value)}
              >
                فهرس المحاور <ChevronDown size={14} className={indexOpen ? 'open' : ''} />
              </button>
              <button type="button" onClick={onPause}>
                استكشف القسم
              </button>
              <button type="button" onClick={onSkip}>
                تخطي الجولة
              </button>
            </div>
            {indexOpen && (
              <nav id="guide-index" className="tour-index" aria-label="فهرس محاور الجولة">
                {guideChapters.map((item, i) => (
                  <button
                    type="button"
                    key={item.id}
                    aria-current={item.id === step.chapter ? 'step' : undefined}
                    onClick={() => visitChapter(item.id)}
                  >
                    <span>{ar(i + 1)}</span>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.caption}</small>
                    </span>
                    <ArrowLeft size={14} />
                  </button>
                ))}
              </nav>
            )}
          </div>
          {scrollable && (
            <div className="tour-scroll-hint" aria-hidden="true">
              مرّر لعرض بقية الشرح والخيارات <ChevronDown size={13} />
            </div>
          )}
          <div className="tour-actions">
            <button
              type="button"
              className="tour-previous"
              disabled={index === 0}
              onClick={() => onStep(index - 1)}
            >
              <ArrowRight size={16} /> السابق
            </button>
            <button
              type="button"
              className="tour-next"
              onClick={() => (index === guideSteps.length - 1 ? onFinish() : onStep(index + 1))}
            >
              {index === guideSteps.length - 1 ? 'إنهاء الجولة' : 'التالي'} <ArrowLeft size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
