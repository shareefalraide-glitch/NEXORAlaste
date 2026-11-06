import React, { useId, useState } from 'react';
import { ArrowDown, ArrowUp, Bookmark, RotateCcw, Settings2, X } from 'lucide-react';
import { ar } from '../ui/index';
import { useSessionValue } from '../hooks/session-state';

export function useTableColumns(columns, sessionRef, scope = 'table') {
  const defaults = columns.map(c => c.id);
  const [visible, setVisible] = useSessionValue(
    sessionRef,
    scope,
    'columns-visible',
    () => defaults,
  );
  const [order, setOrder] = useSessionValue(sessionRef, scope, 'columns-order', () => defaults);
  const toggle = id =>
    setVisible(current =>
      current.includes(id)
        ? current.length > 1
          ? current.filter(x => x !== id)
          : current
        : [...current, id],
    );
  const move = (id, delta) =>
    setOrder(current => {
      const next = [...current],
        index = next.indexOf(id),
        to = index + delta;
      if (index < 0 || to < 0 || to >= next.length) return current;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  const ordered = [
    ...order.filter(id => defaults.includes(id)),
    ...defaults.filter(id => !order.includes(id)),
  ].map(id => columns.find(c => c.id === id));
  const applyOrder = next => {
    if (Array.isArray(next)) {
      const ids = next.filter((id, i) => defaults.includes(id) && next.indexOf(id) === i);
      setOrder([...ids, ...defaults.filter(id => !ids.includes(id))]);
    }
  };
  const applyVisible = next => {
    if (Array.isArray(next)) {
      const ids = next.filter((id, i) => defaults.includes(id) && next.indexOf(id) === i);
      if (ids.length) setVisible(ids);
    }
  };
  return {
    visible,
    setVisible: applyVisible,
    toggle,
    order: ordered.map(c => c.id),
    ordered,
    move,
    setOrder: applyOrder,
  };
}
export function TableViews({
  columns,
  visible,
  onToggle,
  filters,
  onClearAll,
  onSave,
  onRestore,
  saved,
  order,
  onMove,
}) {
  const [expanded, setExpanded] = useState(false),
    id = useId(),
    active = filters.filter(f => f.active);
  const ordered = (order || columns.map(c => c.id))
    .map(id => columns.find(c => c.id === id))
    .filter(Boolean);
  return (
    <div className="table-views">
      <div className="table-view-main">
        <div className="active-filter-list" role="group" aria-label="المرشحات النشطة">
          <span className="active-filter-label">المرشحات النشطة</span>
          {active.length ? (
            active.map(f => (
              <button
                key={f.id}
                type="button"
                className="active-filter-chip"
                onClick={f.clear}
                aria-label={`إزالة مرشح ${f.label}: ${f.value}`}
              >
                <span>
                  {f.label}: <bdi dir="auto">{f.value}</bdi>
                </span>
                <X size={13} />
              </button>
            ))
          ) : (
            <span className="no-active-filters">لا توجد مرشحات</span>
          )}
          {active.length > 1 && (
            <button type="button" className="clear-filters" onClick={onClearAll}>
              مسح الكل
            </button>
          )}
        </div>
        <div className="table-view-actions">
          <button
            type="button"
            className={expanded ? 'selected' : ''}
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded(v => !v)}
          >
            <Settings2 size={15} /> الأعمدة{' '}
            <span>
              {ar(visible.length)}/{ar(columns.length)}
            </span>
          </button>
          <button type="button" onClick={onSave}>
            <Bookmark size={15} /> حفظ العرض مؤقتًا
          </button>
          {saved && (
            <button type="button" onClick={onRestore}>
              <RotateCcw size={15} /> استعادة العرض
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div id={id} className="column-chooser" role="group" aria-label="اختيار الأعمدة الظاهرة">
          <div>
            <strong>الأعمدة الظاهرة وترتيبها</strong>
            <span>اختر عمودًا واحدًا على الأقل؛ الأسهم تغيّر الترتيب.</span>
          </div>
          <div className="column-options">
            {ordered.map((c, index) => (
              <div className="column-choice-row" key={c.id}>
                <label className={visible.includes(c.id) ? 'checked' : ''}>
                  <input
                    type="checkbox"
                    checked={visible.includes(c.id)}
                    disabled={visible.includes(c.id) && visible.length === 1}
                    onChange={() => onToggle(c.id)}
                  />
                  <span>{c.label}</span>
                </label>
                {onMove && (
                  <span className="column-order-actions">
                    <button
                      type="button"
                      disabled={index === 0}
                      aria-label={`تقديم عمود ${c.label}`}
                      onClick={() => onMove(c.id, -1)}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={index === ordered.length - 1}
                      aria-label={`تأخير عمود ${c.label}`}
                      onClick={() => onMove(c.id, 1)}
                    >
                      <ArrowDown size={14} />
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="table-view-note">
        {saved
          ? 'العرض المؤقت في الذاكرة فقط؛ يفقد عند مغادرة الصفحة.'
          : 'يمكن حفظ الفلاتر والأعمدة مؤقتًا طوال وجودك في هذه الصفحة فقط.'}
      </div>
    </div>
  );
}
