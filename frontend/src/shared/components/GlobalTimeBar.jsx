import React from 'react';
import { Clock3, Info, Layers3 } from 'lucide-react';
import { PERIOD_LABELS } from '../lib/time-scope';

export default function GlobalTimeBar({ value, onChange }) {
  return (
    <section className="global-time-bar" aria-label="النطاق الزمني العام التجريبي">
      <div className="global-time-label">
        <span className="global-time-icon">
          <Clock3 size={17} />
        </span>
        <div>
          <strong>النطاق الزمني العام</strong>
          <small>
            نهاية العينة: <bdi dir="ltr">29 OCT 2026 · 10:00 UTC+03</bdi>
          </small>
        </div>
      </div>
      <label className="global-time-select">
        <span className="sr-only">اختر الفترة العامة للعينة</span>
        <select
          aria-label="الفترة العامة للعينة"
          value={value}
          onChange={event => onChange(event.target.value)}
        >
          {Object.entries(PERIOD_LABELS).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <details className="global-session-help">
        <summary>
          <Layers3 size={15} /> تعديلات مؤقتة
        </summary>
        <div>
          التحقيق والمساعد والمسودات تبقى في الذاكرة وتُمسح عند تحديث الصفحة أو الخروج. تفضيلات
          الواجهة فقط قد تُحفظ محليًا عند السماح. لا تُدخل معلومات حساسة.
        </div>
      </details>
      <details className="global-time-help">
        <summary>
          <Info size={15} /> ما الذي يتأثر؟
        </summary>
        <div>
          تتبع الفترة رسوم النشاط، وتحليل الشبكة، وأوقات إنشاء الحوادث والتنبيهات، والأحداث والبحث.
          السجلات ذات الوقت غير المتاح تبقى ظاهرة ومعلّمة؛ الأصول والمصادر والحالات الحالية لقطات
          ثابتة. إجماليات النظرة العامة عينة مستقلة عن السجلات المفصّلة. الفلاتر المحلية تضيق النطاق
          ولا تعيد ضبط الفترة العامة.
        </div>
      </details>
    </section>
  );
}
