import React from 'react';
import { Database, FileCode2, Server, ShieldAlert } from 'lucide-react';
import { Button, ltr, Status, Tag } from '../../../shared/ui/index';

import { assetForRecord } from '../../assets/asset-relations';

import { EntityLink } from './EntityContext';

import { DetailGrid } from './DetailComponents';
export function EventDetails({ item, data, openDetail }) {
  const asset = assetForRecord(data.assets, item);
  const eventSource = data.sources.find(source => source.id === item.sourceId);
  return (
    <>
      <div className="detail-badges">
        <Tag color="blue">{eventSource?.kind || 'مصدر غير محدد'}</Tag>
        <Status value={item.outcome} />
        <Tag>{item.category}</Tag>
      </div>
      <p className="detail-description">
        حدث وصفي موحّد من عينة السجلات. لا يحتوي على محتوى الحزم.
      </p>
      <DetailGrid
        items={[
          ['مصدر البيانات', eventSource?.name || 'غير محدد'],
          ['طريقة جمع البيانات', ltr(item.collectionMethod, 'mono')],
          ['نوع الحدث', item.category],
          ['عنوان المصدر', <EntityLink type="ip" value={item.src} openDetail={openDetail} />],
          ['عنوان الوجهة', <EntityLink type="ip" value={item.dst} openDetail={openDetail} />],
          ['منفذ الوجهة', ltr(item.port, 'mono')],
          ['بروتوكول تجريبي', ltr(item.protocol || 'غير محدد', 'mono')],
          ['الأصل', ltr(item.asset, 'mono')],
          [
            'MAC الأصل في السجل',
            <EntityLink type="mac" value={asset?.mac || '—'} openDetail={openDetail} />,
          ],
          ['المستخدم', <EntityLink type="user" value={item.user} openDetail={openDetail} />],
          ['الوقت الأصلي', ltr(`2026-10-29 ${item.time} ${item.tz}`, 'mono')],
          ['الوقت الموحّد UTC', ltr(item.utc, 'mono')],
        ]}
      />
      <p className="detail-muted">
        MAC الأصل مأخوذ من سجله الحالي في العينة، وليس حقل MAC للمصدر أو الوجهة في الحدث.
      </p>
      <div className="detail-section-title">
        <span>
          <FileCode2 size={16} /> حقول الحدث الموحّدة
        </span>
        <Tag>ECS · نموذج</Tag>
      </div>
      <pre className="code-block" dir="ltr">
        {JSON.stringify(
          {
            'event.id': item.id,
            'event.category': item.category,
            'event.outcome': item.outcome,
            'source.ip': item.src,
            'destination.ip': item.dst,
            'destination.port': Number(item.port),
            'network.transport': item.protocol,
            'host.name': item.asset,
            'user.name': item.user,
            '@timestamp': item.utc,
          },
          null,
          2,
        )}
      </pre>
      <div className="detail-actions">
        {item.alert && (
          <Button icon={ShieldAlert} onClick={() => openDetail('alert', item.alert)}>
            التنبيه المرتبط
          </Button>
        )}
        {asset && (
          <Button icon={Server} onClick={() => openDetail('asset', asset.id)}>
            الأصل المرتبط
          </Button>
        )}
        {eventSource && (
          <Button icon={Database} onClick={() => openDetail('source', eventSource.id)}>
            مصدر البيانات
          </Button>
        )}
      </div>
    </>
  );
}
