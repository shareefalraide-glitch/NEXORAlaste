import React, { useState } from 'react';
import { ArrowLeft, CircleAlert, Layers3, ScanLine, Server } from 'lucide-react';
import { Panel } from '../../shared/ui/index';

import { netInteger, netNumber, netRate } from './network-data';
export function TopTalkers({ view, data, openDetail, unit }) {
  const maximum = Math.max(...view.talkers.map(x => x.mbps), 1);
  return (
    <Panel className="network-talkers-panel">
      <div className="network-panel-heading">
        <div>
          <span className="network-section-kicker">TOP TALKERS</span>
          <h2>الأصول الأعلى استهلاكًا</h2>
          <p>مرتبة حسب متوسط البايتات للفترة؛ بقية الأصول غير معروضة.</p>
        </div>
        <span className="network-heading-icon">
          <Server size={19} />
        </span>
      </div>
      <div className="network-talker-list">
        {view.talkers.map((item, index) => {
          const asset = data.assets.find(a => a.id === item.id);
          return (
            <button
              type="button"
              key={item.id}
              className="network-talker"
              disabled={!asset}
              onClick={() => asset && openDetail('asset', asset.id)}
              aria-label={
                asset
                  ? `فتح الأصل ${asset.name}، متوسط النقل ${netRate(item.mbps, unit)} ${unit} في العينة`
                  : 'أصل غير متاح'
              }
            >
              <span className="network-rank">{netInteger(index + 1)}</span>
              <span className="network-talker-main">
                <strong dir="ltr">{asset?.name || 'أصل غير متاح'}</strong>
                <small dir="ltr">{asset?.ip || '—'}</small>
                <i>
                  <b style={{ width: `${(item.mbps / maximum) * 100}%` }} />
                </i>
              </span>
              <span className="network-talker-rate">
                <bdi dir="ltr">{netRate(item.mbps, unit)}</bdi>
                <small>{unit}</small>
              </span>
              <ArrowLeft size={14} />
            </button>
          );
        })}
      </div>
      <p className="network-footnote">
        التوزيع افتراضي ومرتبط بمعرّفات الأصول في العينة؛ ليس قياسًا لأجهزتك.
      </p>
    </Panel>
  );
}
function DistributionGroup({ title, items, group, selected, onSelect }) {
  return (
    <div className="network-distribution-group">
      <h3>{title}</h3>
      <div className="network-distribution-bar" aria-hidden="true" dir="ltr">
        {items.map(item => (
          <span key={item.id} className={item.color} style={{ width: `${item.percent}%` }} />
        ))}
      </div>
      <div className="network-distribution-items">
        {items.map(item => (
          <button
            type="button"
            key={item.id}
            aria-pressed={selected === `${group}:${item.id}`}
            onClick={() =>
              onSelect(selected === `${group}:${item.id}` ? null : `${group}:${item.id}`)
            }
          >
            <span>
              <i className={item.color} />
              <bdi dir="auto">{item.label}</bdi>
              {item.layer && <small>· {item.layer}</small>}
            </span>
            <strong>{netNumber(item.percent)}٪</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
export function Protocols({ view, data, openDetail }) {
  const [selected, setSelected] = useState(null);
  const item = [...view.transport, ...view.applications].find(x => selected?.endsWith(`:${x.id}`));
  return (
    <Panel className="network-protocols-panel">
      <div className="network-panel-heading">
        <div>
          <span className="network-section-kicker">PROTOCOL MIX</span>
          <h2>توزيع البروتوكولات</h2>
          <p>نسبة حجم البيانات ضمن الاتجاه والفترة المختارين.</p>
        </div>
        <span className="network-heading-icon">
          <Layers3 size={19} />
        </span>
      </div>
      <DistributionGroup
        title="الشبكة والنقل"
        items={view.transport}
        group="transport"
        selected={selected}
        onSelect={setSelected}
      />
      <DistributionGroup
        title="التطبيقات · تصنيف مستقل"
        items={view.applications}
        group="applications"
        selected={selected}
        onSelect={setSelected}
      />
      <p className="network-footnote" aria-live="polite">
        {item ? `تمييز ${item.label}: ${netNumber(item.percent)}٪ من حجم عينة هذا التصنيف. ` : ''}قد
        تتداخل طبقات التطبيق والنقل؛ لا تجمع نسب المجموعتين معًا.
      </p>
      {item && (
        <section className="protocol-explorer" aria-label="تفاصيل البروتوكول المحدد">
          <div>
            <strong>استكشاف {item.label}</strong>
            <small>{netNumber(item.percent)}٪ من حجم تصنيفه ضمن العينة</small>
          </div>
          {selected === 'transport:tcp' ? (
            <>
              <p>أمثلة منافذ TCP المسجلة افتراضيًا في لوحة المنافذ نفسها:</p>
              <div className="protocol-example-ports">
                {view.ports.map(port => {
                  const asset = data.assets.find(x => x.id === port.assetId);
                  return (
                    <button
                      type="button"
                      key={port.port}
                      disabled={!asset}
                      onClick={() => asset && openDetail('asset', asset.id)}
                    >
                      <bdi dir="ltr">{port.port}</bdi>
                      <span>{asset?.name || 'أصل غير متاح'}</span>
                      <ArrowLeft size={13} />
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p>
              لا توجد في العينة تفاصيل منافذ مرتبطة بهذا الاختيار؛ لا نُخمن الربط من اسم البروتوكول
              وحده.
            </p>
          )}
        </section>
      )}
    </Panel>
  );
}
export function Ports({ view, data, openDetail }) {
  return (
    <Panel className="network-ports-panel">
      <div className="network-panel-heading">
        <div>
          <span className="network-section-kicker">BASELINE CONTEXT</span>
          <h2>منافذ تستحق المراجعة</h2>
          <p>ملاحظات مقارنة بخط أساس افتراضي، ضمن محاولات TCP في العينة.</p>
        </div>
        <span className="network-heading-icon">
          <ScanLine size={19} />
        </span>
      </div>
      <div className="network-port-list">
        {view.ports.map(item => {
          const asset = data.assets.find(a => a.id === item.assetId);
          return (
            <button
              className="network-port"
              type="button"
              key={item.port}
              disabled={!asset}
              onClick={() => asset && openDetail('asset', asset.id)}
              aria-label={`منفذ ${item.port}، ${item.observation}، فتح الأصل ${asset?.name || 'غير متاح'}`}
            >
              <span className="network-port-number" dir="ltr">
                {item.port}
                <small>{item.protocol}</small>
              </span>
              <span className="network-port-copy">
                <strong>{item.observation}</strong>
                <small dir="ltr">{asset?.name || 'أصل غير متاح'}</small>
              </span>
              <span className="network-port-count">
                <strong>{netInteger(item.count)}</strong>
                <small>محاولة مثال</small>
              </span>
              <ArrowLeft size={14} />
            </button>
          );
        })}
      </div>
      <p className="network-insight">
        <CircleAlert size={16} />
        <span>
          رقم المنفذ أو ظهوره لأول مرة لا يدل وحده على نشاط ضار. راجع الأصل والخدمة والسياق قبل
          الحكم.
        </span>
      </p>
    </Panel>
  );
}
