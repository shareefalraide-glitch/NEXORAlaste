import React, { useEffect, useRef, useState } from 'react';
import { BellRing, ChevronLeft, Download, ListChecks } from 'lucide-react';
import {
  ar,
  Button,
  ltr,
  PageHeading,
  Panel,
  PanelHeading,
  Select,
  Severity,
  Status,
  Table,
  Tag,
} from '../../shared/ui/index';

import { inPeriod, recordTime } from '../../shared/lib/time-scope';

import { StackedBar } from '../../shared/charts/Visuals';
import { TableViews, useTableColumns } from '../../shared/components/TableViews';
import NamedViews from '../../shared/components/NamedViews';

import { useSessionValue } from '../../shared/hooks/session-state';
import { alertExportSchema } from '../export/export-schema';
import { oneOf, matches, FilterBar, ResultCount, Row, Score } from '../operations/OperationsTable';
const alertColumns = [
  ['title', 'التنبيه'],
  ['severity', 'الخطورة'],
  ['score', 'الدرجة'],
  ['asset', 'الأصل'],
  ['source', 'عنوان المصدر'],
  ['status', 'الحالة'],
  ['owner', 'المسؤول'],
  ['time', 'الوقت'],
  ['actions', 'الإجراء'],
].map(([id, label]) => ({ id, label }));
export function Alerts({
  data,
  openDetail,
  openModal,
  exportData,
  notify,
  offlineSimulation,
  timeRange = '24h',
  sessionRef,
}) {
  const [q, setQ] = useSessionValue(sessionRef, 'alerts', 'q', ''),
    [sev, setSev] = useSessionValue(sessionRef, 'alerts', 'sev', 'all'),
    [status, setStatus] = useSessionValue(sessionRef, 'alerts', 'status', 'all'),
    [groupBy, setGroupBy] = useSessionValue(sessionRef, 'alerts', 'groupBy', 'none'),
    [sort, setSort] = useSessionValue(sessionRef, 'alerts', 'sort', 'original'),
    [saved, setSaved] = useState(null),
    [collapsed, setCollapsed] = useState([]);
  const cols = useTableColumns(alertColumns, sessionRef, 'alerts'),
    shown = cols.ordered.filter(c => cols.visible.includes(c.id));
  const clearFilters = () => {
    setQ('');
    setSev('all');
    setStatus('all');
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
  ];
  const save = () => {
    setSaved({ q, sev, status, groupBy, sort, visible: [...cols.visible], order: [...cols.order] });
    notify('حُفظ العرض في ذاكرة هذه الصفحة فقط.', 'success');
  };
  const restore = () => {
    if (!saved) return;
    setQ(saved.q);
    setSev(saved.sev);
    setStatus(saved.status);
    setGroupBy(saved.groupBy || 'none');
    setSort(saved.sort || 'original');
    cols.setVisible([...saved.visible]);
    cols.setOrder(saved.order || []);
    notify('استُعيد العرض المؤقت.', 'success');
  };
  const scopedAlerts = data.alerts.filter(x => inPeriod(x, 'alert', timeRange));
  const rows = scopedAlerts.filter(
    x =>
      matches(x, q) &&
      (sev === 'all' || x.severity === sev) &&
      (status === 'all' || x.status === status),
  );
  if (sort === 'score') rows.sort((a, b) => b.score - a.score);
  else if (sort === 'recent')
    rows.sort(
      (a, b) => (recordTime(b, 'alert') ?? -Infinity) - (recordTime(a, 'alert') ?? -Infinity),
    );
  const namedValue = { sev, status, groupBy, sort, visible: cols.visible, order: cols.order };
  const applyNamed = v => {
    setQ('');
    setSev(oneOf(v.sev, ['all', 'حرجة', 'عالية', 'متوسطة']));
    setStatus(oneOf(v.status, ['all', 'جديد', 'قيد المراجعة', 'تمت المراجعة']));
    setGroupBy(oneOf(v.groupBy, ['none', 'asset', 'source'], 'none'));
    setSort(oneOf(v.sort, ['original', 'score', 'recent'], 'original'));
    cols.setVisible(v.visible || alertColumns.map(c => c.id));
    cols.setOrder(v.order || alertColumns.map(c => c.id));
  };
  const [selected, setSelected] = useState([]),
    selectAllRef = useRef(null);
  useEffect(() => setSelected([]), [q, sev, status, timeRange]);
  useEffect(() => setCollapsed([]), [groupBy, q, sev, status]);
  const chosen = rows.filter(row => selected.includes(row.id)),
    allSelected = rows.length > 0 && chosen.length === rows.length;
  useEffect(() => {
    if (selectAllRef.current)
      selectAllRef.current.indeterminate = chosen.length > 0 && !allSelected;
  }, [chosen.length, allSelected]);
  const toggleAll = () => setSelected(allSelected ? [] : rows.map(row => row.id));
  const toggleOne = id =>
    setSelected(current =>
      current.includes(id) ? current.filter(x => x !== id) : [...current, id],
    );
  const launchBulk = type => {
    if (type === 'independentTriage' && chosen.length > 50) {
      notify('اختر ٥٠ تنبيهًا أو أقل للمراجعة المستقلة.', 'error');
      return;
    }
    openModal(type, { ids: chosen.map(x => x.id), onComplete: () => setSelected([]) });
  };
  const alertSegments = [
    ['حرجة', 'var(--nx-chart-red)'],
    ['عالية', 'var(--nx-chart-orange)'],
    ['متوسطة', 'var(--nx-chart-yellow)'],
  ].map(([label, color]) => ({
    label,
    color,
    value: data.alerts.filter(x => x.severity === label).length,
  }));
  const renderAlert = x => {
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
      source: ltr(x.source, 'mono cell-muted'),
      status: <Status value={x.status} />,
      owner: x.owner || 'غير مسند',
      time: <span className="cell-muted nowrap">{x.age}</span>,
      actions: (
        <button type="button" className="table-arrow" aria-label={`فتح ${x.id}`}>
          <ChevronLeft size={16} />
        </button>
      ),
    };
    return (
      <Row key={x.id} onClick={() => openDetail('alert', x.id)}>
        <td className="selection-cell">
          <label className="selection-hit" onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              aria-label={`تحديد ${x.id}`}
              checked={selected.includes(x.id)}
              onChange={() => toggleOne(x.id)}
            />
          </label>
        </td>
        {shown.map(c => (
          <td key={c.id}>{cells[c.id]}</td>
        ))}
      </Row>
    );
  };
  const grouped =
    groupBy === 'none'
      ? null
      : Object.entries(
          rows.reduce((result, row) => {
            const key = (groupBy === 'asset' ? row.asset : row.source) || 'غير محدد';
            (result[key] ??= []).push(row);
            return result;
          }, Object.create(null)),
        ).map(([key, items]) => {
          const expanded = !collapsed.includes(key),
            selectedCount = items.filter(item => selected.includes(item.id)).length;
          return {
            key,
            label: `${groupBy === 'asset' ? 'الأصل' : 'عنوان المصدر'} ${key}`,
            header: (
              <tr className="alert-group-row">
                <th scope="rowgroup" colSpan={shown.length + 1}>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() =>
                      setCollapsed(current =>
                        expanded ? [...current, key] : current.filter(x => x !== key),
                      )
                    }
                  >
                    <span>
                      <ChevronLeft size={16} className={expanded ? 'expanded' : ''} />
                      <strong>
                        {groupBy === 'asset' ? 'الأصل' : 'عنوان المصدر'}:{' '}
                        <bdi dir="auto">{key}</bdi>
                      </strong>
                    </span>
                    <small>
                      {ar(items.length)} تنبيه{selectedCount ? ` · ${ar(selectedCount)} محدد` : ''}
                    </small>
                  </button>
                </th>
              </tr>
            ),
            rows: expanded ? items.map(renderAlert) : [],
          };
        });
  return (
    <>
      <PageHeading
        title="التنبيهات"
        subtitle="راجع الإشارات الأمنية وافهم سبب الخطورة قبل اتخاذ القرار."
        actions={
          <Button
            icon={Download}
            onClick={() =>
              exportData('التنبيهات', rows, {
                allRows: scopedAlerts,
                allRowsLabel: 'كل سجلات الفترة العامة',
                columns: alertExportSchema,
                visibleColumns: cols.visible,
                selectedIds: chosen.map(x => x.id),
              })
            }
          >
            تصدير العينة
          </Button>
        }
      />
      <div className="page-intro-strip">
        <div className="strip-icon purple">
          <BellRing size={20} />
        </div>
        <div>
          <strong>قائمة فرز التنبيهات</strong>
          <p>
            تُدرج التنبيهات المتوسطة للفرز؛ وترتبط التنبيهات العالية والحرجة بالحوادث عند استيفاء
            شروط الربط.
          </p>
        </div>
        <span className="strip-label">ALERT TRIAGE</span>
      </div>
      <div className="viz-summary alert-profile">
        <div className="viz-summary-head">
          <div>
            <strong>توزيع التنبيهات المفصّلة</strong>
            <small>لقطة لجميع سجلات العينة؛ لا تتأثر بالفترة أو المرشحات</small>
          </div>
          <b>
            {ar(data.alerts.length)} <small>تنبيه مفصّل</small>
          </b>
        </div>
        <StackedBar segments={alertSegments} label="توزيع سجلات التنبيهات المفصّلة حسب الخطورة" />
        <div className="viz-summary-legend interactive">
          {alertSegments.map(s => (
            <button
              type="button"
              key={s.label}
              className={sev === s.label ? 'active' : ''}
              aria-pressed={sev === s.label}
              onClick={() => setSev(sev === s.label ? 'all' : s.label)}
              title="تصفية التنبيهات حسب الخطورة"
            >
              <i className="viz-dot" style={{ background: s.color }} />
              {s.label} <strong>{ar(s.value)}</strong>
            </button>
          ))}
          <span className="viz-review-count">
            <i className="viz-dot" />
            بانتظار المراجعة{' '}
            <strong>{ar(data.alerts.filter(x => x.status === 'جديد').length)}</strong>
          </span>
        </div>
      </div>
      <Panel className="data-panel">
        <PanelHeading
          title="جميع التنبيهات"
          subtitle="اختر تنبيهًا لمراجعة سياقه ومكوّنات درجته"
          aside={<Tag color="blue">{ar(rows.length)} نتيجة</Tag>}
        />
        <FilterBar
          search={q}
          setSearch={setQ}
          placeholder="بحث بالمعرّف أو الأصل أو عنوان IP"
          onReset={clearFilters}
        >
          <Select value={sev} onChange={setSev} ariaLabel="مستوى الخطورة">
            <option value="all">كل مستويات الخطورة</option>
            {['حرجة', 'عالية', 'متوسطة'].map(s => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Select value={status} onChange={setStatus} ariaLabel="حالة التنبيه">
            <option value="all">كل الحالات</option>
            {['جديد', 'قيد المراجعة', 'تمت المراجعة'].map(s => (
              <option key={s}>{s}</option>
            ))}
          </Select>
        </FilterBar>
        <TableViews
          columns={alertColumns}
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
            ترتيب التنبيهات{' '}
            <select
              aria-label="ترتيب التنبيهات"
              value={sort}
              onChange={e => setSort(e.target.value)}
            >
              <option value="original">ترتيب العينة</option>
              <option value="score">الأعلى درجة</option>
              <option value="recent">الأحدث أولًا</option>
            </select>
          </label>
        </div>
        <NamedViews
          scope="alerts"
          current={namedValue}
          onApply={applyNamed}
          sessionRef={sessionRef}
          presets={[{ name: 'التنبيهات الحرجة', value: { sev: 'حرجة' } }]}
        />
        <div className="alert-group-controls">
          <label>
            تجميع التنبيهات{' '}
            <select
              aria-label="تجميع التنبيهات"
              value={groupBy}
              onChange={e => setGroupBy(e.target.value)}
            >
              <option value="none">دون تجميع</option>
              <option value="asset">حسب الأصل</option>
              <option value="source">حسب عنوان المصدر</option>
            </select>
          </label>
          <small>
            {groupBy === 'none'
              ? 'تجميع بصري اختياري، دون دمج السجلات.'
              : 'التحديد والتصدير والإجراءات تشمل جميع النتائج المطابقة، حتى داخل المجموعات المطوية.'}
          </small>
        </div>
        <div className="bulk-toolbar">
          <div>
            <span className="bulk-icon">
              <ListChecks size={16} />
            </span>
            <span>
              <strong>{ar(chosen.length)} محدد من النتائج المعروضة</strong>
              <small>
                {offlineSimulation
                  ? 'الإجراءات للقراءة فقط أثناء محاكاة الانقطاع.'
                  : 'تغيير المرشحات يمسح الاختيار. «مراجعة المحدد» تغيّر الحالة فقط؛ الفرز المستقل يسجّل قرارًا وسببًا لكل تنبيه.'}
              </small>
            </span>
          </div>
          <div className="bulk-actions">
            <button type="button" onClick={toggleAll} disabled={!rows.length}>
              {allSelected ? 'إلغاء تحديد المعروض' : 'تحديد المعروض'}
            </button>
            <button
              type="button"
              className="independent-triage-launch"
              disabled={!chosen.length || offlineSimulation}
              onClick={() => launchBulk('independentTriage')}
            >
              فرز مستقل للمحدد
            </button>
            <button
              type="button"
              disabled={!chosen.length || offlineSimulation}
              onClick={() => launchBulk('bulkReview')}
            >
              مراجعة المحدد
            </button>
            <button
              type="button"
              disabled={!chosen.length || offlineSimulation}
              onClick={() => launchBulk('bulkAssign')}
            >
              إسناد المحدد
            </button>
          </div>
        </div>
        <Table
          head={[
            {
              label: 'تحديد',
              node: (
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label="تحديد جميع التنبيهات المعروضة"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={!rows.length}
                />
              ),
            },
            ...shown.map(c => c.label),
          ]}
          empty={rows.length === 0}
          groups={grouped}
        >
          {grouped ? null : rows.map(renderAlert)}
        </Table>
        <ResultCount count={rows.length} total={scopedAlerts.length} />
      </Panel>
    </>
  );
}
