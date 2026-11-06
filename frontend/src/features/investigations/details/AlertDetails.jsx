import React from 'react';
import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  Database,
  ExternalLink,
  Plus,
  Server,
} from 'lucide-react';
import { ar, Button, ltr, Severity, Status, Tag } from '../../../shared/ui/index';
import { events } from '../../../data/fixtures/demo-records';
import { assetForRecord } from '../../assets/asset-relations';

import TriageAssistant from '../../alerts/TriageAssistant';

import { EntityLink } from './EntityContext';

import { DetailGrid, RelatedRecords, RiskExplanation } from './DetailComponents';
export function AlertDetails({
  item,
  data,
  openModal,
  openDetail,
  update,
  offlineSimulation,
  triageRecords,
  submitTriage,
  sessionRef,
  workspaceId,
}) {
  const asset = assetForRecord(data.assets, item);
  const eventSource = data.sources.find(source => source.id === item.sourceId);
  return (
    <>
      <h3 className="drawer-record-title">{item.title}</h3>
      <div className="detail-badges">
        <Severity value={item.severity} />
        <Status value={item.status} />
        <Tag color="purple">{item.type}</Tag>
      </div>
      <p className="detail-description">
        إشارة أمنية تجريبية مجمّعة من سياق الحدث والأصل. راجع الأدلة قبل اتخاذ أي قرار.
      </p>
      <div className="detail-actions">
        <Button
          variant="primary"
          icon={CheckCircle2}
          disabled={offlineSimulation || item.status === 'تمت المراجعة'}
          onClick={() => update('alerts', item.id, { status: 'تمت المراجعة' }, 'مراجعة تنبيه')}
        >
          وضع علامة تمت المراجعة
        </Button>
        {item.incident ? (
          <Button icon={ExternalLink} onClick={() => openDetail('incident', item.incident)}>
            عرض الحادثة المرتبطة
          </Button>
        ) : (
          <Button
            icon={Plus}
            disabled={offlineSimulation}
            onClick={() => openModal('createFromAlert', { id: item.id })}
          >
            إنشاء حادثة يدويًا
          </Button>
        )}
      </div>
      {(offlineSimulation || item.status === 'تمت المراجعة') && (
        <p className="case-disabled-reason">
          {offlineSimulation
            ? 'الإجراءات غير متاحة أثناء محاكاة الانقطاع.'
            : 'تمت مراجعة التنبيه في العينة؛ لا يلزم تكرار الإجراء.'}
        </p>
      )}
      <TriageAssistant
        workspaceId={workspaceId}
        sessionRef={sessionRef}
        alert={item}
        history={triageRecords[item.id] || []}
        submitTriage={submitTriage}
        offlineSimulation={offlineSimulation}
      />
      <DetailGrid
        items={[
          ['الأصل', ltr(item.asset, 'mono')],
          [
            'MAC الأصل في السجل',
            <EntityLink type="mac" value={asset?.mac || '—'} openDetail={openDetail} />,
          ],
          ['عنوان المصدر', <EntityLink type="ip" value={item.source} openDetail={openDetail} />],
          [
            'عنوان الوجهة',
            <EntityLink
              type="ip"
              value={item.destination || asset?.ip || '—'}
              openDetail={openDetail}
            />,
          ],
          ['مصدر البيانات', eventSource?.name || 'غير محدد'],
          ['طريقة جمع البيانات', ltr(item.collectionMethod, 'mono')],
          ['الوقت', item.age],
          ['الحادثة', item.incident ? ltr(item.incident, 'mono') : 'غير مرتبطة'],
          ['طريقة الكشف', item.type],
        ]}
      />
      <p className="detail-muted">
        MAC الأصل مأخوذ من سجله الحالي في العينة، وليس دليلًا على عنوان مصدر أو وجهة مرصود.
      </p>
      <RiskExplanation item={item} baseline={asset?.baseline} />
      <div className="detail-section-title">
        <span>
          <BrainCircuit size={16} /> أبرز عوامل التفسير
        </span>
      </div>
      <div className="explanation-list">
        {item.features.map((f, i) => (
          <div key={f}>
            <span>{ar(i + 1)}</span>
            {f}
          </div>
        ))}
      </div>
      <div className="sub-card">
        <div>
          <span className="small-device">
            <Server size={17} />
          </span>
          <div>
            <strong>سياق الأصل</strong>
            <small>
              {asset?.owner || 'غير محدد'} · {asset?.baseline || 'غير محدد'}
            </small>
          </div>
        </div>
        <button className="text-link" onClick={() => asset && openDetail('asset', asset.id)}>
          عرض الأصل <ArrowLeft size={14} />
        </button>
      </div>
      <div className="detail-actions">
        {eventSource && (
          <Button icon={Database} onClick={() => openDetail('source', eventSource.id)}>
            عرض مصدر البيانات
          </Button>
        )}
      </div>
      <RelatedRecords
        title="الأحداث المرتبطة في العينة"
        items={events.filter(event => event.alert === item.id)}
        kind="event"
        openDetail={openDetail}
      />
    </>
  );
}
