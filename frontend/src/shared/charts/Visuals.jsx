import React, { useEffect, useId, useRef, useState } from 'react';
import { ar } from '../ui/index';
import { overviewSeries } from './visual-data';

const WIDTH = 720,
  HEIGHT = 150;
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const cx = (index, n) => (WIDTH * (index + 0.5)) / n;
function smoothPath(values, max) {
  const points = values.map((v, i) => [cx(i, values.length), HEIGHT - (v / max) * HEIGHT]);
  return points.slice(1).reduce((path, p, i) => {
    const prev = points[i],
      middle = (prev[0] + p[0]) / 2;
    return `${path} C ${middle} ${prev[1]}, ${middle} ${p[1]}, ${p[0]} ${p[1]}`;
  }, `M ${points[0][0]} ${points[0][1]}`);
}

/** الرسم يعتمد على مجموعات تجريبية ثابتة؛ الأعمدة لها مقياس مستقل. */
export function ActivityChart({ period = '24h' }) {
  const { points, axisMax, periodName } = overviewSeries[period];
  const [selected, setSelected] = useState(points.length - 1);
  const [hovered, setHovered] = useState(false),
    [focused, setFocused] = useState(false);
  const plot = useRef(null),
    uid = useId().replace(/:/g, '');
  useEffect(() => {
    setSelected(points.length - 1);
    setHovered(false);
  }, [period, points.length]);
  const index = clamp(selected, 0, points.length - 1),
    point = points[index];
  const path = smoothPath(
    points.map(x => x.events),
    axisMax,
  );
  const area = `${path} L ${cx(points.length - 1, points.length)} ${HEIGHT} L ${cx(0, points.length)} ${HEIGHT} Z`;
  const maxAlerts = Math.max(...points.map(x => x.alerts), 1);
  const move = e => {
    const box = plot.current?.getBoundingClientRect();
    if (!box || !box.width) return;
    setSelected(
      clamp(Math.floor(((e.clientX - box.left) / box.width) * points.length), 0, points.length - 1),
    );
  };
  const key = e => {
    const actions = {
      ArrowRight: index + 1,
      ArrowUp: index + 1,
      ArrowLeft: index - 1,
      ArrowDown: index - 1,
      Home: 0,
      End: points.length - 1,
    };
    if (Object.hasOwn(actions, e.key)) {
      e.preventDefault();
      setSelected(clamp(actions[e.key], 0, points.length - 1));
    }
  };
  return (
    <div className="viz-activity" dir="ltr">
      <div className="viz-chart-header" dir="rtl">
        <span>
          <i className="viz-dot event" />
          الأحداث <small>منحنى</small>
        </span>
        <span>
          <i className="viz-dot alert" />
          التنبيهات <small>أعمدة بمقياس مستقل</small>
        </span>
        <span className="viz-period">{periodName} · عينة توضيحية</span>
      </div>
      <div className="viz-activity-layout">
        <div className="viz-y-axis" aria-hidden="true">
          {[axisMax, (axisMax * 2) / 3, axisMax / 3, 0].map(x => (
            <span key={x}>{ar(x)}</span>
          ))}
        </div>
        <div
          className="viz-plot-interactive"
          ref={plot}
          role="slider"
          tabIndex={0}
          aria-label="استكشاف فترات الرسم، استخدم مفاتيح الأسهم"
          aria-valuemin={1}
          aria-valuemax={points.length}
          aria-valuenow={index + 1}
          aria-valuetext={`${point.label}: ${ar(point.events)} حدث و${ar(point.alerts)} تنبيه، بيانات توضيحية`}
          onKeyDown={key}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onPointerEnter={e => {
            setHovered(true);
            move(e);
          }}
          onPointerMove={move}
          onPointerDown={e => {
            setHovered(true);
            move(e);
          }}
          onPointerLeave={e => {
            if (e.pointerType !== 'touch') setHovered(false);
          }}
          onPointerCancel={() => setHovered(false)}
        >
          <div className="viz-main-plot">
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="var(--nx-chart-cyan)" stopOpacity=".23" />
                  <stop offset="1" stopColor="var(--nx-chart-cyan)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id={`line-${uid}`}>
                  <stop stopColor="var(--nx-chart-cyan)" />
                  <stop offset="1" stopColor="var(--nx-chart-blue)" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3].map(i => (
                <line
                  key={i}
                  x1="0"
                  x2={WIDTH}
                  y1={(HEIGHT * i) / 3}
                  y2={(HEIGHT * i) / 3}
                  stroke="var(--nx-line2)"
                  strokeDasharray="3 7"
                />
              ))}
              <path d={area} fill={`url(#area-${uid})`} className="viz-area" />
              <path
                d={path}
                fill="none"
                stroke={`url(#line-${uid})`}
                strokeWidth="2.6"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                className="viz-line"
              />
              {points.map((p, i) => (
                <circle
                  key={p.label}
                  cx={cx(i, points.length)}
                  cy={HEIGHT - (p.events / axisMax) * HEIGHT}
                  r={i === index && (hovered || focused) ? 5 : 2.3}
                  className={`viz-point ${i === index && (hovered || focused) ? 'active' : ''}`}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {(hovered || focused) && (
                <line
                  x1={cx(index, points.length)}
                  x2={cx(index, points.length)}
                  y1="0"
                  y2={HEIGHT}
                  className="viz-crosshair"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
            {(hovered || focused) && (
              <div
                className={`viz-tooltip ${index < 2 ? 'start' : ''} ${index >= points.length - 2 ? 'end' : ''}`}
                style={{ left: `${((index + 0.5) / points.length) * 100}%` }}
                dir="rtl"
                aria-hidden="true"
              >
                <bdi dir="auto" className="viz-tooltip-time">
                  {point.label}
                </bdi>
                <span>
                  <i className="viz-dot event" />
                  الأحداث <strong>{ar(point.events)}</strong>
                </span>
                <span>
                  <i className="viz-dot alert" />
                  التنبيهات <strong>{ar(point.alerts)}</strong>
                </span>
              </div>
            )}
          </div>
          <div
            className="viz-alert-track"
            aria-hidden="true"
            style={{ gridTemplateColumns: `repeat(${points.length},minmax(0,1fr))` }}
          >
            {points.map((p, i) => (
              <div key={p.label} className={i === index && (hovered || focused) ? 'active' : ''}>
                <span style={{ height: `${Math.max(5, (p.alerts / maxAlerts) * 100)}%` }} />
              </div>
            ))}
          </div>
          <div
            className="viz-x-axis"
            aria-hidden="true"
            style={{ gridTemplateColumns: `repeat(${points.length},minmax(0,1fr))` }}
          >
            {points.map((p, i) => (
              <span key={p.label}>{period === '7d' || i % 2 === 0 ? p.short : ''}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="viz-chart-caption" dir="rtl">
        <span>إجماليات افتراضية؛ السجلات المفصّلة عينة محدودة.</span>
        <span>المس أو مرّر أو استخدم الأسهم للاستكشاف</span>
      </div>
    </div>
  );
}

const severityLabels = ['حرجة', 'عالية', 'متوسطة'];
const severityColors = ['var(--nx-chart-red)', 'var(--nx-chart-orange)', 'var(--nx-chart-yellow)'];
export function SeverityDonut({ counts }) {
  const [chosen, setChosen] = useState(null),
    [focus, setFocus] = useState(null);
  const active = focus ?? chosen,
    total = counts.reduce((s, v) => s + v, 0),
    radius = 45,
    circumference = 2 * Math.PI * radius;
  useEffect(() => {
    setChosen(null);
    setFocus(null);
  }, [counts.join(',')]);
  let offset = 0;
  const segments = counts.map(value => {
    const length = total ? (circumference * value) / total : 0;
    const segment = { length: Math.max(0, length - 3), offset };
    offset += length;
    return segment;
  });
  const summary = counts.map((n, i) => `${severityLabels[i]} ${ar(n)}`).join('، ');
  return (
    <div className="viz-donut-layout">
      <div className="viz-donut-wrap">
        <div
          className="viz-donut"
          role="img"
          aria-label={`توزيع التنبيهات: ${summary}؛ الإجمالي ${ar(total)}. بيانات توضيحية.`}
        >
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="var(--nx-bg4)"
              strokeWidth="10"
            />
            {segments.map((segment, i) => (
              <circle
                key={severityLabels[i]}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                className={`viz-donut-segment ${active === i ? 'selected' : ''} ${active !== null && active !== i ? 'dim' : ''}`}
                stroke={severityColors[i]}
                strokeWidth={active === i ? 12 : 10}
                strokeDasharray={`${segment.length} ${circumference - segment.length}`}
                strokeDashoffset={-segment.offset}
                onPointerEnter={() => setFocus(i)}
                onPointerLeave={() => setFocus(null)}
                onClick={() => setChosen(chosen === i ? null : i)}
              />
            ))}
          </svg>
          <div className="viz-donut-center" aria-hidden="true">
            <strong>{ar(active === null ? total : counts[active])}</strong>
            <span>{active === null ? 'إجمالي التنبيهات' : severityLabels[active]}</span>
          </div>
        </div>
      </div>
      <div className="viz-donut-legend" role="group" aria-label="تمييز مستوى الخطورة">
        {counts.map((value, i) => (
          <button
            type="button"
            key={severityLabels[i]}
            className={active === i ? 'active' : ''}
            aria-pressed={chosen === i}
            onFocus={() => setFocus(i)}
            onBlur={() => setFocus(null)}
            onMouseEnter={() => setFocus(i)}
            onMouseLeave={() => setFocus(null)}
            onClick={() => setChosen(chosen === i ? null : i)}
          >
            <span>
              <i className={`viz-dot sev-${i}`} />
              {severityLabels[i]}
            </span>
            <strong>
              {ar(value)}{' '}
              <small>
                <bdi dir="ltr">{ar(total ? Math.round((value / total) * 100) : 0)}٪</bdi>
              </small>
            </strong>
          </button>
        ))}
        <small className="viz-legend-note">اختر مستوى لتمييزه</small>
      </div>
    </div>
  );
}

/** شريط مقسّم محايد؛ مجموع الأجزاء مرتبط بالبيانات المرسلة للمكوّن. */
export function StackedBar({ segments, label, max, className = '' }) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value || 0), 0);
  const denominator = max ?? total;
  const description = segments.map(s => `${s.label}: ${s.display ?? ar(s.value)}`).join('، ');
  return (
    <div
      className={`viz-stack ${className}`}
      role="img"
      aria-label={`${label}: ${description}`}
      dir="ltr"
    >
      {denominator > 0 &&
        segments.map((s, i) => (
          <span
            key={`${s.label}-${i}`}
            style={{
              width: `${clamp((Math.max(0, s.value || 0) / denominator) * 100, 0, 100)}%`,
              background: s.color,
            }}
          />
        ))}
    </div>
  );
}

/** زخرفة هندسية فقط وليست خريطة شبكة فعلية. */
export function ModelGraphic() {
  return (
    <div className="model-graphic" aria-hidden="true">
      <svg viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="62" className="model-ring outer" />
        <circle cx="80" cy="80" r="45" className="model-ring" />
        <path
          d="M38 78L57 49 89 40 119 59 126 91 100 116 69 122 39 102Z M57 49L80 80 38 78 M89 40L80 80 119 59 M126 91L80 80 100 116 M69 122L80 80 39 102"
          className="model-links"
        />
        <g className="model-nodes">
          <circle cx="38" cy="78" r="3" />
          <circle cx="57" cy="49" r="3" />
          <circle cx="89" cy="40" r="3" />
          <circle cx="119" cy="59" r="3" />
          <circle cx="126" cy="91" r="3" />
          <circle cx="100" cy="116" r="3" />
          <circle cx="69" cy="122" r="3" />
          <circle cx="39" cy="102" r="3" />
          <circle cx="80" cy="80" r="5" />
        </g>
      </svg>
    </div>
  );
}

export function BaselineSummary({ assets, compact = false }) {
  const ready = assets.filter(x => x.baseline === 'مكتمل').length,
    pending = assets.filter(x => x.baseline === 'قيد التأسيس').length;
  const other = assets.length - ready - pending;
  const segments = [
    { label: 'مكتمل', value: ready, color: 'var(--nx-green)' },
    { label: 'قيد التأسيس', value: pending, color: 'var(--nx-yellow)' },
  ];
  if (other) segments.push({ label: 'غير محدد', value: other, color: 'var(--nx-tx3)' });
  return (
    <div className={`viz-baseline ${compact ? 'compact' : ''}`}>
      <div className="viz-summary-head">
        <div>
          <strong>{compact ? 'توزيع الأصول' : 'حالة خطوط الأساس'}</strong>
          <small>نسبة الأصول حسب الحالة في العينة</small>
        </div>
        <b>
          {ar(ready)} <small>من {ar(assets.length)} مكتمل</small>
        </b>
      </div>
      <StackedBar segments={segments} label="توزيع الأصول حسب حالة خط الأساس" />
      <div className="viz-summary-legend">
        {segments.map(s => (
          <span key={s.label}>
            <i className="viz-dot" style={{ background: s.color }} />
            {s.label} <strong>{ar(s.value)}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}
