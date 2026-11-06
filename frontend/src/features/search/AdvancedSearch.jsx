import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Search, SlidersHorizontal } from 'lucide-react';
import { events } from '../../data/fixtures/demo-records';
import { assetForRecord } from '../assets/asset-relations';
import { interfacesOf } from '../assets/asset-model';
import { matchesMac } from '../../shared/lib/mac';
import { PERIOD_HOURS, sampleAgeHours } from '../../shared/lib/time-scope';
import { ar, SearchInput, Severity } from '../../shared/ui/index';

const categories = [
  ['all', 'الكل'],
  ['page', 'الصفحات'],
  ['command', 'الأوامر'],
  ['incident', 'الحوادث'],
  ['alert', 'التنبيهات'],
  ['event', 'الأحداث'],
  ['asset', 'الأصول'],
  ['source', 'المصادر'],
  ['rule', 'القواعد'],
];
const labels = {
  page: 'صفحة',
  command: 'أمر',
  incident: 'حادثة',
  alert: 'تنبيه',
  event: 'حدث',
  asset: 'أصل',
  source: 'مصدر',
  rule: 'قاعدة',
};
const normalize = value =>
  String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u064b-\u065f\u0670]/g, '');
// All dated records share the fixed sample clock; snapshots remain unfiltered.
const eventAge = x => sampleAgeHours(x, 'event');
const sevRank = { حرجة: 4, عالية: 3, متوسطة: 2, منخفضة: 1 };
function records(data) {
  // Related records search the current registered asset MAC, not an observed packet MAC.
  const linked = record => assetForRecord(data.assets, record);
  const assetMac = record => linked(record)?.mac || '';
  const addresses = asset =>
    interfacesOf(asset)
      .flatMap(iface => [iface.ip, iface.mac, iface.name, iface.vlan])
      .filter(Boolean);
  const macs = asset =>
    interfacesOf(asset)
      .map(iface => iface.mac)
      .filter(Boolean);
  return [
    ...data.incidents.map(x => ({
      kind: 'incident',
      id: x.id,
      title: x.title,
      sub: x.asset,
      mac: assetMac(x),
      macs: macs(linked(x)),
      severity: x.severity,
      age: sampleAgeHours(x, 'incident'),
      timeLabel: x.age,
      fields: [
        x.id,
        x.title,
        x.asset,
        x.sourceIp,
        x.destinationIp,
        x.status,
        x.category,
        x.technique,
        ...addresses(linked(x)),
      ],
    })),
    ...data.alerts.map(x => ({
      kind: 'alert',
      id: x.id,
      title: x.title,
      sub: x.asset,
      mac: assetMac(x),
      macs: macs(linked(x)),
      severity: x.severity,
      age: sampleAgeHours(x, 'alert'),
      timeLabel: x.age,
      fields: [
        x.id,
        x.title,
        x.asset,
        x.source,
        x.destination,
        x.status,
        x.type,
        ...addresses(linked(x)),
      ],
    })),
    ...events.map(x => ({
      kind: 'event',
      id: x.id,
      title: x.category,
      sub: x.src,
      mac: assetMac(x),
      macs: macs(linked(x)),
      severity: null,
      age: eventAge(x),
      timeLabel: `${x.time} · عينة`,
      fields: [
        x.id,
        x.category,
        x.src,
        x.dst,
        x.asset,
        x.user,
        x.sourceId,
        x.collectionMethod,
        x.port,
        x.protocol,
        ...addresses(linked(x)),
      ],
    })),
    ...data.assets.map(x => ({
      kind: 'asset',
      id: x.id,
      title: x.name,
      sub: x.ip,
      mac: x.mac,
      macs: macs(x),
      severity: x.criticality,
      age: null,
      timeLabel: 'دون وقت محدد',
      fields: [
        x.id,
        x.name,
        x.ip,
        x.mac,
        x.owner,
        x.type,
        x.group,
        x.manufacturer,
        x.deviceModel,
        x.operatingSystem,
        x.location,
        ...addresses(x),
      ],
    })),
    ...data.sources.map(x => ({
      kind: 'source',
      id: x.id,
      title: x.name,
      sub: x.kind,
      mac: x.mac,
      severity: null,
      age: null,
      timeLabel: 'دون وقت محدد',
      fields: [x.id, x.name, x.kind, x.mac, x.location, x.method, x.health],
    })),
    ...data.rules.map(x => ({
      kind: 'rule',
      id: x.id,
      title: x.name,
      sub: `${x.source} · ${x.technique}`,
      severity: x.severity,
      age: null,
      timeLabel: 'قاعدة عينة',
      fields: [x.id, x.name, x.source, x.technique, x.desc],
    })),
  ];
}
export default function AdvancedSearch({
  data,
  close,
  openDetail,
  go,
  openModal,
  toggleTheme,
  pageOptions = [],
  currentPage,
  activeDetail,
  timeRange = '24h',
}) {
  const [query, setQuery] = useState(''),
    [kind, setKind] = useState('all'),
    [severity, setSeverity] = useState('all'),
    [period, setPeriod] = useState('all'),
    [sort, setSort] = useState('relevance'),
    [explainOpen, setExplainOpen] = useState(() => window.innerWidth > 430);
  const rootRef = useRef(null);
  const all = useMemo(() => {
    const pages = pageOptions.map(x => ({
      kind: 'page',
      id: x.id,
      title: x.label,
      sub: x.group,
      age: null,
      timeLabel: x.id === currentPage ? 'الصفحة الحالية' : 'انتقال مباشر',
      fields: [x.label, x.id, x.group],
    }));
    const commands = [
      {
        kind: 'command',
        id: 'theme',
        title: 'تبديل المظهر',
        sub: 'تبديل الوضع الفاتح أو الداكن',
        age: null,
        timeLabel: 'إجراء للواجهة',
        fields: ['تبديل المظهر', 'الوضع الفاتح', 'الوضع الداكن', 'theme'],
      },
    ];
    if (activeDetail?.kind === 'incident') {
      const incident = data.incidents.find(x => x.id === activeDetail.id),
        asset = incident && assetForRecord(data.assets, incident),
        alert = incident && data.alerts.find(x => x.incident === incident.id);
      if (incident) {
        commands.push({
          kind: 'command',
          id: 'incident-report',
          title: 'معاينة تقرير الحادثة الحالية',
          sub: incident.id,
          age: null,
          timeLabel: 'سياق التحقيق',
          fields: ['تقرير الحادثة', incident.id],
        });
        if (asset)
          commands.push({
            kind: 'command',
            id: 'incident-asset',
            title: 'فتح الأصل المرتبط بالحادثة',
            sub: asset.name,
            age: null,
            timeLabel: 'سياق التحقيق',
            fields: ['الأصل المرتبط', asset.name, asset.id],
          });
        if (alert)
          commands.push({
            kind: 'command',
            id: 'incident-alert',
            title: 'فتح تنبيه مرتبط بالحادثة',
            sub: alert.id,
            age: null,
            timeLabel: 'سياق التحقيق',
            fields: ['التنبيه المرتبط', alert.id, alert.title],
          });
      }
    }
    if (activeDetail?.kind === 'alert') {
      const alert = data.alerts.find(x => x.id === activeDetail.id),
        incident = alert && data.incidents.find(x => x.id === alert.incident);
      if (incident)
        commands.push({
          kind: 'command',
          id: 'alert-incident',
          title: 'فتح الحادثة المرتبطة بالتنبيه',
          sub: incident.id,
          age: null,
          timeLabel: 'سياق التحقيق',
          fields: ['الحادثة المرتبطة', incident.id, alert.id],
        });
    }
    return [...pages, ...commands, ...records(data)];
  }, [data, pageOptions, currentPage, activeDetail]);
  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    return all
      .filter(record => {
        if (kind !== 'all' && record.kind !== kind) return false;
        if (record.kind === 'page' && kind === 'all' && !needle) return false;
        if (severity !== 'all' && record.severity !== severity) return false;
        if (record.age !== null && (record.age < 0 || record.age > (PERIOD_HOURS[timeRange] ?? 24)))
          return false;
        if (period !== 'all' && (record.age === null || record.age > (period === '24h' ? 24 : 168)))
          return false;
        return (
          !needle ||
          record.fields.some(field => normalize(field).includes(needle)) ||
          [...(record.macs || []), record.mac].some(mac => matchesMac(mac, query))
        );
      })
      .map(record => ({
        ...record,
        matchedMac: [...(record.macs || []), record.mac].find(mac => matchesMac(mac, query)) || '',
        rank:
          needle &&
          (normalize(record.id).includes(needle) || normalize(record.title).includes(needle))
            ? 0
            : 1,
      }))
      .sort((a, b) =>
        sort === 'severity'
          ? (sevRank[b.severity] || 0) - (sevRank[a.severity] || 0) || a.rank - b.rank
          : sort === 'time'
            ? (a.age ?? Infinity) - (b.age ?? Infinity) || a.rank - b.rank
            : a.rank - b.rank,
      );
  }, [all, query, kind, severity, period, sort, timeRange]);
  const grouped = categories
    .filter(([id]) => id !== 'all')
    .map(([id, label]) => ({ id, label, items: filtered.filter(item => item.kind === id) }))
    .filter(group => group.items.length);
  const reset = () => {
    setQuery('');
    setKind('all');
    setSeverity('all');
    setPeriod('all');
    setSort('relevance');
  };
  const choose = record => {
    close();
    if (record.kind === 'page') {
      go(record.id);
      return;
    }
    if (record.kind !== 'command') {
      openDetail(record.kind, record.id);
      return;
    }
    if (record.id === 'theme') {
      toggleTheme();
      return;
    }
    const incident =
      activeDetail?.kind === 'incident' ? data.incidents.find(x => x.id === activeDetail.id) : null;
    if (record.id === 'incident-report' && incident)
      openModal('report', { type: 'حادثة تفصيلية', incident });
    else if (record.id === 'incident-asset' && incident) {
      const asset = assetForRecord(data.assets, incident);
      if (asset) openDetail('asset', asset.id);
    } else if (record.id === 'incident-alert' && incident) {
      const alert = data.alerts.find(x => x.incident === incident.id);
      if (alert) openDetail('alert', alert.id);
    } else if (record.id === 'alert-incident') {
      const alert = data.alerts.find(x => x.id === activeDetail?.id);
      if (alert?.incident) openDetail('incident', alert.incident);
    }
  };
  const navigate = e => {
    if (!['ArrowDown', 'ArrowUp'].includes(e.key) || e.target.tagName === 'SELECT') return;
    const items = Array.from(
      rootRef.current?.querySelectorAll('[data-command-result]') || [],
    ).filter(x => x.getClientRects().length);
    if (!items.length) return;
    e.preventDefault();
    const index = items.indexOf(document.activeElement),
      delta = e.key === 'ArrowDown' ? 1 : -1;
    items[
      index < 0 ? (delta > 0 ? 0 : items.length - 1) : (index + delta + items.length) % items.length
    ].focus();
  };
  return (
    <div className="advanced-search" ref={rootRef} onKeyDown={navigate}>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="ابحث عن حادثة، تنبيه، أصل، مصدر بيانات أو عنوان IP أو MAC"
        className="global-modal-search"
        focusOnOpen
      />
      <div className="search-intro">
        <span>
          <SlidersHorizontal size={15} /> مركز الأوامر · بحث محلي
        </span>
        <button type="button" onClick={reset}>
          إعادة ضبط
        </button>
      </div>
      <div className="search-categories" role="group" aria-label="نوع السجل">
        {categories.map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={kind === id ? 'active' : ''}
            aria-pressed={kind === id}
            onClick={() => setKind(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="search-filters">
        <label>
          الخطورة{' '}
          <select
            aria-label="خطورة البحث"
            value={severity}
            onChange={e => setSeverity(e.target.value)}
          >
            <option value="all">كل المستويات</option>
            {['حرجة', 'عالية', 'متوسطة', 'منخفضة'].map(x => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          الفترة في العينة{' '}
          <select aria-label="فترة البحث" value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="all">كل الأوقات</option>
            <option value="24h">آخر ٢٤ ساعة تجريبية</option>
            <option value="7d">آخر ٧ أيام تجريبية</option>
          </select>
        </label>
        <label>
          الترتيب{' '}
          <select
            aria-label="ترتيب نتائج البحث"
            value={sort}
            onChange={e => setSort(e.target.value)}
          >
            <option value="relevance">الأقرب للمطابقة</option>
            <option value="severity">الأعلى خطورة داخل النوع</option>
            <option value="time">الأحدث داخل النوع</option>
          </select>
        </label>
      </div>
      <details
        className="search-explain"
        open={explainOpen}
        onToggle={e => setExplainOpen(e.currentTarget.open)}
      >
        <summary>كيف تعمل المرشحات؟</summary>
        <p className="search-filter-note">
          الخطورة متاحة للحوادث والتنبيهات والقواعد وأهمية الأصول. الترتيب داخل كل نوع. استخدم
          السهمين للتنقل بين النتائج. الفترة العامة تطبق على السجلات المؤرّخة، بينما تظل الأصول
          والمصادر لقطات ثابتة. الفلتر الزمني المحلي يضيّق الفترة العامة ويستبعد ما لا وقت له. مرجع
          العينة ٢٩ أكتوبر ٢٠٢٦، ١٠:٠٠ UTC+03؛ ليس بحثًا حيًا. مطابقة MAC للحوادث والتنبيهات
          والأحداث تعتمد على سجل الأصل الحالي، لا على عنوان مرصود في الحزمة.
        </p>
      </details>
      <div className="search-count" role="status" aria-live="polite">
        <Search size={14} />
        <span>{ar(filtered.length)} نتيجة في العرض التجريبي</span>
      </div>
      {filtered.length ? (
        <div className="search-results">
          {grouped.map(group => (
            <section
              className="search-result-group"
              key={group.id}
              aria-label={`نتائج ${group.label}`}
            >
              <h3>
                {group.label} <span>{ar(group.items.length)}</span>
              </h3>
              {group.items.map(record => (
                <button
                  type="button"
                  data-command-result
                  key={`${record.kind}-${record.id}`}
                  onClick={() => choose(record)}
                >
                  <span className="result-type">{labels[record.kind]}</span>
                  <span>
                    <strong>{record.title}</strong>
                    <small>
                      <bdi dir="ltr">{record.id}</bdi> · <bdi dir="auto">{record.sub}</bdi>
                      {(record.matchedMac || record.mac) &&
                        (['asset', 'source'].includes(record.kind) || record.matchedMac) && (
                          <>
                            {' '}
                            · {record.kind === 'source' ? 'MAC الواجهة' : 'MAC الأصل'}{' '}
                            <bdi dir="ltr">{record.matchedMac || record.mac}</bdi>
                          </>
                        )}{' '}
                      · {record.timeLabel}
                    </small>
                  </span>
                  {record.severity && <Severity value={record.severity} />}
                  <ArrowLeft size={16} />
                </button>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="search-hint">
          لا توجد نتائج مطابقة في العينة. غيّر الكلمات أو أزل بعض المرشحات.
        </div>
      )}
    </div>
  );
}
