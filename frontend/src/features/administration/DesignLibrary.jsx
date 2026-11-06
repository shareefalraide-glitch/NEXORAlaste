import React, { useState } from 'react';
import { CheckCircle2, CircleHelp, Palette } from 'lucide-react';
import { Button, Status, Tag } from '../../shared/ui/index';

const colors = [
  ['الهوية', '--nx-brand'],
  ['المعلومات', '--nx-blue'],
  ['التحليل', '--nx-purple'],
  ['النجاح', '--nx-green'],
  ['التنبيه', '--nx-orange'],
  ['الخطورة', '--nx-red'],
];
export default function DesignLibrary() {
  const [feedback, setFeedback] = useState('');
  return (
    <section className="design-library" aria-label="مكتبة المكوّنات التجريبية">
      <div className="design-library-heading">
        <span>
          <Palette size={19} />
        </span>
        <div>
          <small>نظام تصميم NEXORA</small>
          <h2>مكتبة المكوّنات</h2>
          <p>عينات حيّة للألوان والأزرار والحالات المشتركة في المظهر الحالي.</p>
        </div>
        <Tag color="blue">معاينة فقط</Tag>
      </div>
      <div className="design-section">
        <h3>الألوان الدلالية</h3>
        <p>اللون يرافقه نص أو رمز؛ ولا يُستخدم وحده لشرح الحالة.</p>
        <div className="design-colors">
          {colors.map(([name, token]) => (
            <div key={token}>
              <i style={{ background: `var(${token})` }} />
              <span>
                <strong>{name}</strong>
                <small dir="ltr">{token}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="design-section">
        <h3>الأزرار وحالة التركيز</h3>
        <p>استخدم لوحة المفاتيح لمعاينة التركيز؛ جميع أزرار هذا القسم تجريبية.</p>
        <div className="design-buttons">
          <Button
            type="button"
            variant="primary"
            icon={CheckCircle2}
            onClick={() => setFeedback('تم الضغط على زر المعاينة فقط.')}
          >
            إجراء أساسي
          </Button>
          <Button
            type="button"
            icon={CircleHelp}
            onClick={() => setFeedback('تم الضغط على الزر الثانوي في المعاينة.')}
          >
            إجراء ثانوي
          </Button>
          <Button type="button" disabled>
            غير متاح
          </Button>
        </div>
        {feedback && (
          <div className="design-feedback" role="status">
            {feedback}
          </div>
        )}
      </div>
      <div className="design-section">
        <h3>شارات الحالة</h3>
        <p>الحالة تُعرض كنص مقروء مع اللون في الوضعين الفاتح والداكن.</p>
        <div className="design-statuses">
          {[
            'جديدة',
            'مسندة',
            'قيد المعالجة',
            'بانتظار الموافقة',
            'تمت الموافقة',
            'أعيد للتعديل',
            'مرفوض',
            'مغلقة',
          ].map(value => (
            <Status key={value} value={value} />
          ))}
        </div>
      </div>
      <div className="design-library-note">
        هذه المكتبة توضح المكوّنات المستخدَمة وليست شهادة امتثال لإمكانية الوصول. راجع{' '}
        <bdi dir="ltr">docs/DESIGN_SYSTEM.md</bdi> للاختبارات والقيود.
      </div>
    </section>
  );
}
