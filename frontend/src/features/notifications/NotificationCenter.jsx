import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  CheckCheck,
  ChevronLeft,
  ListChecks,
  Pin,
  ShieldAlert,
} from 'lucide-react';
import { ar, IconButton, Tag } from '../../shared/ui/index';

export const initialNotifications = () => [
  {
    id: 'notice-approval-083',
    category: 'approval',
    kind: 'incident',
    entityId: 'INC-2026-083',
    title: 'طلب احتواء بانتظار المراجعة',
    summary: 'الحادثة INC-2026-083 · طلب ضمن العينة',
    time: 'عينة توضيحية',
    read: false,
  },
  {
    id: 'notice-incident-084',
    category: 'incident',
    kind: 'incident',
    entityId: 'INC-2026-084',
    title: 'حادثة جديدة تحتاج إسنادًا',
    summary: 'الحادثة INC-2026-084 · حالة تجريبية',
    time: 'عينة توضيحية',
    read: false,
  },
  {
    id: 'notice-alert-1284',
    category: 'alert',
    kind: 'alert',
    entityId: 'ALT-1284',
    title: 'تنبيه مصادقة في العينة',
    summary: 'التنبيه ALT-1284 · إشارة توضيحية',
    time: 'عينة توضيحية',
    read: true,
  },
];

export default function NotificationCenter({
  items,
  setItems,
  expanded,
  onToggle,
  onOpen,
  shortcut,
  data,
}) {
  const [filter, setFilter] = useState('all'),
    [priorityFirst, setPriorityFirst] = useState(false),
    [groupBy, setGroupBy] = useState('none'),
    anchor = useRef(null),
    unread = items.filter(x => !x.read).length;
  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = e => {
      if (e.key === 'Escape') {
        onToggle();
        requestAnimationFrame(() => anchor.current?.querySelector('.notification-button')?.focus());
      }
    };
    const outside = e => {
      if (anchor.current && !anchor.current.contains(e.target)) onToggle();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', outside);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', outside);
    };
  }, [expanded, onToggle]);
  const severity = item =>
    item.kind === 'incident'
      ? data?.incidents.find(x => x.id === item.entityId)?.severity
      : item.kind === 'alert'
        ? data?.alerts.find(x => x.id === item.entityId)?.severity
        : null;
  const rank = { حرجة: 3, عالية: 2, متوسطة: 1 };
  const filtered = items.filter(
    x =>
      filter === 'all' ||
      (filter === 'unread' ? !x.read : filter === 'pinned' ? !!x.pinned : x.category === filter),
  );
  const visible = priorityFirst
    ? [...filtered].sort((a, b) => (rank[severity(b)] || 0) - (rank[severity(a)] || 0))
    : filtered;
  const incidentFor = item =>
    item.kind === 'incident'
      ? item.entityId
      : item.kind === 'alert'
        ? data?.alerts.find(x => x.id === item.entityId)?.incident
        : null;
  const groupLabel = item =>
    groupBy === 'incident'
      ? incidentFor(item)
        ? `حادثة ${incidentFor(item)}`
        : 'دون حادثة مرتبطة'
      : { approval: 'الموافقات', incident: 'الحوادث', alert: 'التنبيهات' }[item.category] ||
        'أنواع أخرى';
  const groups =
    groupBy === 'none'
      ? [{ label: '', items: visible }]
      : Object.entries(
          visible.reduce((acc, item) => {
            const key = groupLabel(item);
            (acc[key] ??= []).push(item);
            return acc;
          }, Object.create(null)),
        ).map(([label, items]) => ({ label, items }));
  const mark = (id, read, restoreFocus = false) => {
    setItems(prev => prev.map(x => (x.id === id ? { ...x, read } : x)));
    if (restoreFocus && filter === 'unread' && read)
      requestAnimationFrame(() => {
        const el =
          anchor.current?.querySelector('.notification-mark') ||
          anchor.current?.querySelector('.notification-filters .active');
        el?.focus();
      });
  };
  // Opening is idempotent: it only makes the selected notification read, never
  // toggles it. The separate action can explicitly mark it unread again.
  const choose = item => {
    mark(item.id, true);
    anchor.current?.querySelector('.notification-button')?.focus();
    onOpen(item);
  };
  const markAll = () => {
    setItems(prev => prev.map(item => ({ ...item, read: true })));
    requestAnimationFrame(() =>
      anchor.current?.querySelector('.notification-filters .active')?.focus(),
    );
  };
  return (
    <div className="popover-anchor notification-anchor" ref={anchor}>
      <IconButton
        icon={Bell}
        label="الإشعارات التجريبية"
        className="notification-button"
        aria-keyshortcuts={shortcut}
        aria-expanded={expanded}
        aria-controls="demo-notification-center"
        aria-describedby={unread ? 'notification-unread-count' : undefined}
        onClick={onToggle}
      />
      {unread > 0 && (
        <span
          id="notification-unread-count"
          className="notification-count"
          role="img"
          aria-label={`${ar(unread)} غير مقروء`}
        >
          {ar(unread)}
        </span>
      )}
      {expanded && (
        <div
          id="demo-notification-center"
          className="popover notification-popover"
          role="region"
          aria-label="مركز الإشعارات التجريبي"
        >
          <div className="popover-head">
            <div>
              <strong>مركز الإشعارات</strong>
              <p>عينة محلية · الرسائل تسجّل أحداثًا وليست تحديثات فورية</p>
            </div>
            <Tag color="blue">{ar(unread)} غير مقروء</Tag>
          </div>
          <div className="notification-filters" role="group" aria-label="تصفية الإشعارات">
            {[
              ['all', 'الكل'],
              ['unread', 'غير المقروء'],
              ['pinned', 'المثبتة'],
              ['approval', 'الموافقات'],
              ['incident', 'الحوادث'],
              ['alert', 'التنبيهات'],
            ].map(([id, label]) => (
              <button
                type="button"
                key={id}
                className={filter === id ? 'active' : ''}
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="notification-priority-controls">
            <button
              type="button"
              aria-pressed={priorityFirst}
              onClick={() => setPriorityFirst(v => !v)}
            >
              ترتيب حسب خطورة السجل
            </button>
            <label>
              التجميع{' '}
              <select
                aria-label="تجميع الإشعارات"
                value={groupBy}
                onChange={e => setGroupBy(e.target.value)}
              >
                <option value="none">بدون تجميع</option>
                <option value="incident">حسب الحادثة</option>
                <option value="category">حسب النوع</option>
              </select>
            </label>
            <small>تنظيم محلي، وليس تحليلًا ذكيًا. «الكل» سجل هذه الجلسة.</small>
          </div>
          <div className="notification-list">
            {visible.length ? (
              groups.map(group => (
                <div className="notification-group" key={group.label || 'all'}>
                  {group.label && (
                    <div className="notification-group-title">
                      {group.label} · {ar(group.items.length)}
                    </div>
                  )}
                  {group.items.map(item => (
                    <div
                      className={`notification-entry ${item.read ? 'read' : 'unread'}`}
                      data-read={item.read ? 'true' : 'false'}
                      key={item.id}
                    >
                      <button
                        type="button"
                        className="notification-open"
                        onClick={() => choose(item)}
                      >
                        <span className="notification-item-icon">
                          {item.category === 'approval' ? (
                            <ListChecks size={16} />
                          ) : item.category === 'alert' ? (
                            <BellRing size={16} />
                          ) : (
                            <ShieldAlert size={16} />
                          )}
                        </span>
                        <span>
                          <strong>
                            {item.title}
                            {item.pinned ? ' · مثبت' : ''}
                          </strong>
                          <small>{item.summary}</small>
                          <span className="notification-meta">
                            <small>
                              {item.time}
                              {severity(item) ? ` · ${severity(item)}` : ' · خطورة غير محددة'}
                            </small>
                            <span
                              className={`notification-status ${item.read ? 'is-read' : 'is-unread'}`}
                            >
                              الحالة: {item.read ? 'مقروء' : 'غير مقروء'}
                            </span>
                          </span>
                        </span>
                        <ChevronLeft size={15} />
                      </button>
                      <div className="notification-entry-actions">
                        <button
                          type="button"
                          className="notification-mark"
                          onClick={() => mark(item.id, !item.read, true)}
                          aria-label={`${item.read ? 'تحديد كغير مقروء' : 'تحديد كمقروء'}: ${item.title}`}
                        >
                          {item.read ? 'تحديد كغير مقروء' : 'تحديد كمقروء'}
                        </button>
                        <button
                          type="button"
                          className="notification-pin"
                          aria-label={`${item.pinned ? 'إلغاء تثبيت' : 'تثبيت'} الإشعار: ${item.title}`}
                          aria-pressed={!!item.pinned}
                          onClick={() =>
                            setItems(prev =>
                              prev.map(x => (x.id === item.id ? { ...x, pinned: !x.pinned } : x)),
                            )
                          }
                        >
                          <Pin size={13} />
                          {item.pinned ? 'إلغاء التثبيت' : 'تثبيت'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <div className="notification-empty">لا توجد إشعارات في هذا العرض.</div>
            )}
          </div>
          <button
            type="button"
            className="notification-read-all"
            disabled={!unread}
            onClick={markAll}
          >
            <CheckCheck size={15} /> تمييز الكل كمقروء
          </button>
        </div>
      )}
    </div>
  );
}
