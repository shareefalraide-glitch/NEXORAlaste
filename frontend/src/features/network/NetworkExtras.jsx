import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  GitCompareArrows,
  Network,
  Pause,
  Play,
  RotateCcw,
  Server,
  Shield,
} from 'lucide-react';
import { Button, Tag } from '../../shared/ui/index';
import { bucketLabel, netNumber, netRate, previousNetworkView } from './network-data';

function Replay({ view, unit }) {
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    last = view.buckets.length - 1;
  useEffect(() => {
    setPlaying(false);
    setIndex(0);
  }, [view.period, view.direction, view.scenario]);
  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setIndex(i => Math.min(i + 1, last)), 900);
    return () => clearInterval(id);
  }, [playing, last]);
  useEffect(() => {
    if (index >= last) setPlaying(false);
  }, [index, last]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  const p = view.buckets[index],
    rate =
      view.direction === 'in'
        ? p.mbpsIn
        : view.direction === 'out'
          ? p.mbpsOut
          : p.mbpsIn + p.mbpsOut;
  const toggle = () => {
    if (!playing && index >= last) setIndex(0);
    setPlaying(!playing);
  };
  return (
    <div className="network-replay">
      <div className="replay-top">
        <div>
          <span>الفاصل المحدد</span>
          <strong dir="ltr">{bucketLabel(p.start, view.period)}</strong>
        </div>
        <div>
          <span>متوسط النقل</span>
          <strong dir="ltr">
            {netRate(rate, unit)} {unit}
          </strong>
        </div>
        <div>
          <span>التقدم</span>
          <strong>
            {netNumber(index + 1)} / {netNumber(view.buckets.length)}
          </strong>
        </div>
      </div>
      <label>
        <span>تنقّل بين فواصل العينة</span>
        <input
          type="range"
          min="0"
          max={last}
          value={index}
          onChange={e => {
            setPlaying(false);
            setIndex(Number(e.target.value));
          }}
          aria-label="موضع إعادة عرض عينة الشبكة"
          aria-valuetext={`الفاصل ${index + 1}، ${bucketLabel(p.start, view.period)}، ${netRate(rate, unit)} ${unit}`}
        />
      </label>
      <div className="replay-actions">
        <Button type="button" icon={playing ? Pause : Play} onClick={toggle}>
          {playing ? 'إيقاف مؤقت' : 'تشغيل الفواصل'}
        </Button>
        <Button
          type="button"
          icon={RotateCcw}
          onClick={() => {
            setPlaying(false);
            setIndex(0);
          }}
        >
          البداية
        </Button>
        <small>عرض فواصل مجمّعة اصطناعية؛ ليس تشغيل حزم أو أحداث حقيقية.</small>
      </div>
    </div>
  );
}

function Topology({ data, openDetail }) {
  const boxes = [
    { id: 'AST-003', role: 'بوابة تخيّلية', icon: Shield },
    { id: 'AST-001', role: 'خادم مصادقة', icon: Server },
    { id: 'AST-002', role: 'خادم قاعدة بيانات', icon: Server },
    { id: 'AST-007', role: 'خادم ويب', icon: Server },
  ];
  return (
    <div className="topology-example">
      <div className="topology-root">
        <Network size={19} />
        <span>
          <strong>شبكة افتراضية</strong>
          <small>بنية مصنوعة للشرح</small>
        </span>
      </div>
      <div className="topology-branches">
        {boxes.map(row => {
          const asset = data.assets.find(x => x.id === row.id);
          return (
            <button
              type="button"
              key={row.id}
              disabled={!asset}
              onClick={() => asset && openDetail('asset', asset.id)}
            >
              <row.icon size={18} />
              <span>
                <strong dir="ltr">{asset?.name || 'غير متاح'}</strong>
                <small>{row.role}</small>
              </span>
              <ArrowLeft size={14} />
            </button>
          );
        })}
      </div>
      <p>الخطوط توضيحية وليست اتصالات مستنتجة من عناوين IP أو من خريطة العلاقات الحالية.</p>
    </div>
  );
}

export default function NetworkExtras({ view, unit, data, openDetail }) {
  const previous = useMemo(
    () => previousNetworkView(view.period, view.direction, view.scenario),
    [view.period, view.direction, view.scenario],
  );
  const delta = previous?.mbps ? ((view.mbps - previous.mbps) / previous.mbps) * 100 : null;
  return (
    <div className="network-extras">
      <details className="network-extra">
        <summary>
          <span>
            <GitCompareArrows size={18} />
            <span>
              <strong>مقارنة بالفترة السابقة</strong>
              <small>الفترة نفسها والاتجاه نفسه</small>
            </span>
          </span>
          <Tag>تجريبي</Tag>
        </summary>
        <div className="network-extra-body">
          {previous ? (
            <div className="comparison-cards">
              <div>
                <span>الفترة الحالية</span>
                <strong dir="ltr">
                  {netRate(view.mbps, unit)} {unit}
                </strong>
                <small>متوسط النقل</small>
              </div>
              <div>
                <span>الفترة السابقة</span>
                <strong dir="ltr">
                  {netRate(previous.mbps, unit)} {unit}
                </strong>
                <small>متوسط النقل</small>
              </div>
              <div>
                <span>التغير</span>
                <strong dir="ltr">
                  {delta >= 0 ? '+' : ''}
                  {netNumber(delta)}%
                </strong>
                <small>مقارنة حسابية للعينة</small>
              </div>
            </div>
          ) : (
            <p className="detail-muted">
              الفترة السابقة الكاملة غير متاحة؛ العينة تحتوي على سبعة أيام فقط، لذلك لن نختلق
              أسبوعًا سابقًا.
            </p>
          )}
          <p className="experience-footnote">
            المقارنة من بيانات المرور الاصطناعية نفسها، ولا تشمل المناطق أو الاتصالات كلقطات
            تاريخية.
          </p>
        </div>
      </details>
      <details className="network-extra">
        <summary>
          <span>
            <Play size={18} />
            <span>
              <strong>إعادة عرض فواصل العينة</strong>
              <small>تشغيل أو تنقّل يدوي</small>
            </span>
          </span>
          <Tag>مجمّع</Tag>
        </summary>
        <div className="network-extra-body">
          <Replay view={view} unit={unit} />
        </div>
      </details>
      <details className="network-extra">
        <summary>
          <span>
            <Network size={18} />
            <span>
              <strong>طوبولوجيا افتراضية</strong>
              <small>بنية تخيّلية منفصلة عن العلاقات</small>
            </span>
          </span>
          <Tag>للتوضيح</Tag>
        </summary>
        <div className="network-extra-body">
          <Topology data={data} openDetail={openDetail} />
        </div>
      </details>
    </div>
  );
}
