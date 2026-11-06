import { useLandmarkScope } from '../../../shared/hooks/landmark-scope';
import React from 'react';
import { ArrowLeft, Boxes, Clock3, Fingerprint, Search, ShieldAlert } from 'lucide-react';
import { events } from '../../../data/fixtures/demo-records';
import { interfacesOf } from '../../assets/asset-model';
import { inPeriod } from '../../../shared/lib/time-scope';
import { ar, InfoBox, Tag } from '../../../shared/ui/index';

const labels = { ip: 'عنوان IP', user: 'مستخدم', mac: 'عنوان MAC' };
const norm = value =>
  String(value ?? '')
    .trim()
    .toLowerCase();
export function EntityLink({ type, value, openDetail }) {
  if (!value || value === '—') return <bdi dir="ltr">{value || '—'}</bdi>;
  return (
    <button
      type="button"
      className="entity-link"
      aria-label={`استكشاف ${labels[type] || 'الكيان'} ${value}`}
      onClick={() => openDetail('entity', `${type}|${value}`)}
    >
      <bdi dir="ltr">{value}</bdi>
      <Search size={13} />
    </button>
  );
}

export default function EntityContext({ id, data, openDetail, timeRange = '24h' }) {
  const landmark = useLandmarkScope();
  const split = id.indexOf('|'),
    type = split < 0 ? 'ip' : id.slice(0, split),
    value = split < 0 ? id : id.slice(split + 1),
    v = norm(value);
  const matchesEvent = e =>
    type === 'ip'
      ? [e.src, e.dst].some(x => norm(x) === v)
      : type === 'user'
        ? norm(e.user) === v
        : false;
  const matchedEvents = events.filter(e => matchesEvent(e) && inPeriod(e, 'event', timeRange));
  const matchedAlerts = data.alerts.filter(
    a =>
      type === 'ip' &&
      [a.source, a.destination].some(x => norm(x) === v) &&
      inPeriod(a, 'alert', timeRange),
  );
  const matchedIncidents = data.incidents.filter(
    a =>
      type === 'ip' &&
      [a.sourceIp, a.destinationIp, a.ip].some(x => norm(x) === v) &&
      inPeriod(a, 'incident', timeRange),
  );
  const matchedAssets = data.assets.filter(a =>
    interfacesOf(a).some(iface =>
      type === 'ip' ? norm(iface.ip) === v : type === 'mac' ? norm(iface.mac) === v : false,
    ),
  );
  const sections = [
    {
      kind: 'event',
      title: 'أحداث مرتبطة',
      icon: Clock3,
      items: matchedEvents,
      desc: e =>
        `${e.category} · ${e.time} · ${e.src === value ? 'عنوان مصدر' : e.dst === value ? 'عنوان وجهة' : 'المستخدم في الحدث'}`,
    },
    {
      kind: 'alert',
      title: 'تنبيهات مرتبطة',
      icon: ShieldAlert,
      items: matchedAlerts,
      desc: e => `${e.severity} · ${e.asset}`,
    },
    {
      kind: 'incident',
      title: 'حوادث مرتبطة',
      icon: ShieldAlert,
      items: matchedIncidents,
      desc: e => `${e.status} · ${e.asset}`,
    },
    {
      kind: 'asset',
      title: 'أصول مسجّلة',
      icon: Boxes,
      items: matchedAssets,
      desc: e => `${e.type} · سجل أصل حالي`,
    },
  ];
  return (
    <section className="entity-context" aria-label={landmark('سياق الكيان التجريبي')}>
      <div className="experience-intro">
        <span>
          <Fingerprint size={19} />
        </span>
        <div>
          <strong>
            {labels[type] || 'كيان'} <bdi dir="ltr">{value}</bdi>
          </strong>
          <p>سياق من السجلات التجريبية؛ لا يعني التطابق وقوع هجوم أو اكتشاف جهاز.</p>
        </div>
        <Tag color="blue">عينة محلية</Tag>
      </div>
      <InfoBox>
        الأحداث والتنبيهات والحوادث تتبع الفترة العامة. الأصول لقطة سجل مستقلة. عنوان IP أو MAC ليس
        هوية دائمة، وعنوان MAC في سجل الأصل ليس رصدًا من حزمة.
      </InfoBox>
      {sections.map(({ kind, title, icon: Icon, items, desc }) => (
        <section className="entity-section" key={kind}>
          <div className="entity-section-head">
            <h3>
              <Icon size={16} /> {title}
            </h3>
            <Tag>{ar(items.length)}</Tag>
          </div>
          {items.length ? (
            <div className="entity-records">
              {items.map(item => (
                <button type="button" key={item.id} onClick={() => openDetail(kind, item.id)}>
                  <span>
                    <strong>{item.title || item.category || item.name}</strong>
                    <small>
                      <bdi dir="ltr">{item.id}</bdi> · {desc(item)}
                    </small>
                  </span>
                  <ArrowLeft size={15} />
                </button>
              ))}
            </div>
          ) : (
            <p className="detail-muted">لا توجد سجلات مطابقة متاحة في هذا النطاق من العينة.</p>
          )}
        </section>
      ))}
    </section>
  );
}
