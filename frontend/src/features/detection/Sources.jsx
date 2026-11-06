import React from 'react';
import { ArrowLeft, Clock3, Network, Plus } from 'lucide-react';
import { ar, Button, InfoBox, PageHeading, Panel, Status } from '../../shared/ui/index';

import { SensorHealth } from '../demo/ExperienceModules';
import { IntegrationHub } from '../demo/ProductExtensions';

function RadioSymbol() {
  return <Network size={22} />;
}
export function Sources({ data, openModal, openDetail }) {
  const connected = data.sources.filter(s => s.health === 'متصل').length;
  return (
    <>
      <PageHeading
        title="مصادر البيانات"
        subtitle="الأجهزة والمستشعرات التي ترسل أحداثًا إلى المنصة."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => openModal('addSource')}>
            إضافة مصدر
          </Button>
        }
      />
      <div className={`source-summary ${connected < data.sources.length ? 'partial' : ''}`}>
        <div>
          <span className={`pulse-dot ${connected < data.sources.length ? 'attention' : ''}`} />{' '}
          <strong>حالة المصادر في العينة</strong>
          <small>الحالات توضيحية وليست اتصالًا حقيقيًا</small>
        </div>
        <span>
          {ar(connected)} من {ar(data.sources.length)} متصل
        </span>
      </div>
      <div className="source-grid">
        {data.sources.map((s, i) => (
          <Panel className="source-card" key={s.id || `${s.name}-${i}`}>
            <div className="source-card-top">
              <div className={`feature-card-icon ${s.color || 'blue'}`}>
                <RadioSymbol />
              </div>
              <Status value={s.health || 'غير متصل'} />
            </div>
            <h2>{s.name}</h2>
            <p>
              {s.kind} <span className="source-location">· {s.location || 'موقع غير محدد'}</span>
            </p>
            <div className="source-address">
              <span>MAC الواجهة</span>
              {s.mac ? (
                <bdi dir="ltr" className="mono">
                  {s.mac}
                </bdi>
              ) : (
                <strong>غير متوفر</strong>
              )}
            </div>
            <div className="source-metrics">
              <div>
                <span>الأحداث في العينة</span>
                <strong>{s.events || '٠'}</strong>
              </div>
              <div>
                <span>آخر استقبال تجريبي</span>
                <strong>{s.lastSeen || '—'}</strong>
              </div>
            </div>
            <div className="source-card-foot">
              <span>
                <Clock3 size={14} /> انحراف الساعة
              </span>
              <strong>{s.drift && s.drift !== '—' ? `${s.drift} ث` : '—'}</strong>
              <button onClick={() => openDetail('source', s.id)}>
                تفاصيل المصدر <ArrowLeft size={14} />
              </button>
            </div>
          </Panel>
        ))}
      </div>
      <SensorHealth data={data} openDetail={openDetail} />
      <IntegrationHub />
      <InfoBox title="الفرق بين المصدر وطريقة الجمع">
        المصدر هو الجهاز أو المستشعر المسمّى داخل المؤسسة؛ وتظهر طريقة جمعه وتفاصيلها عند فتح
        المصدر. الحالات والأرقام هنا تجريبية.
      </InfoBox>
      <InfoBox title="مزامنة الوقت مهمة للربط">
        بحسب التصميم، إذا تجاوز انحراف ساعة المصدر ثانية واحدة، يُعلَّق الربط الزمني له حتى تصحيح
        المزامنة. لا توجد مراقبة فعلية في النموذج.
      </InfoBox>
    </>
  );
}
