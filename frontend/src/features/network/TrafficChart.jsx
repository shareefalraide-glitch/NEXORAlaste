import React, { memo, useEffect, useId, useMemo, useRef, useState } from 'react';

import { Panel } from '../../shared/ui/index';

import { bucketLabel, netInteger, netRate } from './network-data';
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function curve(values, max, w = 680, h = 142, x0 = 20, y0 = 10) {
  const points = values.map((v, i) => [
    x0 + (values.length === 1 ? 0 : (w * i) / (values.length - 1)),
    y0 + h - (v / max) * h,
  ]);
  return points.slice(1).reduce((path, p, i) => {
    const a = points[i],
      mid = (a[0] + p[0]) / 2;
    return `${path} C ${mid} ${a[1]}, ${mid} ${p[1]}, ${p[0]} ${p[1]}`;
  }, `M ${points[0][0]} ${points[0][1]}`);
}
const ChartCurves = memo(function ChartCurves({ model, uid }) {
  return (
    <g>
      {model.baselinePaths.map((path, j) => (
        <path
          key={`base-${model.lines[j]}`}
          d={path}
          className={`network-baseline-line ${model.lines[j] ? 'out' : 'in'}`}
        />
      ))}
      {model.paths.map((path, j) => (
        <g key={model.lines[j]}>
          <path
            d={`${path} L 700 152 L 20 152 Z`}
            fill={`url(#network-${model.lines[j] ? 'out' : 'in'}-${uid})`}
          />
          <path
            d={path}
            className={`network-chart-line ${model.lines[j] ? 'out' : 'in'} ${model.alerts[j] ? 'is-alert' : ''}`}
          />
        </g>
      ))}
    </g>
  );
});
export const TrafficChart = memo(function TrafficChart({ view, unit }) {
  const [metric, setMetric] = useState('rate'),
    [selected, setSelected] = useState(null),
    [focused, setFocused] = useState(false);
  const plot = useRef(null),
    pointerFrame = useRef(null),
    pendingIndex = useRef(null),
    uid = useId().replace(/:/g, ''),
    points = view.buckets;
  const cancelPointer = () => {
    if (pointerFrame.current !== null) cancelAnimationFrame(pointerFrame.current);
    pointerFrame.current = null;
    pendingIndex.current = null;
  };
  // Do not keep pending frame callbacks when filters change or this page closes.
  useEffect(() => {
    cancelPointer();
    setSelected(null);
  }, [view.period, view.direction, view.scenario]);
  useEffect(() => () => cancelPointer(), []);
  // Path generation is independent from hover selection and unit conversion.
  const model = useMemo(() => {
    const keys = metric === 'rate' ? ['mbpsIn', 'mbpsOut'] : ['ppsIn', 'ppsOut'];
    const baselineKeys = ['baselineMbpsIn', 'baselineMbpsOut'];
    const lines = view.direction === 'both' ? [0, 1] : view.direction === 'in' ? [0] : [1];
    const all = points.flatMap(p =>
      lines.flatMap(k => (metric === 'rate' ? [p[keys[k]], p[baselineKeys[k]]] : [p[keys[k]]])),
    );
    const maxValue = Math.max(...all, 1) * 1.16,
      last = points.at(-1);
    return {
      keys,
      baselineKeys,
      lines,
      maxValue,
      paths: lines.map(k =>
        curve(
          points.map(p => p[keys[k]]),
          maxValue,
        ),
      ),
      baselinePaths:
        metric === 'rate'
          ? lines.map(k =>
              curve(
                points.map(p => p[baselineKeys[k]]),
                maxValue,
              ),
            )
          : [],
      alerts: lines.map(k => metric === 'rate' && (k ? last.alertOut : last.alertIn)),
    };
  }, [view, metric]);
  const { keys, baselineKeys, lines, maxValue, alerts } = model;
  const i = clamp(selected ?? points.length - 1, 0, points.length - 1),
    point = points[i];
  const fmt = v => (metric === 'rate' ? `${netRate(v, unit)} ${unit}` : `${netInteger(v)} PPS`);
  const detail = k => {
    const actual = `${k ? 'صادر' : 'وارد'} ${fmt(point[keys[k]])}`;
    if (metric !== 'rate') return actual;
    return `${actual}، الأساس ${fmt(point[baselineKeys[k]])}، ${(k ? point.alertOut : point.alertIn) ? 'فوق حد المراجعة التجريبي' : 'ضمن الحد التجريبي'}`;
  };
  const desc = `${bucketLabel(point.start, view.period)}: ${lines.map(detail).join('؛ ')}. متوسط الفاصل، بيانات تجريبية.`;
  // Coalesce rapid pointer events into at most one update per animation frame.
  const move = e => {
    const rect = plot.current?.getBoundingClientRect();
    if (!rect?.width) return;
    const local = (((e.clientX - rect.left) / rect.width) * 720 - 20) / 680;
    pendingIndex.current = clamp(Math.round(local * (points.length - 1)), 0, points.length - 1);
    if (pointerFrame.current === null)
      pointerFrame.current = requestAnimationFrame(() => {
        pointerFrame.current = null;
        const next = pendingIndex.current;
        pendingIndex.current = null;
        if (next !== null) setSelected(next);
      });
  };
  const key = e => {
    const next = {
      ArrowRight: i + 1,
      ArrowUp: i + 1,
      ArrowLeft: i - 1,
      ArrowDown: i - 1,
      Home: 0,
      End: points.length - 1,
    };
    if (Object.hasOwn(next, e.key)) {
      e.preventDefault();
      cancelPointer();
      setSelected(clamp(next[e.key], 0, points.length - 1));
    }
  };
  const changeMetric = next => {
    cancelPointer();
    setMetric(next);
    setSelected(null);
  };
  return (
    <Panel className="network-chart-panel">
      <div className="network-panel-heading">
        <div>
          <span className="network-section-kicker">TRAFFIC OVER TIME</span>
          <h2>تطور حركة الشبكة</h2>
          <p>
            {metric === 'rate'
              ? 'متوسط الفواصل؛ الخط المتقطع أساس تجريبي، وليس بثًا مباشرًا.'
              : 'متوسط فواصل الحزم؛ خط الأساس للمقارنة مع النقل فقط.'}
          </p>
        </div>
        <div className="network-switch" role="group" aria-label="نوع رسم الشبكة">
          <button
            type="button"
            aria-pressed={metric === 'rate'}
            onClick={() => changeMetric('rate')}
          >
            النقل
          </button>
          <button
            type="button"
            aria-pressed={metric === 'packets'}
            onClick={() => changeMetric('packets')}
          >
            الحزم
          </button>
        </div>
      </div>
      <div className="network-chart-legend">
        {lines.map((k, j) => (
          <span key={k}>
            <i className={`${k ? 'out' : 'in'} ${alerts[j] ? 'is-alert' : ''}`} />{' '}
            {k ? 'صادر' : 'وارد'}
          </span>
        ))}
        {metric === 'rate' && (
          <span>
            <i className="baseline" /> خط أساس تجريبي
          </span>
        )}
        <small>
          المقياس: <bdi dir="ltr">{metric === 'rate' ? unit : 'PPS'}</bdi>
        </small>
      </div>
      <div className="network-chart-wrap" dir="ltr">
        <div className="network-chart-axis" aria-hidden="true">
          {[1, 0.5, 0].map(f => (
            <span key={f}>
              {metric === 'rate' ? netRate(maxValue * f, unit) : netInteger(maxValue * f)}
            </span>
          ))}
        </div>
        <div className="network-chart-body">
          <div
            className="network-plot"
            ref={plot}
            role="slider"
            tabIndex={0}
            aria-label="استكشاف فترات حركة الشبكة، استخدم مفاتيح الأسهم"
            aria-valuemin={1}
            aria-valuemax={points.length}
            aria-valuenow={i + 1}
            aria-valuetext={desc}
            onKeyDown={key}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onPointerDown={move}
            onPointerMove={move}
          >
            <svg viewBox="0 0 720 165" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id={`network-in-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="var(--nx-brand)" stopOpacity=".24" />
                  <stop offset="1" stopColor="var(--nx-brand)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id={`network-out-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="var(--nx-blue)" stopOpacity=".13" />
                  <stop offset="1" stopColor="var(--nx-blue)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3].map(j => (
                <line
                  key={j}
                  x1="20"
                  x2="700"
                  y1={10 + (j * 142) / 3}
                  y2={10 + (j * 142) / 3}
                  className="network-chart-grid"
                />
              ))}
              <ChartCurves model={model} uid={uid} />
              <line
                x1={20 + (680 * i) / (points.length - 1)}
                x2={20 + (680 * i) / (points.length - 1)}
                y1="10"
                y2="152"
                className={`network-chart-cursor ${focused ? 'focused' : ''}`}
              />
              {lines.map((k, j) => (
                <circle
                  key={k}
                  cx={20 + (680 * i) / (points.length - 1)}
                  cy={10 + 142 - (points[i][keys[k]] / maxValue) * 142}
                  r="4"
                  className={`network-chart-dot ${k ? 'out' : 'in'} ${alerts[j] ? 'is-alert' : ''}`}
                />
              ))}
            </svg>
          </div>
          <div className="network-chart-ticks" aria-hidden="true">
            <span>{bucketLabel(points[0].start, view.period)}</span>
            <span>
              {bucketLabel(points[Math.floor((points.length - 1) / 2)].start, view.period)}
            </span>
            <span>{bucketLabel(points.at(-1).start, view.period)}</span>
          </div>
        </div>
      </div>
      <div className="network-chart-selection">
        <span>
          الفاصل المحدد <bdi dir="ltr">{bucketLabel(point.start, view.period)}</bdi>
        </span>
        {lines.map((k, j) => (
          <strong key={k}>
            <i className={`${k ? 'out' : 'in'} ${alerts[j] ? 'is-alert' : ''}`} />
            {k ? 'صادر' : 'وارد'} <bdi dir="ltr">{fmt(point[keys[k]])}</bdi>
          </strong>
        ))}
        <small>حرّك المؤشر أو استخدم الأسهم</small>
        {metric === 'rate' && (
          <div className="network-selection-baseline">
            {lines.map(k => (
              <span key={k}>
                أساس {k ? 'الصادر' : 'الوارد'}: <bdi dir="ltr">{fmt(point[baselineKeys[k]])}</bdi> ·{' '}
                {(k ? point.alertOut : point.alertIn) ? 'فوق الحد' : 'ضمن الحد'}
              </span>
            ))}
          </div>
        )}
      </div>
      {metric === 'rate' && (
        <p className="network-chart-explainer">
          اللون الأحمر يعبّر عن تجاوز حد المراجعة في آخر فاصل من العينة؛ الأوقات بداية الفاصل.
        </p>
      )}
    </Panel>
  );
});
