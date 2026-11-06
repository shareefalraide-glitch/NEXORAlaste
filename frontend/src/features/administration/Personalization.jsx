import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Keyboard, LayoutDashboard, RotateCcw } from 'lucide-react';
import { Button, InfoBox, PanelHeading, Tag } from '../../shared/ui/index';
import {
  bindingFromEvent,
  defaultMetricOrder,
  defaultShortcuts,
  equalBindings,
  formatBinding,
  metricLabels,
  roleNames,
  shortcutActions,
} from '../../shared/lib/preferences';

export function ShortcutPreferences({ preferences, setPreferences }) {
  const [editing, setEditing] = useState(''),
    [message, setMessage] = useState('');
  const inputRef = useRef(null);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);
  const focusEdit = id =>
    requestAnimationFrame(() => document.querySelector(`[data-shortcut-edit="${id}"]`)?.focus());
  const cancel = id => {
    setEditing('');
    setMessage('');
    focusEdit(id);
  };
  const change = (event, id) => {
    if (event.key === 'Tab') {
      setEditing('');
      setMessage('');
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancel(id);
      return;
    }
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat || event.isComposing) return;
    const binding = bindingFromEvent(event.nativeEvent);
    if (!binding) {
      setMessage(
        'اختصار غير متاح أو معروف التعارض؛ استخدم Alt أو Ctrl أو ⌘ مع حرف أو رقم مختلف، دون Ctrl+Alt أو Alt+Shift.',
      );
      return;
    }
    const duplicate = shortcutActions.find(
      action => action.id !== id && equalBindings(preferences.shortcuts[action.id], binding),
    );
    if (duplicate) {
      setMessage(`هذا الاختصار مستخدم بالفعل: ${duplicate.label}. اختر اختصارًا آخر.`);
      return;
    }
    setPreferences(prev => ({ ...prev, shortcuts: { ...prev.shortcuts, [id]: binding } }));
    setMessage('');
    setEditing('');
    focusEdit(id);
  };
  return (
    <>
      <PanelHeading
        title="اختصارات لوحة المفاتيح"
        subtitle="خصص الاختصارات أو عطّلها على هذا المتصفح"
        icon={Keyboard}
      />
      <div className="personalization-body">
        <div className="preference-intro">
          <span>
            <Keyboard size={17} />
          </span>
          <div>
            <strong>تحكم أسرع بما يناسبك</strong>
            <p>
              تعمل الاختصارات خارج عناصر الإدخال والنوافذ المنبثقة؛ يمكن فتح البحث فوق تفاصيل السجل.
              انقر داخل الواجهة قبل استخدامها في المعاينة.
            </p>
          </div>
          <Tag color="blue">محلي</Tag>
        </div>
        <div className="shortcut-list">
          {shortcutActions.map(action => {
            const binding = preferences.shortcuts[action.id];
            return (
              <div className="shortcut-row" key={action.id}>
                <div>
                  <strong>{action.label}</strong>
                  <small>{action.description}</small>
                </div>
                {editing === action.id ? (
                  <div className="shortcut-capture">
                    <input
                      ref={inputRef}
                      aria-label={`إدخال اختصار ${action.label}`}
                      readOnly
                      value="اضغط مجموعة المفاتيح الآن"
                      onKeyDown={event => change(event, action.id)}
                      onBlur={() => {
                        setEditing('');
                        setMessage('');
                      }}
                    />
                    <button
                      type="button"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => cancel(action.id)}
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <div className="shortcut-actions">
                    <kbd dir="ltr">{formatBinding(binding)}</kbd>
                    <button
                      type="button"
                      data-shortcut-edit={action.id}
                      onClick={() => {
                        setMessage('');
                        setEditing(action.id);
                      }}
                      aria-label={`${binding ? 'تغيير' : 'تخصيص'} اختصار ${action.label}`}
                    >
                      {binding ? 'تغيير' : 'تخصيص'}
                    </button>
                    {binding && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreferences(prev => ({
                            ...prev,
                            shortcuts: { ...prev.shortcuts, [action.id]: null },
                          }))
                        }
                        aria-label={`تعطيل اختصار ${action.label}`}
                      >
                        تعطيل
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {message && (
          <p className="preference-warning" role="alert">
            {message}
          </p>
        )}
        <InfoBox tone="amber" title="تعارضات معروفة">
          نمنع الاختصارات الشائعة للمتصفح مثل Ctrl/⌘ + K أو L أو T أو W، وAlt + D، واختصارات النظام
          الشائعة. لا يمكن اكتشاف كل اختصارات النظام أو الإضافات؛ وقد تُحجز قبل وصولها للواجهة.
        </InfoBox>
        <div className="preference-actions">
          <Button
            type="button"
            icon={RotateCcw}
            onClick={() => {
              setEditing('');
              setMessage('');
              setPreferences(prev => ({ ...prev, shortcuts: defaultShortcuts() }));
            }}
          >
            استعادة الاختصارات الافتراضية
          </Button>
          <small>تُحفظ تفضيلات الواجهة فقط محليًا إذا سمح المتصفح، وإلا تبقى لهذه الجلسة.</small>
        </div>
      </div>
    </>
  );
}

export function LayoutPreferences({ preferences, setPreferences }) {
  const [role, setRole] = useState(roleNames[0]),
    [announcement, setAnnouncement] = useState('');
  const order = preferences.layouts[role] || defaultMetricOrder;
  const move = (id, delta) => {
    const index = order.indexOf(id),
      next = index + delta;
    if (next < 0 || next >= order.length) return;
    const rearranged = [...order];
    [rearranged[index], rearranged[next]] = [rearranged[next], rearranged[index]];
    setPreferences(prev => ({ ...prev, layouts: { ...prev.layouts, [role]: rearranged } }));
    setAnnouncement(
      `أصبح ${metricLabels[id]} في الموضع ${next + 1} من ${order.length} لدور ${role}.`,
    );
    requestAnimationFrame(() => {
      const row = document.querySelector(`[data-metric-order="${id}"]`);
      (
        row?.querySelector(`button[data-move="${delta}"]:not([disabled])`) ||
        row?.querySelector('button:not([disabled])')
      )?.focus();
    });
  };
  return (
    <>
      <PanelHeading
        title="تخصيص الواجهة"
        subtitle="كثافة العرض وترتيب مؤشرات لوحة الدور"
        icon={LayoutDashboard}
      />
      <div className="personalization-body">
        <fieldset className="density-picker">
          <legend>كثافة عرض البيانات</legend>
          <label>
            <input
              type="radio"
              name="density"
              checked={preferences.density === 'comfortable'}
              onChange={() => setPreferences(prev => ({ ...prev, density: 'comfortable' }))}
            />
            <span>
              <strong>مريحة</strong>
              <small>مساحات أكبر للقراءة.</small>
            </span>
          </label>
          <label>
            <input
              type="radio"
              name="density"
              checked={preferences.density === 'compact'}
              onChange={() => setPreferences(prev => ({ ...prev, density: 'compact' }))}
            />
            <span>
              <strong>مضغوطة</strong>
              <small>صفوف ومساحات أقل دون تصغير الأزرار.</small>
            </span>
          </label>
        </fieldset>
        <div className="layout-order-head">
          <div>
            <strong>ترتيب بطاقات ملخص النشاط</strong>
            <small>لكل دور ترتيب مستقل في المعاينة؛ لا يغيّر الدور حسابًا أو صلاحيات.</small>
          </div>
          <label>
            الدور{' '}
            <select
              aria-label="دور ترتيب لوحة المعلومات"
              value={role}
              onChange={e => {
                setRole(e.target.value);
                setAnnouncement('');
              }}
            >
              {roleNames.map(x => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <ol className="layout-order">
          {order.map((id, index) => (
            <li key={id} data-metric-order={id}>
              <span>
                <b>{index + 1}</b>
                <strong>{metricLabels[id]}</strong>
              </span>
              <div>
                <button
                  type="button"
                  data-move="-1"
                  disabled={index === 0}
                  onClick={() => move(id, -1)}
                  aria-label={`رفع ${metricLabels[id]}`}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  data-move="1"
                  disabled={index === order.length - 1}
                  onClick={() => move(id, 1)}
                  aria-label={`خفض ${metricLabels[id]}`}
                >
                  <ArrowDown size={16} />
                </button>
              </div>
            </li>
          ))}
        </ol>
        <span className="sr-only" role="status" aria-live="polite">
          {announcement}
        </span>
        <div className="preference-actions">
          <Button
            type="button"
            icon={RotateCcw}
            onClick={() =>
              setPreferences(prev => ({
                ...prev,
                layouts: { ...prev.layouts, [role]: [...defaultMetricOrder] },
              }))
            }
          >
            استعادة ترتيب هذا الدور
          </Button>
          <small>
            التغييرات فورية وتُحفظ في هذا المتصفح إن سمح بالتخزين، دون مزامنة أو بيانات حساسة.
          </small>
        </div>
      </div>
    </>
  );
}
