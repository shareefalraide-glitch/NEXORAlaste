import { useLandmarkScope } from '../../../shared/hooks/landmark-scope';
import React from 'react';
import { ArrowLeft, ChevronLeft, FileSearch, GitBranch, Sparkles } from 'lucide-react';
import { ar, pct, RiskBar, Tag } from '../../../shared/ui/index';

import { StackedBar } from '../../../shared/charts/Visuals';

export function DetailGrid({ items }) {
  return (
    <div className="detail-grid">
      {items.map(([k, v], i) => (
        <div key={i}>
          <span>{k}</span>
          <strong>{v}</strong>
        </div>
      ))}
    </div>
  );
}
export const detailTypes = {
  incident: 'حادثة',
  alert: 'تنبيه',
  event: 'حدث',
  asset: 'أصل',
  source: 'مصدر',
  rule: 'قاعدة كشف',
  audit: 'قيد تدقيق',
  entity: 'كيان',
};
export function InvestigationTrail({ history, onBack, onJump }) {
  const landmark = useLandmarkScope();
  if (!history?.length) return null;
  return (
    <nav className="investigation-trail" aria-label={landmark('مسار التحقيق التجريبي')}>
      <div className="investigation-trail-head">
        <strong>
          <GitBranch size={15} /> مسار التحقيق
        </strong>
        {history.length > 1 && (
          <button type="button" onClick={onBack}>
            <ArrowLeft size={15} /> العودة للسجل السابق
          </button>
        )}
      </div>
      <div className="investigation-crumbs">
        {history.map((h, i) => (
          <React.Fragment key={h.key || `${h.kind}-${h.id}-${i}`}>
            {i > 0 && <ChevronLeft size={12} aria-hidden="true" />}
            <button
              type="button"
              aria-current={i === history.length - 1 ? 'location' : undefined}
              disabled={i === history.length - 1}
              onClick={() => onJump(i)}
            >
              <span>{detailTypes[h.kind] || 'سجل'}</span> <bdi dir="ltr">{h.id}</bdi>
            </button>
          </React.Fragment>
        ))}
      </div>
      <small>انتقل بين السجلات المترابطة في العينة ثم عد إلى الموضع السابق.</small>
    </nav>
  );
}
export function RelatedRecords({ title, items, kind, openDetail, empty }) {
  return (
    <div className="investigation-related">
      <div className="detail-section-title">
        <span>
          <GitBranch size={16} /> {title}
        </span>
        <Tag>{ar(items.length)}</Tag>
      </div>
      {items.length ? (
        <div className="related-list">
          {items.map(item => (
            <button
              type="button"
              className="related-row"
              key={item.id}
              onClick={() => openDetail(kind, item.id)}
            >
              <span className="incident-icon blue">
                <FileSearch size={16} />
              </span>
              <span>
                <strong>{item.title || item.category || item.name || item.id}</strong>
                <small dir="ltr">{item.id}</small>
              </span>
              <ChevronLeft size={16} />
            </button>
          ))}
        </div>
      ) : (
        <p className="detail-muted">{empty || 'لا توجد سجلات مرتبطة متاحة في العينة.'}</p>
      )}
    </div>
  );
}
export function Timeline({ items }) {
  return (
    <div className="timeline">
      {items?.map((e, i) => (
        <div className="timeline-item" key={`${e.title}-${i}`}>
          <div className="timeline-dot" />
          <div className="timeline-content">
            <div>
              <strong>{e.title}</strong>
              <time dir="ltr">{e.time}</time>
            </div>
            <p>{e.detail}</p>
            <small>{e.actor}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
export function RiskExplanation({ item, baseline }) {
  const parts = [
    ['شدّة القاعدة', item.rule, 0.45, 'blue'],
    ['الشذوذ السلوكي', item.anomaly, 0.35, 'purple'],
    ['أهمية الأصل', item.assetScore, 0.12, 'cyan'],
    ['تكرار المصدر', item.frequency, 0.08, 'amber'],
  ];
  const computed = parts.reduce((s, [, v, w]) => s + (Number(v) || 0) * w, 0);
  const palette = {
    blue: 'var(--nx-blue)',
    purple: 'var(--nx-purple)',
    cyan: 'var(--nx-brand)',
    amber: 'var(--nx-orange)',
  };
  const contributions = parts.map(([label, value, weight, tone]) => ({
    label,
    value: (Number(value) || 0) * weight,
    color: palette[tone],
    display: ((Number(value) || 0) * weight).toFixed(3),
  }));
  return (
    <div className="risk-explanation">
      <div className="detail-section-title">
        <span>
          <Sparkles size={16} /> لماذا هذه الدرجة؟
        </span>
        <strong dir="ltr">{item.score.toFixed(2)} / 1.00</strong>
      </div>
      <p>الدرجة المدمجة تجمع إشارات الكشف وسياق الأصل، وفق الأوزان المقترحة في التقرير.</p>
      <div className="viz-risk-total">
        <div>
          <strong>المساهمات الموزونة</strong>
          <span>الجزء الفارغ حتى الحد الأقصى ١٫٠٠</span>
          <b dir="ltr">{computed.toFixed(2)} / 1.00</b>
        </div>
        <StackedBar
          segments={contributions}
          max={1}
          label="المساهمة الموزونة لمكوّنات درجة الخطورة"
        />
        <small>كل جزء = قيمة المكوّن × وزنه؛ الأرقام في المعادلة أدناه.</small>
      </div>
      {parts.map(([name, value, weight, color]) => (
        <div className="risk-component" key={name}>
          <div>
            <span>
              <i className="viz-dot" style={{ background: palette[color] }} /> {name}{' '}
              <small>الوزن {pct(weight)}</small>
            </span>
            <b dir="ltr">
              {baseline === 'قيد التأسيس' && name === 'الشذوذ السلوكي'
                ? 'غير متاحة'
                : (value ?? 0).toFixed(2)}
            </b>
          </div>
          <RiskBar value={value || 0} tone={color} suffix={false} />
        </div>
      ))}
      <div className="formula" dir="ltr">
        0.45 × {item.rule.toFixed(2)} + 0.35 × {item.anomaly.toFixed(2)} + 0.12 ×{' '}
        {item.assetScore.toFixed(2)} + 0.08 × {item.frequency.toFixed(2)} = {computed.toFixed(2)}
      </div>
      {baseline === 'قيد التأسيس' && (
        <div className="inline-note">
          الأصل قيد التأسيس: لا تُعرض درجة شذوذ تشغيلية، ومساهمة الشذوذ صفر في هذا المثال.
        </div>
      )}
    </div>
  );
}
