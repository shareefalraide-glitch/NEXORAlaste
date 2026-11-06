import React, { useState } from 'react';
import { ArrowLeft, Columns3 } from 'lucide-react';
import { ar, Tag } from '../ui/index';

const fields = {
  incident: [
    ['severity', 'الخطورة'],
    ['status', 'المرحلة'],
    ['score', 'الدرجة التوضيحية'],
    ['asset', 'الأصل المرتبط'],
    ['owner', 'المسؤول'],
    ['alerts', 'عدد التنبيهات'],
  ],
  asset: [
    ['type', 'النوع'],
    ['criticality', 'الأهمية'],
    ['baseline', 'حالة خط الأساس'],
    ['owner', 'المالك'],
    ['alerts', 'عدد التنبيهات'],
    ['ip', 'عنوان العينة'],
  ],
};
export default function RecordComparison({ kind, records, openDetail }) {
  const [leftId, setLeft] = useState(records[0]?.id || ''),
    [rightId, setRight] = useState(records[1]?.id || records[0]?.id || '');
  const left = records.find(r => r.id === leftId),
    right = records.find(r => r.id === rightId),
    title = kind === 'incident' ? 'الحوادث' : 'الأصول';
  const label = r => (kind === 'incident' ? `${r.id} · ${r.title}` : `${r.name} · ${r.id}`);
  const value = (r, key) =>
    r?.[key] === null || r?.[key] === undefined || r?.[key] === '' ? 'غير متاح' : String(r[key]);
  return (
    <details className="record-comparison">
      <summary>
        <span>
          <Columns3 size={18} />
          <span>
            <strong>مقارنة {title}</strong>
            <small>اختيار سجلين وعرض الفروقات في العينة</small>
          </span>
        </span>
        <Tag color="blue">مقارنة محلية</Tag>
      </summary>
      <div className="record-comparison-body">
        <p>مقارنة وصفية للحقول المتاحة فقط؛ ليست تحليلًا آليًا أو حكمًا على المخاطر.</p>
        <div className="compare-selectors">
          <label>
            السجل الأول
            <select
              aria-label={`السجل الأول في مقارنة ${title}`}
              value={leftId}
              onChange={e => setLeft(e.target.value)}
            >
              {records.map(r => (
                <option key={r.id} value={r.id}>
                  {label(r)}
                </option>
              ))}
            </select>
          </label>
          <label>
            السجل الثاني
            <select
              aria-label={`السجل الثاني في مقارنة ${title}`}
              value={rightId}
              onChange={e => setRight(e.target.value)}
            >
              {records.map(r => (
                <option key={r.id} value={r.id}>
                  {label(r)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {left && right ? (
          <>
            <div
              className="comparison-fields"
              role="group"
              aria-label={`الحقول المقارنة في ${title}`}
            >
              {fields[kind].map(([key, name]) => {
                const a = value(left, key),
                  b = value(right, key),
                  different = a !== b;
                return (
                  <div key={key} className={different ? 'is-different' : ''}>
                    <strong>{name}</strong>
                    <span dir="auto">{a}</span>
                    <span dir="auto">{b}</span>
                    {different && <small>مختلف</small>}
                  </div>
                );
              })}
            </div>
            <div className="comparison-actions">
              <button type="button" onClick={() => openDetail(kind, left.id)}>
                فتح السجل الأول <ArrowLeft size={14} />
              </button>
              <button type="button" onClick={() => openDetail(kind, right.id)}>
                فتح السجل الثاني <ArrowLeft size={14} />
              </button>
              <small>
                {ar(fields[kind].filter(([key]) => value(left, key) !== value(right, key)).length)}{' '}
                حقول مختلفة
              </small>
            </div>
          </>
        ) : (
          <p>لا تتوفر سجلات كافية للمقارنة.</p>
        )}
      </div>
    </details>
  );
}
