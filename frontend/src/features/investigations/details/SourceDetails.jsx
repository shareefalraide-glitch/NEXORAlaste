import React from 'react';

import { Button, ltr, Status, Tag } from '../../../shared/ui/index';
import { events } from '../../../data/fixtures/demo-records';

import { DetailGrid, RelatedRecords } from './DetailComponents';
export function SourceDetails({ item, data, openDetail, openModal, offlineSimulation }) {
  const linkedEvents = events.filter(event => event.sourceId === item.id),
    linkedAlerts = data.alerts.filter(alert => alert.sourceId === item.id);
  return (
    <>
      <div className="detail-badges">
        <Tag color="blue">{item.kind}</Tag>
        <Status value={item.health || 'غير متصل'} />
      </div>
      <p className="detail-description">
        الجهاز أو المستشعر في العينة منفصل عن طريقة الجمع؛ لا يتم فحص اتصال فعلي.
      </p>
      <DetailGrid
        items={[
          ['اسم المصدر', item.name],
          ['عنوان MAC للواجهة', ltr(item.mac || '—', 'mono')],
          ['الموقع', item.location || 'غير محدد'],
          ['طريقة جمع البيانات', ltr(item.method || '—', 'mono')],
          ['نوع الطريقة', item.methodType || 'غير محددة'],
          ['آخر استقبال تجريبي', item.lastSeen || '—'],
        ]}
      />
      <p className="detail-muted">
        عنوان اختياري لواجهة واحدة من الجهاز في العينة، وليس اكتشافًا أو تحققًا فعليًا.
      </p>
      <div className="detail-actions">
        <Button disabled={offlineSimulation} onClick={() => openModal('editSource', item)}>
          تعديل عنوان MAC
        </Button>
      </div>
      <RelatedRecords
        title="أحداث المصدر في العينة"
        items={linkedEvents}
        kind="event"
        openDetail={openDetail}
      />
      <RelatedRecords
        title="تنبيهات المصدر في العينة"
        items={linkedAlerts}
        kind="alert"
        openDetail={openDetail}
      />
    </>
  );
}
