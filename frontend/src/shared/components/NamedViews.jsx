import React, { useState } from 'react';
import { Bookmark, RotateCcw, Trash2 } from 'lucide-react';
import { ar } from '../ui/index';
import { useSessionValue } from '../hooks/session-state';

const keyFor = scope => `nexora-ui-named-views-v1:${scope}`;
function read(scope) {
  try {
    const parsed = JSON.parse(localStorage.getItem(keyFor(scope)) || '[]');
    return Array.isArray(parsed)
      ? parsed
          .filter(
            x =>
              x &&
              typeof x.name === 'string' &&
              x.name.length <= 40 &&
              x.value &&
              typeof x.value === 'object',
          )
          .slice(0, 8)
      : [];
  } catch {
    return [];
  }
}

// Only explicitly passed presentation options are persisted. The free-text
// search, record identifiers, notes, evidence and incident data are excluded.
export default function NamedViews({ scope, current, onApply, presets = [], sessionRef }) {
  const label =
    {
      alerts: 'التنبيهات',
      incidents: 'الحوادث',
      events: 'الأحداث',
      assets: 'الأصول',
      overview: 'اللوحة',
    }[scope] || scope;
  const [views, setViews] = useSessionValue(sessionRef, `named:${scope}`, 'items', () =>
    read(scope),
  );
  const [name, setName] = useState(''),
    [selected, setSelected] = useState(''),
    [message, setMessage] = useState('');
  const update = next => {
    setViews(next);
    try {
      localStorage.setItem(keyFor(scope), JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  };
  const save = () => {
    const value = name.trim();
    if (!value) {
      setMessage('اكتب اسمًا للعرض دون معلومات حساسة.');
      return;
    }
    if (views.some(v => v.name.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      setMessage('هذا الاسم مستخدم؛ اختر اسمًا آخر أو احذف العرض السابق.');
      return;
    }
    if (views.length >= 8) {
      setMessage('يمكن حفظ حتى ٨ عروض في هذا القسم.');
      return;
    }
    const item = {
      id: `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: value,
      value: current,
    };
    const persisted = update([...views, item]);
    setSelected(item.id);
    setName('');
    setMessage(
      persisted
        ? 'حُفظت خيارات العرض على هذا المتصفح.'
        : 'التخزين غير متاح؛ حُفظ العرض لهذه الجلسة فقط.',
    );
  };
  const apply = () => {
    const item = views.find(x => x.id === selected);
    if (item) {
      onApply(item.value);
      setMessage(`استُعيد عرض «${item.name}».`);
    }
  };
  const remove = () => {
    const item = views.find(x => x.id === selected);
    if (!item) return;
    const persisted = update(views.filter(x => x.id !== selected));
    setSelected('');
    setMessage(persisted ? 'حُذف العرض المحفوظ.' : 'حُذف العرض من الجلسة.');
  };
  return (
    <details className="named-views">
      <summary>
        <Bookmark size={15} />
        <span>العروض المحفوظة والقوالب</span>
        <small>{ar(views.length)} محفوظة</small>
      </summary>
      <div className="named-views-body">
        {presets.length > 0 && (
          <div className="named-presets">
            <strong>قوالب سريعة</strong>
            <div>
              {presets.map(p => (
                <button
                  type="button"
                  key={p.name}
                  onClick={() => {
                    onApply(p.value);
                    setMessage(`طُبق قالب «${p.name}».`);
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="named-save-row">
          <label>
            اسم العرض{' '}
            <input
              value={name}
              maxLength={40}
              onChange={e => setName(e.target.value)}
              placeholder="اسم غير حساس"
              aria-label={`اسم عرض ${label}`}
            />
          </label>
          <button type="button" onClick={save}>
            <Bookmark size={14} /> حفظ العرض
          </button>
        </div>
        {views.length > 0 && (
          <div className="named-load-row">
            <label>
              العرض المحفوظ{' '}
              <select
                value={selected}
                onChange={e => setSelected(e.target.value)}
                aria-label={`العروض المحفوظة ${label}`}
              >
                <option value="">اختر عرضًا</option>
                {views.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" disabled={!selected} onClick={apply}>
              <RotateCcw size={14} /> تطبيق
            </button>
            <button type="button" disabled={!selected} onClick={remove}>
              <Trash2 size={14} /> حذف
            </button>
          </div>
        )}
        <p>
          يحفظ الاسم وخيارات العرض فقط على هذا الجهاز عند السماح؛ لا يُحفظ نص البحث أو المستخدم أو
          عناوين السجلات. لا تضع بيانات حساسة في الاسم.
        </p>
        <span className="named-views-message" role="status" aria-live="polite">
          {message}
        </span>
      </div>
    </details>
  );
}
