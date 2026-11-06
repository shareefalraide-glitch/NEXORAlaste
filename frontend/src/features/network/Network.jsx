import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  CircleAlert,
  Clock3,
  Layers3,
  Radio,
  Server,
  Waypoints,
} from 'lucide-react';
import { PageHeading, Tag } from '../../shared/ui/index';

import NetworkExtras from './NetworkExtras';
import NetworkHeatmap from './NetworkHeatmap';
import { NETWORK_PERIODS, netInteger, netNumber, netRate, networkView } from './network-data';
import { directionNames, NetMetric, ScenarioPanel, SessionBreakdown } from './NetworkMetrics';
import { TrafficChart } from './TrafficChart';
import { TopTalkers, Protocols, Ports } from './NetworkDistributions';
import { GeoMap } from './NetworkGeoMap';
import { Definitions } from './NetworkDefinitions';
export default function NetworkPage({
  data,
  openDetail,
  timeRange = '24h',
  setTimeRange,
  investigations = {},
}) {
  const period = timeRange,
    setPeriod = setTimeRange;
  const [direction, setDirection] = useState('both'),
    [unit, setUnit] = useState('Mbps'),
    [scenario, setScenario] = useState('normal');
  const view = useMemo(
    () => networkView(period, direction, scenario),
    [period, direction, scenario],
  );
  // The local spike changes traffic only: keep unrelated session/map props stable.
  const session = useMemo(
    () => ({
      completed: view.completed,
      attempts: view.attempts,
      incomplete: view.incomplete,
      resets: view.resets,
      unresolved: view.unresolved,
    }),
    [view.completed, view.attempts, view.incomplete, view.resets, view.unresolved],
  );
  const regions = useMemo(() => view.regions, [period, direction]);
  return (
    <div className="network-page">
      <PageHeading
        title="تحليل الشبكة"
        subtitle="قراءة موحّدة لحركة البيانات والاتصالات والسياق الجغرافي التوضيحي."
        badge={<Tag color="cyan">بيانات تجريبية</Tag>}
      />
      <div className="network-intro">
        <div className="network-intro-icon">
          <Radio size={21} />
        </div>
        <div>
          <span>NETWORK VISIBILITY / UI DEMO</span>
          <strong>عينة ثابتة، وليست مراقبة مباشرة</strong>
          <p>
            جميع الأرقام والاتصالات والمناطق مصنوعة للعرض؛ لا يوجد جمع حزم أو استعلام عن الشبكة أو
            موقع IP.
          </p>
        </div>
        <div className="network-intro-time">
          <Clock3 size={15} />
          <span>
            نهاية العينة
            <br />
            <bdi dir="ltr">29 OCT 2026 · 10:00 UTC+03</bdi>
          </span>
        </div>
      </div>
      <div className="network-filters" role="group" aria-label="مرشحات تحليل الشبكة">
        <div className="network-filter-title">
          <BarChart3 size={17} />
          <span>
            <strong>نطاق العينة</strong>
            <small>المتوسطات حسب الفترة والاتجاه</small>
          </span>
        </div>
        <label>
          <span>الفترة</span>
          <select
            aria-label="الفترة الزمنية لتحليل الشبكة"
            value={period}
            onChange={e => setPeriod(e.target.value)}
          >
            {Object.entries(NETWORK_PERIODS).map(([key, item]) => (
              <option key={key} value={key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>الاتجاه</span>
          <select
            aria-label="اتجاه حركة الشبكة"
            value={direction}
            onChange={e => setDirection(e.target.value)}
          >
            <option value="both">الوارد والصادر</option>
            <option value="in">الوارد فقط</option>
            <option value="out">الصادر فقط</option>
          </select>
        </label>
        <label>
          <span>وحدة النقل</span>
          <select aria-label="وحدة سرعة النقل" value={unit} onChange={e => setUnit(e.target.value)}>
            <option value="Mbps">Mbps</option>
            <option value="Gbps">Gbps</option>
          </select>
        </label>
      </div>
      <ScenarioPanel view={view} scenario={scenario} onScenario={setScenario} />
      <div className="network-metrics" role="group" aria-label="مؤشرات عينة الشبكة">
        <NetMetric
          id="throughput"
          icon={Activity}
          title="متوسط سرعة النقل"
          value={netRate(view.mbps, unit)}
          unit={unit}
          raw={view.mbps}
          note={`متوسط الفترة · ${directionNames[direction]}`}
        />
        <NetMetric
          id="pps"
          icon={Waypoints}
          title="الحزم في الثانية"
          value={netInteger(view.pps)}
          unit="PPS"
          raw={view.pps}
          note="متوسط الفترة · جميع الحزم"
          tone="blue"
        />
        <NetMetric
          id="packet-size"
          icon={Layers3}
          title="متوسط حجم الحزمة"
          value={netInteger(view.meanBytes)}
          unit="بايت"
          raw={view.meanBytes}
          note="حجم البيانات ÷ عدد الحزم"
          tone="purple"
        />
        <NetMetric
          id="active"
          icon={Server}
          title="اتصالات TCP النشطة"
          value={netInteger(view.active)}
          raw={view.active}
          note="لقطة عند نهاية العينة"
          tone="green"
        />
        <NetMetric
          id="cps"
          icon={ArrowUpRight}
          title="الاتصالات الجديدة"
          value={netNumber(view.cps)}
          unit="CPS"
          raw={view.cps}
          note="مكتملة في الثانية · متوسط الفترة"
          tone="blue"
        />
        <NetMetric
          id="handshake"
          icon={CircleAlert}
          title="مصافحات غير مكتملة"
          value={netInteger(view.incomplete)}
          raw={view.incomplete}
          note={`${netNumber(view.incompletePercent)}٪ من محاولات TCP في الفترة`}
          tone="orange"
        />
      </div>
      <div className="network-main-grid">
        <TrafficChart view={view} unit={unit} />
        <SessionBreakdown view={session} />
      </div>
      <NetworkExtras view={view} unit={unit} data={data} openDetail={openDetail} />
      <NetworkHeatmap
        view={view}
        data={data}
        openDetail={openDetail}
        investigations={investigations}
      />
      <div className="network-detail-grid">
        <TopTalkers view={view} data={data} openDetail={openDetail} unit={unit} />
        <Protocols view={view} data={data} openDetail={openDetail} />
      </div>
      <Ports view={view} data={data} openDetail={openDetail} />
      <GeoMap regions={regions} />
      <Definitions />
      <div className="network-page-end">
        <ArrowDownLeft size={15} /> شاشة تصميمية فقط · لا تنفّذ التقاطًا أو تحليلًا أو تحديد موقع
        فعليًا
      </div>
    </div>
  );
}
