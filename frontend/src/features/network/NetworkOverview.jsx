import React, { useMemo } from 'react';
import { ArrowLeft, Waypoints } from 'lucide-react';

import { netInteger, netRate, networkView } from './network-data';
export function NetworkOverview({ go, timeRange = '24h' }) {
  const view = useMemo(() => networkView(timeRange, 'both'), [timeRange]);
  return (
    <section className="network-overview-card" aria-label="ملخص تحليل الشبكة التجريبي">
      <span className="network-overview-icon">
        <Waypoints size={21} />
      </span>
      <div className="network-overview-copy">
        <span>رؤية الشبكة · مثال مستقل</span>
        <h2>تحليل الحركة والاتصالات</h2>
        <p>السرعة والحزم والبروتوكولات والمناطق ضمن عينة توضيحية.</p>
      </div>
      <div
        className="network-overview-stats"
        role="group"
        aria-label="متوسطات الفترة العامة من العينة"
      >
        <div>
          <small>متوسط النقل</small>
          <strong>
            <bdi dir="ltr">{netRate(view.mbps)} Mbps</bdi>
          </strong>
        </div>
        <div>
          <small>متوسط الحزم</small>
          <strong>
            <bdi dir="ltr">{netInteger(view.pps)} PPS</bdi>
          </strong>
        </div>
      </div>
      <button type="button" onClick={() => go('network')}>
        استكشف التحليل <ArrowLeft size={16} />
      </button>
    </section>
  );
}
