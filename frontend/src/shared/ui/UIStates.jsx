import React, { useState } from 'react';
import {
  AlertTriangle,
  Inbox,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldOff,
  WifiOff,
} from 'lucide-react';

const variants = {
  loading: {
    title: 'جارٍ تحميل البيانات',
    text: 'تُعرض هذه الحالة أثناء انتظار البيانات في التصميم.',
    icon: LoaderCircle,
    action: null,
  },
  empty: {
    title: 'لا توجد نتائج مطابقة',
    text: 'جرّب تغيير كلمات البحث أو خيارات التصفية.',
    icon: Inbox,
    action: null,
  },
  offline: {
    title: 'تعذّر الاتصال',
    text: 'يمكن متابعة القراءة فقط حتى يعود الاتصال في النظام الحقيقي.',
    icon: WifiOff,
    action: 'إعادة المحاولة',
  },
  error: {
    title: 'تعذّر إكمال الطلب',
    text: 'حدث خطأ أثناء معالجة الطلب في هذا المثال. حاول مجددًا.',
    icon: AlertTriangle,
    action: 'إعادة المحاولة',
  },
  session: {
    title: 'انتهت الجلسة',
    text: 'يلزم تسجيل الدخول مجددًا عند تطبيق نظام الجلسات الفعلي.',
    icon: KeyRound,
    action: 'تسجيل الدخول',
  },
  permission: {
    title: 'لا تملك صلاحية الوصول',
    text: 'اطلب من مدير النظام مراجعة صلاحيتك عند ربط التفويض الفعلي.',
    icon: ShieldOff,
    action: 'عرض التفاصيل',
  },
};
export function StateMessage({
  variant = 'empty',
  title,
  text,
  compact = false,
  preview = false,
  onAction,
}) {
  const info = variants[variant] || variants.empty,
    Icon = info.icon;
  return (
    <div
      className={`state-message state-${variant} ${compact ? 'state-compact' : ''}`}
      role={variant === 'loading' ? 'status' : undefined}
    >
      <span className="state-message-icon">
        <Icon size={compact ? 23 : 25} className={variant === 'loading' ? 'state-spinner' : ''} />
      </span>
      <strong>{title || info.title}</strong>
      <p>{text || info.text}</p>
      {preview && info.action && (
        <button type="button" onClick={onAction}>
          {variant === 'error' || variant === 'offline' ? <RefreshCw size={15} /> : null}
          {info.action}
        </button>
      )}
    </div>
  );
}
export function StatesShowcase() {
  const [selected, setSelected] = useState('loading'),
    [feedback, setFeedback] = useState('');
  const options = [
    ['loading', 'التحميل'],
    ['empty', 'لا توجد نتائج'],
    ['offline', 'انقطاع الاتصال'],
    ['error', 'خطأ'],
    ['session', 'انتهاء الجلسة'],
    ['permission', 'عدم وجود صلاحية'],
  ];
  return (
    <section className="states-showcase" aria-label="معاينة حالات الواجهة">
      <div className="states-heading">
        <div>
          <span>مكتبة حالات موحّدة</span>
          <h2>معاينة حالات الواجهة</h2>
          <p>اختر حالة لرؤية الرسالة والإجراء المقترح بتصميم متّسق.</p>
        </div>
        <small>معاينة فقط</small>
      </div>
      <div className="state-options" role="group" aria-label="اختر حالة لمعاينتها">
        {options.map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={selected === id ? 'active' : ''}
            aria-pressed={selected === id}
            onClick={() => {
              setSelected(id);
              setFeedback('');
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="state-preview">
        <StateMessage
          variant={selected}
          preview
          onAction={() => setFeedback('هذا الزر للمعاينة فقط؛ لم يُنفّذ طلب أو تغيير جلسة.')}
        />
      </div>
      <p className="states-disclaimer">
        جميع الحالات هنا معاينات ثابتة؛ لا تختبر اتصالًا ولا تنهي جلسة أو تتحقق من صلاحيات حقيقية.
        يمكن تشغيل محاكاة الانقطاع من الإعدادات العامة.
      </p>
      {feedback && (
        <p className="states-feedback" role="status">
          {feedback}
        </p>
      )}
    </section>
  );
}
