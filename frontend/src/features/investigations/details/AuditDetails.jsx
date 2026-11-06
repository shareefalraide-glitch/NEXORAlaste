import React from 'react';

import { InfoBox, ltr, Status, Tag } from '../../../shared/ui/index';

import { DetailGrid } from './DetailComponents';
export function AuditDetails({ item }) {
  return (
    <>
      <div className="detail-badges">
        <Status value={item.result} />
        <Tag color="green">للقراءة فقط</Tag>
      </div>
      <p className="detail-description">سجل نشاط توضيحي، لا توجد أدوات تعديل أو حذف.</p>
      <DetailGrid
        items={[
          ['العملية', item.action],
          ['المنفّذ', item.actor],
          ['الوقت', ltr(item.time, 'mono')],
          ['التاريخ', item.date],
          ['الكيان المتأثر', ltr(item.entity, 'mono')],
          ['عنوان المصدر', ltr(item.ip, 'mono')],
          ['البصمة التوضيحية', ltr(item.hash, 'mono')],
        ]}
      />
      <InfoBox>البصمة هنا نص تجريبي وليست نتيجة تحقق أو سلسلة تجزئة فعلية.</InfoBox>
    </>
  );
}
