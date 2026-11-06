import React, { memo, useState } from 'react';
import { CircleAlert, Globe2 } from 'lucide-react';
import { Panel } from '../../shared/ui/index';
import { WORLD_DOTS } from './world-dots';

import { netInteger } from './network-data';
const LandDots = memo(function LandDots() {
  return (
    <g className="network-map-land">
      {WORLD_DOTS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2" />
      ))}
    </g>
  );
});
export const GeoMap = memo(function GeoMap({ regions }) {
  const [region, setRegion] = useState('middle-east'),
    chosen = regions.find(r => r.id === region) || regions[0];
  return (
    <Panel className="network-geo-panel">
      <div className="network-panel-heading">
        <div>
          <span className="network-section-kicker">GEOGRAPHIC VIEW · DEMO</span>
          <h2>التوزيع الجغرافي التقريبي</h2>
          <p>مثال منفصل لمناطق افتراضية؛ ليست مواقع عناوين IP المعروضة.</p>
        </div>
        <span className="network-heading-icon">
          <Globe2 size={19} />
        </span>
      </div>
      <div className="network-geo-layout">
        <div className="network-world-map" role="group" aria-label="خريطة توضيحية للمناطق">
          <svg viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <defs>
              <radialGradient id="network-map-glow">
                <stop stopColor="var(--nx-brand)" stopOpacity=".13" />
                <stop offset="1" stopColor="var(--nx-brand)" stopOpacity="0" />
              </radialGradient>
            </defs>
            <ellipse cx="500" cy="250" rx="470" ry="225" fill="url(#network-map-glow)" />
            <g className="network-map-grid">
              {[125, 250, 375].map(y => (
                <line key={`y${y}`} x1="0" y1={y} x2="1000" y2={y} />
              ))}
              {[250, 500, 750].map(x => (
                <line key={`x${x}`} x1={x} y1="0" x2={x} y2="500" />
              ))}
            </g>
            <LandDots />
          </svg>
          {regions.map(item => (
            <button
              type="button"
              key={item.id}
              className={`network-map-point ${region === item.id ? 'selected' : ''}`}
              style={{ left: `${item.x / 10}%`, top: `${item.y / 5}%` }}
              onClick={() => setRegion(item.id)}
              aria-pressed={region === item.id}
              aria-label={`اختيار منطقة ${item.label}`}
            >
              <span />
            </button>
          ))}
        </div>
        <div className="network-region-list" role="group" aria-label="المناطق الافتراضية">
          {regions.map(item => (
            <button
              type="button"
              key={item.id}
              className={region === item.id ? 'selected' : ''}
              aria-pressed={region === item.id}
              onClick={() => setRegion(item.id)}
            >
              <span>
                <i />
                {item.label}
              </span>
              <strong>{netInteger(item.count)}</strong>
            </button>
          ))}
          <div className="network-region-selected" role="status" aria-live="polite">
            <strong>{chosen.label}</strong>
            <span>{netInteger(chosen.count)} تدفق افتراضي للعرض</span>
          </div>
        </div>
      </div>
      <p className="network-map-note">
        <CircleAlert size={16} />
        <span>
          لا يوجد بحث Geo-IP أو اتصال بقاعدة مواقع. الأرقام والنقاط عينة مستقلة، ولا تُستنتج مواقع
          من العناوين الخاصة أو عناوين الأمثلة؛ المواقع الحقيقية تقريبية وتستلزم مصدرًا مناسبًا
          وضوابط خصوصية.
        </span>
      </p>
    </Panel>
  );
});
