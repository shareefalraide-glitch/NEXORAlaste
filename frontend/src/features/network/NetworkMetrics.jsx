import React, { memo } from 'react';
import { Activity, CircleAlert, ShieldCheck } from 'lucide-react';
import { Panel } from '../../shared/ui/index';

import { NETWORK_BASELINE, netInteger } from './network-data';
export const directionNames = { both: 'الوارد والصادر', in: 'الوارد', out: 'الصادر' };
export const NetMetric = memo(function NetMetric({
  id,
  icon: Icon,
  title,
  value,
  unit,
  note,
  tone = 'cyan',
  raw,
}) {
  return (
    <article className={`network-metric ${tone}`} data-testid={`network-${id}`} data-value={raw}>
      <div className="network-metric-head">
        <span>{title}</span>
        <i>
          <Icon size={17} />
        </i>
      </div>
      <div className="network-metric-value">
        <bdi dir="ltr">{value}</bdi>
        {unit && <small dir="ltr">{unit}</small>}
      </div>
      <p>{note}</p>
    </article>
  );
});
export const ScenarioPanel = memo(function ScenarioPanel({ view, scenario, onScenario }) {
  const last = view.buckets.at(-1);
  const elevated =
    view.direction === 'in'
      ? last.alertIn
      : view.direction === 'out'
        ? last.alertOut
        : last.alertIn || last.alertOut;
  return (
    <section
      className={`network-baseline-demo ${elevated ? 'is-alert' : ''}`}
      aria-label="محاكاة خط أساس الشبكة"
    >
      <span className="network-baseline-icon">
        <Activity size={20} />
      </span>
      <div className="network-baseline-copy">
        <span>BASELINE / UI SIMULATION</span>
        <h2>مقارنة بخط أساس تجريبي</h2>
        <p>
          مرجع من العينة العادية السابقة، وحد مراجعة أعلى منه بـ
          {netInteger(Math.round((NETWORK_BASELINE.alertFactor - 1) * 100))}٪. لا يكشف هذا المثال
          هجومًا.
        </p>
      </div>
      <div className="network-baseline-side">
        <div
          className={`network-baseline-status ${elevated ? 'is-alert' : ''}`}
          role="status"
          aria-live="polite"
          data-testid="network-baseline-status"
          data-state={elevated ? 'alert' : 'normal'}
        >
          <i />
          <span>
            <strong>{elevated ? 'انحراف تجريبي' : 'ضمن الحد التجريبي'}</strong>
            <small>النقل في آخر فاصل · {directionNames[view.direction]}</small>
          </span>
        </div>
        <div className="network-scenario-switch" role="group" aria-label="سيناريو عينة الشبكة">
          <button
            type="button"
            aria-pressed={scenario === 'normal'}
            onClick={() => onScenario('normal')}
          >
            العينة العادية
          </button>
          <button
            type="button"
            aria-pressed={scenario === 'spike'}
            onClick={() => onScenario('spike')}
          >
            محاكاة ارتفاع
          </button>
        </div>
      </div>
      {scenario === 'spike' && (
        <p className="network-scenario-note">
          محاكاة محلية ترفع النقل والحزم في آخر ١٢ ساعة من العينة؛ لا تغيّر الاتصالات أو المناطق ولا
          تتصل بشبكة.
        </p>
      )}
    </section>
  );
});
export const SessionBreakdown = memo(function SessionBreakdown({ view }) {
  const completePercent = view.attempts ? (view.completed / view.attempts) * 100 : 0;
  return (
    <Panel className="network-session-panel">
      <div className="network-panel-heading">
        <div>
          <span className="network-section-kicker">TCP SESSIONS</span>
          <h2>تفاصيل المصافحة</h2>
          <p>محاولات TCP الممثّلة خلال الفترة واتجاهها.</p>
        </div>
        <span className="network-heading-icon">
          <ShieldCheck size={19} />
        </span>
      </div>
      <div
        className="network-session-progress"
        role="img"
        aria-label={`المكتملة ${netInteger(view.completed)}، وغير المكتملة ${netInteger(view.incomplete)} من ${netInteger(view.attempts)} محاولة تجريبية`}
        dir="ltr"
      >
        <span style={{ width: `${completePercent}%` }} />
        <i style={{ width: `${100 - completePercent}%` }} />
      </div>
      <div className="network-session-items">
        <div>
          <span>
            <i className="ok" /> مكتملة
          </span>
          <strong>{netInteger(view.completed)}</strong>
        </div>
        <div>
          <span>
            <i className="warn" /> غير مكتملة
          </span>
          <strong>{netInteger(view.incomplete)}</strong>
        </div>
        <div>
          <span>
            منها إعادة ضبط <bdi dir="ltr">RST</bdi>
          </span>
          <strong>{netInteger(view.resets)}</strong>
        </div>
        <div>
          <span>بقية غير المكتملة</span>
          <strong>{netInteger(view.unresolved)}</strong>
        </div>
      </div>
      <p className="network-insight">
        <CircleAlert size={16} />
        <span>
          عدم اكتمال المصافحة أو إعادة ضبطها لا يثبت هجومًا؛ قد تغيب حزم عن نقطة الرصد أو يكون
          الإغلاق متوقعًا.
        </span>
      </p>
    </Panel>
  );
});
