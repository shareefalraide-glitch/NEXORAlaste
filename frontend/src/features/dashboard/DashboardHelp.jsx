import React from 'react';
import { ArrowLeft, BookOpen, CircleHelp, Compass, RotateCcw, X } from 'lucide-react';
import { ar, Button } from '../../shared/ui/index';
import { guideChapters, guideSteps } from '../guide/guide-data';

export function GettingStarted({ guide, setGuide, startGuide }) {
  if (!guide.visible) return null;
  const count = guide.visited.length,
    total = guideSteps.length;
  const action = guide.finished ? 'إعادة الجولة' : count ? 'استئناف الجولة' : 'ابدأ الجولة';
  return (
    <section className="start-guide" aria-label="الدليل التعليمي التفاعلي">
      <div className="start-guide-head">
        <span className="guide-icon">
          <Compass size={21} />
        </span>
        <div className="guide-intro">
          <span className="guide-kicker">دليلك داخل المنصة · اختياري</span>
          <h2>تعرّف على NEXORA خطوة بخطوة</h2>
          <p>جولة تفاعلية تبرز الأدوات وتنقلك بين الأقسام وتشرح كيفية استكشاف بيانات العينة.</p>
        </div>
        <div className="guide-top-actions">
          <Button variant="primary" icon={BookOpen} onClick={() => startGuide('resume')}>
            {action}
          </Button>
          <button
            type="button"
            className="guide-dismiss"
            aria-label="إخفاء بطاقة الدليل"
            title="إخفاء البطاقة"
            onClick={() => setGuide(s => ({ ...s, visible: false }))}
          >
            <X size={17} />
          </button>
        </div>
      </div>
      <div className="guide-chapters" role="group" aria-label="محاور الدليل">
        {guideChapters.map((chapter, index) => (
          <span key={chapter.id}>
            <i>{ar(index + 1)}</i>
            {chapter.title}
          </span>
        ))}
      </div>
      <div className="guide-progress-head">
        <strong>الخطوات التي زرتها</strong>
        <span>
          {ar(count)} من {ar(total)}
        </span>
        {count > 0 && !guide.finished && (
          <button type="button" onClick={() => startGuide('restart')}>
            <RotateCcw size={13} /> ابدأ من جديد
          </button>
        )}
      </div>
      <div
        className="guide-progress"
        role="progressbar"
        aria-label="تقدم زيارة خطوات الدليل"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={count}
      >
        <span style={{ width: `${(count / total) * 100}%` }} />
      </div>
      <p className="guide-note">
        الجولة لا تغيّر السجلات. يُحفظ تقدمها في هذا المتصفح إذا سمح بالتخزين؛ وإلا يبقى حتى
        التحديث. قد تُصفّر مرشحات العرض عند الانتقال.
      </p>
    </section>
  );
}
export function MetricDefinitions({
  period,
  eventTotal,
  alertTotal,
  incidentCount,
  assetCount,
  order,
}) {
  const periodLabel =
    period === '1h' ? 'آخر ساعة' : period === '24h' ? 'آخر ٢٤ ساعة' : 'آخر ٧ أيام';
  const definitions = [
    {
      id: 'events',
      title: 'الأحداث المحلَّلة',
      text: `${ar(eventTotal)} إجمالي توضيحي لـ${periodLabel}، من مجموع فواصل الرسم الثابتة؛ سجل الأحداث المفصّل عينة أصغر، وليس قياسًا حقيقيًا.`,
    },
    {
      id: 'alerts',
      title: 'التنبيهات المرصودة',
      text: `${ar(alertTotal)} إجمالي توضيحي لـ${periodLabel}، من مجموع فواصل الرسم وتوزيع الخطورة؛ التنبيهات المفصّلة عينة أصغر.`,
    },
    {
      id: 'incidents',
      title: 'الحوادث المفتوحة',
      text: `${ar(incidentCount)} حوادث غير مغلقة وغير مصنفة إنذارًا كاذبًا في السجلات المحلية؛ لا يتغير هذا العدد بتغيير الفترة.`,
    },
    {
      id: 'assets',
      title: 'الأصول في العينة',
      text: `${ar(assetCount)} أصل ضمن السجلات المحلية، بما فيها الأصول قيد التأسيس؛ لا يتغير هذا العدد بتغيير الفترة.`,
    },
  ];
  return (
    <div className="metric-definitions" role="group" aria-label="تعريف مؤشرات لوحة المعلومات">
      {(order
        ? order.map(id => definitions.find(def => def.id === id)).filter(Boolean)
        : definitions
      ).map(def => (
        <details key={def.id}>
          <summary>
            <CircleHelp size={14} />
            <span>تعريف {def.title}</span>
          </summary>
          <p>{def.text}</p>
        </details>
      ))}
    </div>
  );
}
