import React, { useState } from 'react';
import { ChevronLeft, Database, Download, Shield, SlidersHorizontal } from 'lucide-react';
import {
  ar,
  Button,
  FormField,
  ltr,
  NativeSelect,
  PageHeading,
  Panel,
  PanelHeading,
  Select,
  Status,
  Table,
  Tag,
  TextInput,
} from '../../shared/ui/index';
import { events } from '../../data/fixtures/demo-records';
import { inPeriod, recordTime } from '../../shared/lib/time-scope';
import HuntWorkspace from './HuntWorkspace';

import { TableViews, useTableColumns } from '../../shared/components/TableViews';
import NamedViews from '../../shared/components/NamedViews';

import { useSessionValue } from '../../shared/hooks/session-state';
import { eventExportSchema } from '../export/export-schema';
import { oneOf, matches, FilterBar, ResultCount, Row } from '../operations/OperationsTable';
const eventColumns = [
  ['time', 'الوقت المحلي'],
  ['source', 'المصدر'],
  ['category', 'نوع الحدث'],
  ['src', 'عنوان المصدر'],
  ['dst', 'عنوان الوجهة'],
  ['asset', 'الأصل'],
  ['outcome', 'النتيجة'],
  ['actions', 'الإجراء'],
].map(([id, label]) => ({ id, label }));
export function Events({ data, openDetail, exportData, notify, timeRange = '24h', sessionRef }) {
  const [q, setQ] = useSessionValue(sessionRef, 'events', 'q', ''),
    [src, setSrc] = useSessionValue(sessionRef, 'events', 'src', 'all'),
    [method, setMethod] = useSessionValue(sessionRef, 'events', 'method', 'all'),
    [outcome, setOutcome] = useSessionValue(sessionRef, 'events', 'outcome', 'all'),
    [advanced, setAdvanced] = useSessionValue(sessionRef, 'events', 'advanced', false),
    [from, setFrom] = useSessionValue(sessionRef, 'events', 'from', ''),
    [to, setTo] = useSessionValue(sessionRef, 'events', 'to', ''),
    [asset, setAsset] = useSessionValue(sessionRef, 'events', 'asset', 'all'),
    [eventType, setEventType] = useSessionValue(sessionRef, 'events', 'eventType', 'all'),
    [user, setUser] = useSessionValue(sessionRef, 'events', 'user', ''),
    [sort, setSort] = useSessionValue(sessionRef, 'events', 'sort', 'newest');
  const [saved, setSaved] = useState(null),
    cols = useTableColumns(eventColumns, sessionRef, 'events'),
    shown = cols.ordered.filter(c => cols.visible.includes(c.id));
  const clearFilters = () => {
    setQ('');
    setSrc('all');
    setMethod('all');
    setOutcome('all');
    setFrom('');
    setTo('');
    setAsset('all');
    setEventType('all');
    setUser('');
  };
  const filters = [
    { id: 'q', label: 'البحث', value: q, active: !!q.trim(), clear: () => setQ('') },
    {
      id: 'src',
      label: 'المصدر',
      value: data.sources.find(s => s.id === src)?.name || src,
      active: src !== 'all',
      clear: () => setSrc('all'),
    },
    {
      id: 'outcome',
      label: 'النتيجة',
      value: outcome,
      active: outcome !== 'all',
      clear: () => setOutcome('all'),
    },
    {
      id: 'method',
      label: 'طريقة الجمع',
      value: method,
      active: method !== 'all',
      clear: () => setMethod('all'),
    },
    { id: 'from', label: 'من', value: from, active: !!from, clear: () => setFrom('') },
    { id: 'to', label: 'إلى', value: to, active: !!to, clear: () => setTo('') },
    {
      id: 'asset',
      label: 'الأصل',
      value: asset,
      active: asset !== 'all',
      clear: () => setAsset('all'),
    },
    {
      id: 'eventType',
      label: 'نوع الحدث',
      value: eventType,
      active: eventType !== 'all',
      clear: () => setEventType('all'),
    },
    { id: 'user', label: 'المستخدم', value: user, active: !!user, clear: () => setUser('') },
  ];
  const save = () => {
    setSaved({
      q,
      src,
      method,
      outcome,
      advanced,
      from,
      to,
      asset,
      eventType,
      user,
      sort,
      visible: [...cols.visible],
      order: [...cols.order],
    });
    notify('حُفظ العرض في ذاكرة هذه الصفحة فقط.', 'success');
  };
  const restore = () => {
    if (!saved) return;
    setQ(saved.q);
    setSrc(saved.src);
    setMethod(saved.method);
    setOutcome(saved.outcome);
    setAdvanced(saved.advanced);
    setFrom(saved.from);
    setTo(saved.to);
    setAsset(saved.asset);
    setEventType(saved.eventType);
    setUser(saved.user);
    setSort(saved.sort || 'newest');
    cols.setVisible([...saved.visible]);
    cols.setOrder(saved.order || []);
    notify('استُعيد العرض المؤقت.', 'success');
  };
  const enrichedEvents = events
    .filter(x => inPeriod(x, 'event', timeRange))
    .map(x => ({
      ...x,
      sourceLabel: data.sources.find(source => source.id === x.sourceId)?.name || 'مصدر غير محدد',
    }));
  const rows = [...enrichedEvents]
    .sort(
      (a, b) =>
        (sort === 'oldest' ? 1 : -1) *
        ((recordTime(a, 'event') ?? 0) - (recordTime(b, 'event') ?? 0)),
    )
    .filter(x => {
      const stamp = `2026-10-29T${x.time.slice(0, 5)}`;
      return (
        matches(x, q) &&
        (src === 'all' || x.sourceId === src) &&
        (method === 'all' || x.collectionMethod === method) &&
        (outcome === 'all' || x.outcome === outcome) &&
        (!from || stamp >= from) &&
        (!to || stamp <= to) &&
        (asset === 'all' || x.asset === asset) &&
        (eventType === 'all' || x.category === eventType) &&
        (!user || x.user.toLowerCase().includes(user.toLowerCase()))
      );
    });
  return (
    <>
      <PageHeading
        title="مستكشف الأحداث"
        subtitle="ابحث في الأحداث الموحّدة، وافحص السياق دون مغادرة المنصة."
        actions={
          <Button
            icon={Download}
            onClick={() =>
              exportData('الأحداث', rows, {
                allRows: enrichedEvents,
                allRowsLabel: 'كل سجلات الفترة العامة',
                columns: eventExportSchema,
                visibleColumns: cols.visible,
              })
            }
          >
            تصدير النتائج
          </Button>
        }
      />
      <div className="page-intro-strip">
        <div className="strip-icon blue">
          <Database size={20} />
        </div>
        <div>
          <strong>من مصادر متعددة إلى سياق موحّد</strong>
          <p>عينة أحداث مطبّعة وفق حقول موحّدة، مع حفظ الوقت الأصلي وتوقيت UTC.</p>
        </div>
        <span className="strip-label">EVENT EXPLORER</span>
      </div>
      <HuntWorkspace openDetail={openDetail} timeRange={timeRange} />
      <Panel className="data-panel">
        <PanelHeading
          title="سجلات الأحداث"
          subtitle="الأحدث أولًا · بيانات وصفية فقط دون محتوى الحزم"
          aside={<Tag color="blue">{ar(rows.length)} سجل</Tag>}
        />
        <FilterBar
          search={q}
          setSearch={setQ}
          placeholder="بحث بالمصدر، المستخدم، الأصل أو نوع الحدث"
          onReset={clearFilters}
        >
          <Select value={src} onChange={setSrc} ariaLabel="مصدر البيانات">
            <option value="all">كل المصادر</option>
            {data.sources.map(s => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select value={outcome} onChange={setOutcome} ariaLabel="نتيجة الحدث">
            <option value="all">كل النتائج</option>
            <option>ناجح</option>
            <option>فشل</option>
          </Select>
          <Button icon={SlidersHorizontal} onClick={() => setAdvanced(v => !v)}>
            {advanced ? 'إخفاء المرشحات' : 'تصفية متقدمة'}
          </Button>
        </FilterBar>
        {advanced && (
          <div className="advanced-filters">
            <FormField label="من · الوقت المحلي">
              <TextInput
                type="datetime-local"
                dir="ltr"
                value={from}
                onChange={e => setFrom(e.target.value)}
              />
            </FormField>
            <FormField label="إلى · الوقت المحلي">
              <TextInput
                type="datetime-local"
                dir="ltr"
                value={to}
                onChange={e => setTo(e.target.value)}
              />
            </FormField>
            <FormField label="طريقة جمع البيانات">
              <NativeSelect value={method} onChange={e => setMethod(e.target.value)}>
                <option value="all">كل طرق الجمع</option>
                {['Zeek', 'Suricata', 'Syslog', 'NetFlow'].map(s => (
                  <option key={s}>{s}</option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="الأصل">
              <NativeSelect value={asset} onChange={e => setAsset(e.target.value)}>
                <option value="all">كل الأصول</option>
                {[...new Set(events.map(x => x.asset))].map(x => (
                  <option key={x}>{x}</option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="نوع الحدث">
              <NativeSelect value={eventType} onChange={e => setEventType(e.target.value)}>
                <option value="all">كل الأنواع</option>
                {[...new Set(events.map(x => x.category))].map(x => (
                  <option key={x}>{x}</option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="المستخدم">
              <TextInput
                dir="ltr"
                value={user}
                onChange={e => setUser(e.target.value)}
                placeholder="user-name"
              />
            </FormField>
            <span className="advanced-note">الوقت المحلي للعينة: UTC+03 · ٢٩ أكتوبر ٢٠٢٦</span>
          </div>
        )}
        <TableViews
          columns={eventColumns}
          visible={cols.visible}
          onToggle={cols.toggle}
          filters={filters}
          onClearAll={clearFilters}
          onSave={save}
          onRestore={restore}
          saved={!!saved}
          order={cols.order}
          onMove={cols.move}
        />
        <div className="professional-sort">
          <label>
            ترتيب الأحداث{' '}
            <select aria-label="ترتيب الأحداث" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="newest">الأحدث أولًا</option>
              <option value="oldest">الأقدم أولًا</option>
            </select>
          </label>
        </div>
        <NamedViews
          scope="events"
          current={{ method, outcome, sort, visible: cols.visible, order: cols.order }}
          onApply={v => {
            clearFilters();
            setMethod(oneOf(v.method, ['all', 'Zeek', 'Suricata', 'Syslog', 'NetFlow']));
            setOutcome(oneOf(v.outcome, ['all', 'ناجح', 'فشل']));
            setSort(oneOf(v.sort, ['newest', 'oldest'], 'newest'));
            setAdvanced(v.method && v.method !== 'all');
            cols.setVisible(v.visible || eventColumns.map(c => c.id));
            cols.setOrder(v.order || eventColumns.map(c => c.id));
          }}
          sessionRef={sessionRef}
          presets={[{ name: 'الأحداث الفاشلة', value: { outcome: 'فشل' } }]}
        />
        <Table head={shown.map(c => c.label)} empty={rows.length === 0}>
          {rows.map(x => {
            const cells = {
              time: ltr(x.time, 'mono'),
              source: (
                <div className="event-source-cell">
                  <strong>{x.sourceLabel}</strong>
                  <small>
                    طريقة الجمع: <bdi dir="ltr">{x.collectionMethod}</bdi>
                  </small>
                </div>
              ),
              category: (
                <>
                  <strong>{x.category}</strong>
                  <small className="record-id" dir="ltr">
                    {x.id}
                  </small>
                </>
              ),
              src: ltr(x.src, 'mono'),
              dst: ltr(x.dst, 'mono'),
              asset: ltr(x.asset, 'mono'),
              outcome: <Status value={x.outcome} />,
              actions: (
                <button type="button" className="table-arrow" aria-label={`فتح ${x.id}`}>
                  <ChevronLeft size={16} />
                </button>
              ),
            };
            return (
              <Row key={x.id} onClick={() => openDetail('event', x.id)}>
                {shown.map(c => (
                  <td key={c.id}>{cells[c.id]}</td>
                ))}
              </Row>
            );
          })}
        </Table>
        <ResultCount count={rows.length} total={enrichedEvents.length} />
      </Panel>
      <div className="page-footnote">
        <Shield size={14} /> لا تتضمن هذه العينة حمولات الحزم أو بيانات شخصية حساسة.
      </div>
    </>
  );
}
