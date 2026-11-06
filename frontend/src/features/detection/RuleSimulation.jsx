import React, { useState } from 'react';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { events } from '../../data/fixtures/demo-records';
import { inPeriod, PERIOD_LABELS } from '../../shared/lib/time-scope';
import { ar, Button, InfoBox, Tag } from '../../shared/ui/index';

const fields = [
  ['category', 'نوع الحدث'],
  ['port', 'منفذ الوجهة'],
  ['protocol', 'بروتوكول النقل'],
  ['outcome', 'نتيجة الحدث'],
  ['user', 'المستخدم'],
];
const defaults = {
  'RULE-001': { field: 'category', value: 'مصادقة' },
  'RULE-002': { field: 'category', value: 'DNS' },
  'RULE-003': { field: 'category', value: 'تدفق شبكة' },
  'RULE-004': { field: 'category', value: 'فحص منافذ' },
  'RULE-005': { field: 'category', value: 'تسجيل دخول' },
  'RULE-006': { field: 'category', value: 'اتصال شبكة' },
};
export default function RuleSimulation({ rule, timeRange, close, openDetail }) {
  const [field, setField] = useState(defaults[rule.id]?.field || 'category'),
    [value, setValue] = useState(defaults[rule.id]?.value || ''),
    [result, setResult] = useState(null);
  const run = () => {
    const needle = value.trim().toLocaleLowerCase();
    if (!needle) return;
    setResult(
      events.filter(
        e =>
          inPeriod(e, 'event', timeRange) &&
          String(e[field] ?? '')
            .toLocaleLowerCase()
            .includes(needle),
      ),
    );
  };
  return (
    <div className="rule-simulation">
      <p className="modal-lead">
        محاكاة شرط مبسّط بجوار القاعدة <bdi dir="ltr">{rule.id}</bdi>، على أحداث وصفية من{' '}
        {PERIOD_LABELS[timeRange]}.
      </p>
      <InfoBox>
        هذا الشرط مستقل عن نص القاعدة ولا يشغّل Sigma أو Suricata؛ لا تُعد نتائجه اختبارًا حقيقيًا
        للتغطية أو فعالية الكشف.
      </InfoBox>
      <div className="simulation-controls">
        <label>
          حقل العينة
          <select
            aria-label="حقل محاكاة القاعدة"
            value={field}
            onChange={e => {
              setField(e.target.value);
              setResult(null);
            }}
          >
            {fields.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          يحتوي على
          <input
            aria-label="قيمة محاكاة القاعدة"
            value={value}
            maxLength={100}
            onChange={e => {
              setValue(e.target.value);
              setResult(null);
            }}
          />
        </label>
      </div>
      <div className="modal-actions">
        <Button
          type="button"
          icon={FlaskConical}
          variant="primary"
          disabled={!value.trim()}
          onClick={run}
        >
          تشغيل المعاينة
        </Button>
      </div>
      {result && (
        <section className="simulation-result" role="status">
          <strong>{ar(result.length)} حدث مطابق للشرط المبسّط</strong>
          <small>نتيجة بحث توضيحية فقط · القاعدة غير مختبرة فعليًا</small>
          {result.map(e => (
            <button
              type="button"
              key={e.id}
              onClick={() => {
                close();
                openDetail('event', e.id);
              }}
            >
              <span>
                <bdi dir="ltr">{e.id}</bdi> · {e.category} · {e.outcome}
              </span>
              <ArrowLeft size={14} />
            </button>
          ))}
          {!result.length && <p>لا توجد نتائج مطابقة في الفترة المختارة.</p>}
        </section>
      )}
    </div>
  );
}
