import React, { useState } from 'react';
import { ChevronLeft, CircleHelp, Download, Plus } from 'lucide-react';
import {
  ar,
  Avatar,
  Button,
  ltr,
  PageHeading,
  Panel,
  PanelHeading,
  Select,
  Segmented,
  Severity,
  Status,
  ScrollArea,
  Table,
} from '../../shared/ui/index';

import { inPeriod, recordTime } from '../../shared/lib/time-scope';

import { ShiftHandover } from '../demo/ExperienceModules';

import { StackedBar } from '../../shared/charts/Visuals';
import { TableViews, useTableColumns } from '../../shared/components/TableViews';
import NamedViews from '../../shared/components/NamedViews';
import RecordComparison from '../../shared/components/RecordComparison';
import InvestigationTabs from '../investigations/workspace/InvestigationTabs';
import { useSessionValue } from '../../shared/hooks/session-state';
import { incidentExportSchema } from '../export/export-schema';
import { oneOf, matches, FilterBar, ResultCount, Row, Score } from '../operations/OperationsTable';
const incidentColumns = [
  ['title', 'الحادثة'],
  ['severity', 'الخطورة'],
  ['score', 'الدرجة'],
  ['asset', 'الأصل'],
  ['status', 'الحالة'],
  ['owner', 'المسؤول'],
  ['alerts', 'التنبيهات'],
  ['time', 'الوقت'],
  ['actions', 'الإجراء'],
].map(([id, label]) => ({ id, label }));
export function Incidents({
  data,
  openDetail,
  openModal,
  exportData,
  notify,
  offlineSimulation,
  timeRange = '24h',
  investigations,
  handoverDraft,
  setHandoverDraft,
  sessionRef,
  workspaceTabs,
}) {
  const [q, setQ] = useSessionValue(sessionRef, 'incidents', 'q', ''),
    [sev, setSev] = useSessionValue(sessionRef, 'incidents', 'sev', 'all'),
    [status, setStatus] = useSessionValue(sessionRef, 'incidents', 'status', 'all'),
    [view, setView] = useSessionValue(sessionRef, 'incidents', 'view', 'table'),
    [ownerMode, setOwnerMode] = useSessionValue(sessionRef, 'incidents', 'ownerMode', 'all'),
    [sort, setSort] = useSessionValue(sessionRef, 'incidents', 'sort', 'original'),
    [saved, setSaved] = useState(null);
  const columns = useTableColumns(incidentColumns, sessionRef, 'incidents'),
    shown = columns.ordered.filter(c => columns.visible.includes(c.id));
  const clearFilters = () => {
    setQ('');
    setSev('all');
    setStatus('all');
    setOwnerMode('all');
  };
  const filters = [
    { id: 'q', label: 'البحث', value: q, active: !!q.trim(), clear: () => setQ('') },
    { id: 'sev', label: 'الخطورة', value: sev, active: sev !== 'all', clear: () => setSev('all') },
    {
      id: 'status',
      label: 'الحالة',
      value: status,
      active: status !== 'all',
      clear: () => setStatus('all'),
    },
    {
      id: 'ownerMode',
      label: 'الإسناد',
      value: 'غير مسندة',
      active: ownerMode === 'unassigned',
      clear: () => setOwnerMode('all'),
    },
  ];
  const save = () => {
    setSaved({
      q,
      sev,
      status,
      view,
      ownerMode,
      sort,
      visible: [...columns.visible],
      order: [...columns.order],
    });
    notify('حُفظ العرض في ذاكرة هذه الصفحة فقط.', 'success');
  };
  const restore = () => {
    if (!saved) return;
    setQ(saved.q);
    setSev(saved.sev);
    setStatus(saved.status);
    setView(saved.view);
    setOwnerMode(saved.ownerMode || 'all');
    setSort(saved.sort || 'original');
    columns.setVisible([...saved.visible]);
    columns.setOrder(saved.order || []);
    notify('استُعيد العرض المؤقت.', 'success');
  };
  const scopedIncidents = data.incidents.filter(x => inPeriod(x, 'incident', timeRange));
  const rows = scopedIncidents.filter(
    x =>
      matches(x, q) &&
      (sev === 'all' || x.severity === sev) &&
      (status === 'all' || x.status === status) &&
      (ownerMode === 'all' || !x.owner || x.owner.includes('غير مسند')),
  );
  if (sort === 'score') rows.sort((a, b) => b.score - a.score);
  else if (sort === 'recent')
    rows.sort(
      (a, b) => (recordTime(b, 'incident') ?? -Infinity) - (recordTime(a, 'incident') ?? -Infinity),
    );
  const namedValue = {
    sev,
    status,
    view,
    ownerMode,
    sort,
    visible: columns.visible,
    order: columns.order,
  };
  const applyNamed = v => {
    setQ('');
    setSev(oneOf(v.sev, ['all', 'حرجة', 'عالية', 'متوسطة']));
    setStatus(
      oneOf(v.status, [
        'all',
        'جديدة',
        'مسندة',
        'قيد المعالجة',
        'محتواة',
        'معالجة',
        'مغلقة',
        'إنذار كاذب',
      ]),
    );
    setView(oneOf(v.view, ['table', 'board'], 'table'));
    setOwnerMode(oneOf(v.ownerMode, ['all', 'unassigned']));
    setSort(oneOf(v.sort, ['original', 'score', 'recent'], 'original'));
    columns.setVisible(v.visible || incidentColumns.map(c => c.id));
    columns.setOrder(v.order || incidentColumns.map(c => c.id));
  };
  const cols = ['جديدة', 'مسندة', 'قيد المعالجة', 'محتواة', 'معالجة', 'مغلقة'];
  const statusNames = [...cols, 'إنذار كاذب'];
  const statusColors = [
    'var(--nx-blue)',
    'var(--nx-purple)',
    'var(--nx-yellow)',
    'var(--nx-brand)',
    'var(--nx-green)',
    'var(--nx-tx3)',
    'var(--nx-orange)',
  ];
  const statusSegments = statusNames.map((label, i) => ({
    label,
    value: data.incidents.filter(x => x.status === label).length,
    color: statusColors[i],
  }));
  return (
    <>
      <PageHeading
        title="إدارة الحوادث"
        subtitle="من التنبيه الأول حتى الإغلاق، تتبّع كل خطوة في مكان واحد."
        actions={
          <>
            <Button
              icon={Download}
              onClick={() =>
                exportData('الحوادث', rows, {
                  allRows: scopedIncidents,
                  allRowsLabel: 'كل سجلات الفترة العامة',
                  columns: incidentExportSchema,
                  visibleColumns: columns.visible,
                })
              }
            >
              تصدير
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => openModal('newIncident')}>
              حادثة تجريبية
            </Button>
          </>
        }
      />
      <div className="incident-kpis">
        <div>
          <span>الحوادث المفتوحة</span>
          <strong>
            {ar(data.incidents.filter(x => !['مغلقة', 'إنذار كاذب'].includes(x.status)).length)}
          </strong>
          <small>حوادث ضمن العينة</small>
        </div>
        <div>
          <span>تحتاج إسنادًا</span>
          <strong>{ar(data.incidents.filter(x => x.status === 'جديدة').length)}</strong>
          <small>بانتظار أحد أعضاء الفريق</small>
        </div>
        <div>
          <span>تتطلب استجابة فورية</span>
          <strong className="red-text">
            {ar(
              data.incidents.filter(
                x => x.severity === 'حرجة' && !['مغلقة', 'إنذار كاذب'].includes(x.status),
              ).length,
            )}
          </strong>
          <small>حوادث حرجة</small>
        </div>
        <div>
          <span>متوسط زمن الإقرار</span>
          <strong>
            ٨ <small>دقائق</small>
          </strong>
          <small>مؤشر توضيحي</small>
        </div>
      </div>
      {workspaceTabs && (
        <InvestigationTabs
          shelf
          workspace={workspaceTabs.state}
          incidents={data.incidents}
          {...workspaceTabs}
        />
      )}
      <RecordComparison kind="incident" records={data.incidents} openDetail={openDetail} />
      <ShiftHandover
        data={data}
        openDetail={openDetail}
        timeRange={timeRange}
        offlineSimulation={offlineSimulation}
        investigations={investigations}
        handoverDraft={handoverDraft}
        setHandoverDraft={setHandoverDraft}
      />
      <div className="viz-summary incident-flow">
        <div className="viz-summary-head">
          <div>
            <strong>توزيع مراحل الحوادث</strong>
            <small>لقطة لجميع حوادث العينة؛ لا تتأثر بالفترة أو المرشحات</small>
          </div>
          <b>
            {ar(data.incidents.length)} <small>حادثة</small>
          </b>
        </div>
        <StackedBar segments={statusSegments} label="مراحل الحوادث في العينة" />
        <div className="viz-summary-legend interactive">
          {statusSegments.map(s => (
            <button
              type="button"
              key={s.label}
              className={status === s.label ? 'active' : ''}
              aria-pressed={status === s.label}
              onClick={() => setStatus(status === s.label ? 'all' : s.label)}
              title="تصفية الحوادث حسب المرحلة"
            >
              <i className="viz-dot" style={{ background: s.color }} />
              {s.label} <strong>{ar(s.value)}</strong>
            </button>
          ))}
        </div>
      </div>
      <Panel className="data-panel">
        <PanelHeading
          title="الحوادث"
          subtitle="تُجمع التنبيهات المترابطة في حادثة واحدة"
          aside={
            <Segmented
              items={[
                { value: 'table', label: 'قائمة' },
                { value: 'board', label: 'مراحل' },
              ]}
              value={view}
              onChange={setView}
            />
          }
        />
        <FilterBar
          search={q}
          setSearch={setQ}
          placeholder="بحث برقم الحادثة، الأصل، المسؤول..."
          onReset={clearFilters}
        >
          <Select value={sev} onChange={setSev} ariaLabel="الخطورة">
            <option value="all">كل مستويات الخطورة</option>
            {['حرجة', 'عالية', 'متوسطة'].map(s => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Select value={status} onChange={setStatus} ariaLabel="الحالة">
            <option value="all">كل الحالات</option>
            {statusNames.map(s => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Select value={ownerMode} onChange={setOwnerMode} ariaLabel="حالة الإسناد">
            <option value="all">كل حالات الإسناد</option>
            <option value="unassigned">غير مسندة</option>
          </Select>
        </FilterBar>
        <TableViews
          columns={incidentColumns}
          visible={columns.visible}
          onToggle={columns.toggle}
          filters={filters}
          onClearAll={clearFilters}
          onSave={save}
          onRestore={restore}
          saved={!!saved}
          order={columns.order}
          onMove={columns.move}
        />
        <div className="professional-sort">
          <label>
            ترتيب الحوادث{' '}
            <select aria-label="ترتيب الحوادث" value={sort} onChange={e => setSort(e.target.value)}>
              <option value="original">ترتيب العينة</option>
              <option value="score">الأعلى درجة</option>
              <option value="recent">الأحدث أولًا</option>
            </select>
          </label>
        </div>
        <NamedViews
          scope="incidents"
          current={namedValue}
          onApply={applyNamed}
          sessionRef={sessionRef}
          presets={[
            { name: 'حوادث غير مسندة', value: { ownerMode: 'unassigned' } },
            { name: 'الحوادث الحرجة', value: { sev: 'حرجة' } },
          ]}
        />
        {view === 'table' ? (
          <>
            <Table head={shown.map(c => c.label)} empty={rows.length === 0}>
              {rows.map((x, i) => {
                const cells = {
                  title: (
                    <div className="record-title">
                      <strong>{x.title}</strong>
                      {ltr(x.id, 'record-id')}
                    </div>
                  ),
                  severity: <Severity value={x.severity} />,
                  score: <Score score={x.score} />,
                  asset: ltr(x.asset, 'mono'),
                  status: <Status value={x.status} />,
                  owner: (
                    <div className="owner-cell">
                      <Avatar name={x.owner} small tone={i % 2 ? 'purple' : 'blue'} />
                      {x.owner}
                    </div>
                  ),
                  alerts: ar(x.alerts),
                  time: <span className="cell-muted nowrap">{x.age}</span>,
                  actions: (
                    <button type="button" className="table-arrow" aria-label={`فتح ${x.id}`}>
                      <ChevronLeft size={16} />
                    </button>
                  ),
                };
                return (
                  <Row key={x.id} onClick={() => openDetail('incident', x.id)}>
                    {shown.map(c => (
                      <td key={c.id}>{cells[c.id]}</td>
                    ))}
                  </Row>
                );
              })}
            </Table>
            <ResultCount count={rows.length} total={scopedIncidents.length} />
          </>
        ) : (
          <ScrollArea className="kanban" label="مراحل الحوادث" hint="مرّر أفقيًا لعرض بقية المراحل">
            {statusNames.map(col => (
              <div className="kanban-col" key={col}>
                <div className="kanban-title">
                  <span>{col}</span>
                  <b>{ar(rows.filter(x => x.status === col).length)}</b>
                </div>
                {rows
                  .filter(x => x.status === col)
                  .map(x => (
                    <button
                      className="kanban-card"
                      key={x.id}
                      onClick={() => openDetail('incident', x.id)}
                    >
                      <span dir="ltr" className="record-id">
                        {x.id}
                      </span>
                      <strong>{x.title}</strong>
                      <div>
                        <Severity value={x.severity} />
                        <span dir="ltr" className="mono">
                          {x.asset}
                        </span>
                      </div>
                    </button>
                  ))}
                {rows.filter(x => x.status === col).length === 0 && (
                  <span className="kanban-empty">لا توجد حوادث</span>
                )}
              </div>
            ))}
          </ScrollArea>
        )}
      </Panel>
      <div className="page-footnote">
        <CircleHelp size={14} /> الانتقال المباشر من «جديدة» إلى «مغلقة» غير متاح. لا يُنفذ أي
        احتواء حقيقي في هذه الواجهة.
      </div>
    </>
  );
}
