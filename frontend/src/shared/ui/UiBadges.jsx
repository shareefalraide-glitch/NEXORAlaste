import React from 'react';
import { ArrowUpLeft, Check } from 'lucide-react';

const severityStyle = { حرجة: 'critical', عالية: 'high', متوسطة: 'medium', منخفضة: 'low' };
export function Severity({ value }) {
  return (
    <span className={`badge severity ${severityStyle[value] || 'neutral'}`}>
      <i />
      {value}
    </span>
  );
}
const statusStyle = {
  جديدة: 'blue',
  جديد: 'blue',
  مسندة: 'purple',
  'قيد المعالجة': 'amber',
  'قيد المراجعة': 'amber',
  محتواة: 'cyan',
  معالجة: 'green',
  مغلقة: 'muted',
  'تمت المراجعة': 'green',
  'إنذار كاذب': 'muted',
  نشط: 'green',
  'غير نشط': 'muted',
  متصل: 'green',
  'قيد التأسيس': 'amber',
  مكتمل: 'green',
  'بانتظار الموافقة': 'amber',
  'تمت الموافقة': 'green',
  مرفوض: 'critical',
  'أعيد للتعديل': 'amber',
  'لم يُطلب': 'muted',
  ناجح: 'green',
  فشل: 'critical',
};
export function Status({ value }) {
  return (
    <span className={`badge status ${statusStyle[value] || 'muted'}`}>
      <i />
      {value}
    </span>
  );
}
export function Tag({ children, color = 'neutral' }) {
  return <span className={`tag ${color}`}>{children}</span>;
}
export function Avatar({ name = 'أحمد علي', small = false, tone = 'blue' }) {
  let a =
    name === 'غير مسندة'
      ? '—'
      : name
          .split(' ')
          .map(x => x[0])
          .slice(0, 2)
          .join('');
  return (
    <span
      className={`avatar avatar-${tone} ${small ? 'avatar-sm' : ''}`}
      role="img"
      aria-label={name}
    >
      {a}
    </span>
  );
}
export function StatCard({
  title,
  value,
  caption,
  icon: Icon,
  tone = 'blue',
  trend,
  small = false,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`stat-card stat-${tone} ${small ? 'stat-small' : ''}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <div className="stat-top">
        <span className="stat-label">{title}</span>
        <span className="stat-icon">
          <Icon size={19} strokeWidth={1.8} />
        </span>
      </div>
      <div className="stat-number">{value}</div>
      <div className="stat-caption">
        {trend && (
          <span className="trend">
            <ArrowUpLeft size={12} />
            {trend}
          </span>
        )}
        {caption}
      </div>
    </button>
  );
}
export function RiskBar({ value, tone = 'blue', suffix = true }) {
  return (
    <div className="risk-row">
      <div className="progress">
        <span className={tone} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
      </div>
      {suffix && (
        <span className="risk-percent" dir="ltr">
          {Math.round(value * 100)}%
        </span>
      )}
    </div>
  );
}
export function CheckLine({ children }) {
  return (
    <div className="check-line">
      <Check size={15} />
      <span>{children}</span>
    </div>
  );
}
