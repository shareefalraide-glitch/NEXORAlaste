import React, { useEffect, useRef, useState } from 'react';
import { MoveHorizontal } from 'lucide-react';
import { StateMessage } from './UIStates';
export function Empty({
  title = 'لا توجد نتائج مطابقة',
  text = 'جرّب تغيير كلمات البحث أو خيارات التصفية.',
}) {
  return <StateMessage variant="empty" title={title} text={text} compact />;
}
export function ScrollArea({
  children,
  className = '',
  label = 'منطقة تمرير أفقي',
  hint = 'مرّر أفقيًا لعرض المحتوى كاملًا',
}) {
  const ref = useRef(null),
    [overflow, setOverflow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflow(el.scrollWidth > el.clientWidth + 1);
    const frame = requestAnimationFrame(check);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null;
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    window.addEventListener('resize', check);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', check);
    };
  }, [children]);
  return (
    <div className="scroll-frame">
      <div
        ref={ref}
        className={className}
        role="region"
        aria-label={label}
        tabIndex={overflow ? 0 : undefined}
      >
        {children}
      </div>
      {overflow && (
        <div className="scroll-cue">
          <MoveHorizontal size={14} />
          <span>{hint}</span>
        </div>
      )}
    </div>
  );
}
export function Table({ head, children, empty = false, groups, label = 'جدول البيانات' }) {
  const annotate = children =>
    React.Children.map(children, row => {
      if (!React.isValidElement(row)) return row;
      const cells = React.Children.map(row.props.children, (cell, index) =>
        React.isValidElement(cell) && cell.type === 'td'
          ? React.cloneElement(cell, {
              'data-label':
                typeof head[index] === 'string' ? head[index] : head[index]?.label || '',
            })
          : cell,
      );
      return React.cloneElement(row, undefined, cells);
    });
  return (
    <ScrollArea className="table-scroll" label={label} hint="مرّر أفقيًا لعرض بقية الأعمدة">
      <table>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th scope="col" key={i}>
                {h === '' ? (
                  <span className="sr-only">الإجراء</span>
                ) : typeof h === 'object' && !React.isValidElement(h) ? (
                  h.node
                ) : (
                  h
                )}
              </th>
            ))}
          </tr>
        </thead>
        {groups ? (
          groups.map(group => (
            <tbody key={group.key} aria-label={group.label}>
              {group.header}
              {annotate(group.rows)}
            </tbody>
          ))
        ) : (
          <tbody>{annotate(children)}</tbody>
        )}
      </table>
      {empty && <Empty />}
    </ScrollArea>
  );
}
