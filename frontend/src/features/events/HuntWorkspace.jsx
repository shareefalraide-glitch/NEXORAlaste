import React, { useMemo, useState } from 'react';
import { ArrowLeft, Copy, Crosshair, Plus, Save, Search, Trash2 } from 'lucide-react';
import { events } from '../../data/fixtures/demo-records';
import { inPeriod, PERIOD_LABELS } from '../../shared/lib/time-scope';
import { ar, Button, Tag } from '../../shared/ui/index';

const fields = [
  ['src', 'عنوان المصدر'],
  ['dst', 'عنوان الوجهة'],
  ['port', 'منفذ الوجهة'],
  ['protocol', 'بروتوكول النقل'],
  ['user', 'المستخدم'],
  ['category', 'نوع الحدث'],
  ['outcome', 'النتيجة'],
];
const operators = [
  ['equals', 'يساوي'],
  ['contains', 'يحتوي'],
  ['not', 'لا يساوي'],
];
const normalize = value =>
  String(value ?? '')
    .trim()
    .toLocaleLowerCase();
function match(event, condition) {
  const actual = normalize(event[condition.field]),
    needle = normalize(condition.value);
  if (!needle) return true;
  return condition.op === 'equals'
    ? actual === needle
    : condition.op === 'not'
      ? actual !== needle
      : actual.includes(needle);
}
const blank = () => [
  { field: 'port', op: 'equals', value: '443' },
  { field: 'user', op: 'contains', value: '' },
];
const presets = {
  authentication: {
    hypothesis: 'قد تستحق محاولات المصادقة الفاشلة مراجعة.',
    conditions: [
      { field: 'category', op: 'equals', value: 'مصادقة' },
      { field: 'outcome', op: 'equals', value: 'فشل' },
    ],
  },
  dns: {
    hypothesis: 'قد تحتاج استعلامات DNS في العينة إلى مراجعة سياقها.',
    conditions: [
      { field: 'category', op: 'equals', value: 'استعلام DNS' },
      { field: 'user', op: 'contains', value: '' },
    ],
  },
  port: { hypothesis: 'قد تستحق الأحداث على منفذ 443 مراجعة.', conditions: blank() },
};
export default function HuntWorkspace({ openDetail, timeRange = '24h' }) {
  const [conditions, setConditions] = useState(blank),
    [mode, setMode] = useState('all'),
    [hypothesis, setHypothesis] = useState(''),
    [saved, setSaved] = useState(null),
    [copyMessage, setCopyMessage] = useState('');
  const active = conditions.filter(x => x.value.trim());
  const results = useMemo(
    () =>
      events.filter(
        event =>
          inPeriod(event, 'event', timeRange) &&
          (!active.length ||
            (mode === 'all'
              ? active.every(c => match(event, c))
              : active.some(c => match(event, c)))),
      ),
    [conditions, mode, timeRange],
  );
  const set = (i, key, value) =>
    setConditions(current => current.map((c, n) => (n === i ? { ...c, [key]: value } : c)));
  const applyPreset = id => {
    const preset = presets[id];
    setConditions(preset.conditions.map(c => ({ ...c })));
    setHypothesis(preset.hypothesis);
    setMode('all');
  };
  const query =
    `فرضية غير مثبتة: ${hypothesis.trim() || 'غير محددة'}\n${mode === 'all' ? 'كل الشروط' : 'أي شرط'} · ${PERIOD_LABELS[timeRange]}\n` +
    (active.length
      ? active
          .map(
            c =>
              `${fields.find(f => f[0] === c.field)?.[1]} ${operators.find(o => o[0] === c.op)?.[1]}: ${c.value}`,
          )
          .join('\n')
      : 'دون شروط إضافية');
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw Error('unavailable');
      await navigator.clipboard.writeText(query);
      setCopyMessage('نُسخ نص الاستعلام إلى الحافظة.');
    } catch {
      setCopyMessage('النسخ المباشر غير متاح هنا؛ اختر النص وانسخه يدويًا.');
    }
  };
  return (
    <details className="hunt-workspace">
      <summary>
        <span>
          <span className="hunt-icon">
            <Crosshair size={19} />
          </span>
          <span>
            <strong>مساحة صيد التهديدات</strong>
            <small>فرضية وشروط ونتائج قابلة للمراجعة في العينة</small>
          </span>
        </span>
        <Tag color="blue">بحث محلي</Tag>
      </summary>
      <div className="hunt-body">
        <div className="hunt-notice">
          النتائج بحث محلي في السجلات الوصفية التجريبية؛ لا توجد لغة استعلام أو مراقبة خارجية.
          الفرضية ليست نتيجة مثبتة، وقيم البروتوكول أمثلة وليست تحليل حزم.
        </div>
        <label className="hunt-hypothesis">
          فرضية البحث · اختيارية
          <textarea
            aria-label="فرضية الصيد غير المثبتة"
            value={hypothesis}
            maxLength={240}
            rows="2"
            onChange={e => setHypothesis(e.target.value)}
            placeholder="اكتب فرضية توضيحية غير حساسة، ثم اختبر السجلات المتاحة..."
          />
        </label>
        <div className="hunt-presets">
          <span>ابدأ بمثال:</span>
          <button type="button" onClick={() => applyPreset('authentication')}>
            مصادقة فاشلة
          </button>
          <button type="button" onClick={() => applyPreset('dns')}>
            استعلامات DNS
          </button>
          <button type="button" onClick={() => applyPreset('port')}>
            منفذ 443
          </button>
        </div>
        <div className="hunt-conditions">
          {conditions.map((c, i) => (
            <div className="hunt-condition" key={i}>
              <label>
                الحقل {ar(i + 1)}
                <select
                  aria-label={`حقل الشرط ${ar(i + 1)}`}
                  value={c.field}
                  onChange={e => set(i, 'field', e.target.value)}
                >
                  {fields.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                المقارنة
                <select
                  aria-label={`مقارنة الشرط ${ar(i + 1)}`}
                  value={c.op}
                  onChange={e => set(i, 'op', e.target.value)}
                >
                  {operators.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                القيمة
                <input
                  aria-label={`قيمة الشرط ${ar(i + 1)}`}
                  dir="auto"
                  value={c.value}
                  maxLength={100}
                  onChange={e => set(i, 'value', e.target.value)}
                  placeholder="مثال: 443"
                />
              </label>
              {conditions.length > 1 && (
                <button
                  type="button"
                  className="hunt-remove"
                  aria-label={`حذف الشرط ${ar(i + 1)}`}
                  onClick={() =>
                    setConditions(current => current.filter((_, index) => index !== i))
                  }
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="hunt-controls">
          <label>
            مطابقة{' '}
            <select
              aria-label="طريقة مطابقة الشروط"
              value={mode}
              onChange={e => setMode(e.target.value)}
            >
              <option value="all">كل الشروط AND</option>
              <option value="any">أي شرط OR</option>
            </select>
          </label>
          <Button
            type="button"
            icon={Plus}
            disabled={conditions.length >= 4}
            onClick={() =>
              setConditions(current => [...current, { field: 'src', op: 'contains', value: '' }])
            }
          >
            إضافة شرط
          </Button>
          <Button
            type="button"
            icon={Save}
            onClick={() =>
              setSaved({ conditions: conditions.map(c => ({ ...c })), mode, hypothesis })
            }
          >
            حفظ مؤقت
          </Button>
          <Button
            type="button"
            disabled={!saved}
            onClick={() => {
              setConditions(saved.conditions.map(c => ({ ...c })));
              setMode(saved.mode);
              setHypothesis(saved.hypothesis);
            }}
          >
            استعادة
          </Button>
          <small>حتى ٤ شروط؛ الحفظ في ذاكرة هذه الصفحة فقط.</small>
        </div>
        <div className="hunt-result-head">
          <div>
            <Search size={16} />
            <strong>
              {ar(results.length)} نتيجة ضمن {PERIOD_LABELS[timeRange]}
            </strong>
          </div>
          <span>الشروط المحلية تضيق الفترة العامة</span>
        </div>
        {results.length ? (
          <div className="hunt-results">
            {results.map(e => (
              <button type="button" key={e.id} onClick={() => openDetail('event', e.id)}>
                <span>
                  <strong>
                    {e.category} · {e.outcome}
                  </strong>
                  <small>
                    <bdi dir="ltr">
                      {e.id} · {e.src} → {e.dst}:{e.port} · {e.protocol}
                    </bdi>{' '}
                    · مصدر العينة <bdi dir="ltr">{e.sourceId || 'غير متاح'}</bdi>
                  </small>
                </span>
                <ArrowLeft size={15} />
              </button>
            ))}
          </div>
        ) : (
          <p className="detail-muted">
            لا توجد أحداث مطابقة للشروط في هذه العينة؛ غيّر الشروط أو الفترة.
          </p>
        )}
        <details className="hunt-share">
          <summary>نص الاستعلام للمشاركة اليدوية</summary>
          <label>
            <span className="sr-only">نص الاستعلام</span>
            <textarea
              aria-label="نص الاستعلام التجريبي"
              value={query}
              readOnly
              rows="4"
              onFocus={e => e.target.select()}
            />
          </label>
          <Button type="button" icon={Copy} onClick={copy}>
            نسخ النص
          </Button>
          <span role="status" aria-live="polite">
            {copyMessage}
          </span>
        </details>
      </div>
    </details>
  );
}
