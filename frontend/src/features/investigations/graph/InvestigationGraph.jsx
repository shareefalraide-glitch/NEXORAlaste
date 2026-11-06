import { useLandmarkScope } from '../../../shared/hooks/landmark-scope';
import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Boxes,
  CircleHelp,
  Database,
  FileSearch,
  Fingerprint,
  GitBranch,
  Network,
  Pin,
  PinOff,
  RotateCcw,
  Search,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { events } from '../../../data/fixtures/demo-records';
import { buildAnalystGraph, graphLayers, graphNeighbors } from './analyst-graph';
import { localSampleTime } from '../../../shared/lib/time-scope';
import { ar, Button, InfoBox, Tag } from '../../../shared/ui/index';

const LIMIT = 24,
  MAX_PINNED = 8;
const meta = {
  incident: { label: 'حادثة', icon: ShieldAlert },
  alert: { label: 'تنبيه', icon: ShieldAlert },
  event: { label: 'حدث', icon: FileSearch },
  asset: { label: 'أصل', icon: Boxes },
  source: { label: 'مصدر بيانات', icon: Database },
  ip: { label: 'عنوان IP', icon: Network },
  user: { label: 'اسم مستخدم', icon: UserRound },
};
const label = node =>
  `${meta[node.kind]?.label || 'سجل'} ${node.title} ${node.id === node.title ? '' : node.id}`.trim();
function initialView(graph, preferred, pins = []) {
  const root =
    graph.nodes.find(node => node.key === preferred)?.key ||
    graph.nodes.find(node => node.key === 'incident:INC-2026-084')?.key ||
    graph.nodes[0]?.key;
  const visible = root
    ? [...new Set([root, ...pins, ...graphNeighbors(graph, root).map(x => x.node.key)])].slice(
        0,
        LIMIT,
      )
    : [];
  return {
    root,
    selected: root,
    visible: [...new Set(visible)],
    pinned: pins,
    marked: [],
    search: '',
    searchType: 'all',
    relationType: 'all',
    selectedEdge: '',
  };
}
function cleanView(graph, view, anchor) {
  const keys = new Set(graph.nodes.map(n => n.key)),
    fallback = initialView(graph, anchor);
  if (!view || !keys.has(view.root)) return fallback;
  const pinned = [...new Set(Array.isArray(view.pinned) ? view.pinned : [])]
    .filter(k => keys.has(k))
    .slice(0, MAX_PINNED);
  const visible = [
    ...new Set([view.root, ...pinned, ...(Array.isArray(view.visible) ? view.visible : [])]),
  ]
    .filter(k => keys.has(k))
    .slice(0, LIMIT);
  const marked = [...new Set(Array.isArray(view.marked) ? view.marked : [])].filter(
    k => visible.includes(k) && k !== view.root && !pinned.includes(k),
  );
  const relationType = graph.edges.some(edge => edge.relation === view.relationType)
    ? view.relationType
    : 'all';
  const selectedEdge = graph.edges.some(
    edge =>
      edge.key === view.selectedEdge && (relationType === 'all' || edge.relation === relationType),
  )
    ? view.selectedEdge
    : '';
  return {
    root: view.root,
    selected: visible.includes(view.selected) ? view.selected : view.root,
    visible,
    pinned,
    marked,
    search: typeof view.search === 'string' ? view.search.slice(0, 120) : '',
    searchType: meta[view.searchType] ? view.searchType : 'all',
    relationType,
    selectedEdge,
  };
}

export default function InvestigationGraph({
  data,
  graphData,
  openDetail,
  timeRange = '24h',
  anchor,
  savedView,
  onViewChange,
  compact = false,
}) {
  const landmark = useLandmarkScope();
  const Heading = compact ? 'h3' : 'h2';
  const graph = useMemo(
    () => graphData || buildAnalystGraph(data, events, timeRange),
    [graphData, data, timeRange],
  );
  const [local, setLocal] = useState(() => cleanView(graph, savedView, anchor)),
    [notice, setNotice] = useState(''),
    manageSummary = useRef(null);
  const view = cleanView(graph, local, anchor),
    nodes = graph.nodes.filter(n => view.visible.includes(n.key));
  const active = graph.nodes.find(n => n.key === view.selected),
    neighbors = active
      ? graphNeighbors(graph, active.key).filter(
          item => view.relationType === 'all' || item.edge.relation === view.relationType,
        )
      : [];
  const relationshipTypes = [...new Set(graph.edges.map(edge => edge.relation))],
    selectedEdge = graph.edges.find(edge => edge.key === view.selectedEdge),
    edgeA = selectedEdge && graph.nodes.find(node => node.key === selectedEdge.a),
    edgeB = selectedEdge && graph.nodes.find(node => node.key === selectedEdge.b);
  const hidden = [
    ...new Map(
      neighbors.filter(x => !view.visible.includes(x.node.key)).map(x => [x.node.key, x.node]),
    ).values(),
  ];
  const edges = graph.edges.filter(
    e =>
      view.visible.includes(e.a) &&
      view.visible.includes(e.b) &&
      (view.relationType === 'all' || e.relation === view.relationType),
  );
  const commit = next => {
    const clean = cleanView(graph, next, anchor);
    setLocal(clean);
    onViewChange?.(clean);
  };
  const changeRoot = key => {
    const next = initialView(graph, key, view.pinned);
    commit({
      ...next,
      search: view.search,
      searchType: view.searchType,
      relationType: view.relationType,
    });
    setNotice('أُعيد الرسم مع الاحتفاظ بالعقد المثبّتة؛ لم تُحذف سجلات.');
  };
  const expand = () => {
    const room = Math.max(0, LIMIT - view.visible.length),
      additions = hidden.slice(0, room).map(node => node.key);
    commit({ ...view, visible: [...view.visible, ...additions] });
    setNotice(
      additions.length < hidden.length
        ? `أُضيفت ${ar(additions.length)} عقدة؛ بقي ${ar(hidden.length - additions.length)} بسبب الحد.`
        : `أُضيفت ${ar(additions.length)} عقدة من العلاقات المباشرة.`,
    );
  };
  const chooseNode = node => {
    if (!view.visible.includes(node.key) && view.visible.length >= LIMIT) {
      setNotice('بلغ الرسم حد العرض؛ أخفِ عقدة غير مثبّتة أولًا.');
      return;
    }
    commit({ ...view, selected: node.key, visible: [...view.visible, node.key] });
  };
  const togglePin = () => {
    if (view.pinned.includes(active.key)) {
      commit({ ...view, pinned: view.pinned.filter(key => key !== active.key) });
      setNotice('أُلغي تثبيت العقدة.');
      return;
    }
    if (view.pinned.length >= MAX_PINNED) {
      setNotice(`الحد ${ar(MAX_PINNED)} عقد مثبّتة؛ ألغِ تثبيت واحدة أولًا.`);
      return;
    }
    commit({
      ...view,
      pinned: [...view.pinned, active.key],
      marked: view.marked.filter(key => key !== active.key),
    });
    setNotice('ثُبّتت العقدة في الرسم خلال الجلسة.');
  };
  const hideMarked = () => {
    const remove = new Set(
      view.marked.filter(key => key !== view.root && !view.pinned.includes(key)),
    );
    if (!remove.size) return;
    commit({
      ...view,
      visible: view.visible.filter(key => !remove.has(key)),
      selected: remove.has(view.selected) ? view.root : view.selected,
      marked: [],
    });
    setNotice(`أُخفيت ${ar(remove.size)} عقدة من العرض فقط؛ لم تُحذف السجلات.`);
    requestAnimationFrame(() => manageSummary.current?.focus());
  };
  const layers = graphLayers(view.root, view.visible, edges),
    maxLayer = Math.max(1, ...layers.map(l => l.keys.length)),
    height = Math.max(270, maxLayer * 82 + 36),
    coords = new Map();
  layers.forEach((layer, i) =>
    layer.keys.forEach((key, j) =>
      coords.set(key, {
        x: layers.length === 1 ? 500 : 905 - (i * 810) / (layers.length - 1),
        y: ((j + 1) * height) / (layer.keys.length + 1),
      }),
    ),
  );
  const connected = edges.flatMap(edge => {
    const a = coords.get(edge.a),
      b = coords.get(edge.b);
    if (!a || !b) return [];
    const mid = (a.x + b.x) / 2;
    return [{ ...edge, path: `M${a.x},${a.y} C${mid},${a.y} ${mid},${b.y} ${b.x},${b.y}` }];
  });
  const q = view.search.trim().toLocaleLowerCase();
  const results = q
    ? graph.nodes.filter(
        node =>
          (view.searchType === 'all' || node.kind === view.searchType) &&
          `${node.id} ${node.title} ${node.subtitle || ''} ${meta[node.kind]?.label || ''}`
            .toLocaleLowerCase()
            .includes(q),
      )
    : [];
  if (!active)
    return (
      <section className="analyst-graph">
        <InfoBox>لا توجد سجلات متاحة لبدء الاستكشاف في هذه العينة.</InfoBox>
      </section>
    );
  return (
    <section
      className={`analyst-graph ${compact ? 'analyst-graph-compact' : ''}`}
      aria-label={landmark('مستكشف التحقيق التفاعلي')}
      tabIndex={-1}
    >
      <div className="analyst-graph-heading">
        <div>
          <span>
            <GitBranch size={16} /> مستكشف التحقيق
          </span>
          <Heading>وسّع العلاقات خطوة بخطوة</Heading>
          <p>اختر عقدة، ثم أظهر جيرانها وافتح السجل الذي تستند إليه العلاقة.</p>
        </div>
        <Tag color="blue">عينة محلية</Tag>
      </div>
      <div className="analyst-graph-toolbar">
        <label>
          سجل البداية
          <select
            aria-label="بداية مستكشف التحقيق"
            value={view.root}
            onChange={e => changeRoot(e.target.value)}
          >
            {Object.entries(meta).map(([kind, entry]) => {
              const options = graph.nodes.filter(node => node.kind === kind);
              return options.length ? (
                <optgroup label={entry.label} key={kind}>
                  {options.map(node => (
                    <option key={node.key} value={node.key}>
                      {node.id} · {node.title}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </select>
        </label>
        <label>
          نوع العلاقة
          <select
            aria-label="تصفية نوع العلاقات"
            value={view.relationType}
            onChange={event => {
              commit({ ...view, relationType: event.target.value, selectedEdge: '' });
              setNotice('تصفية للعرض فقط؛ لم تتغير السجلات أو العقد.');
            }}
          >
            <option value="all">كل أنواع العلاقات</option>
            {relationshipTypes.map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" icon={RotateCcw} onClick={() => changeRoot(view.root)}>
          إعادة الرسم
        </Button>
      </div>
      <div className="graph-search">
        <label>
          <Search size={15} />
          <input
            aria-label="البحث في عقد التحقيق"
            value={view.search}
            maxLength={120}
            placeholder="ابحث بمعرّف أو اسم عقدة…"
            onChange={event => commit({ ...view, search: event.target.value })}
          />
        </label>
        <select
          aria-label="نوع نتائج بحث العقد"
          value={view.searchType}
          onChange={event => commit({ ...view, searchType: event.target.value })}
        >
          <option value="all">كل الأنواع</option>
          {Object.entries(meta).map(([kind, entry]) => (
            <option value={kind} key={kind}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>
      {q && (
        <div
          className="graph-search-results"
          role="region"
          aria-label={landmark('نتائج البحث في العقد')}
        >
          <div>
            <strong>{ar(results.length)} نتيجة</strong>
            <small>إضافة نتيجة لا تنشئ علاقة جديدة؛ قد تظهر منفصلة.</small>
          </div>
          {results.length ? (
            <ul>
              {results.slice(0, 12).map(node => {
                const isVisible = view.visible.includes(node.key),
                  connectedToView = graph.edges.some(
                    edge =>
                      (view.relationType === 'all' || edge.relation === view.relationType) &&
                      ((edge.a === node.key && view.visible.includes(edge.b)) ||
                        (edge.b === node.key && view.visible.includes(edge.a))),
                  );
                return (
                  <li key={node.key}>
                    <button
                      type="button"
                      disabled={!isVisible && view.visible.length >= LIMIT}
                      aria-label={`تحديد نتيجة ${label(node)}`}
                      onClick={() => {
                        chooseNode(node);
                        setNotice(
                          isVisible
                            ? 'حُدّدت عقدة معروضة.'
                            : connectedToView
                              ? 'أُضيفت النتيجة مع العلاقات الموجودة في العينة فقط.'
                              : 'أُضيفت نتيجة منفصلة؛ لا توجد علاقة معروضة تربطها بالرسم الحالي.',
                        );
                      }}
                    >
                      <span>
                        <strong dir="auto">{node.title}</strong>
                        <small>
                          {meta[node.kind]?.label} · <bdi dir="ltr">{node.id}</bdi>
                        </small>
                      </span>
                      <small>{isVisible ? 'معروضة' : connectedToView ? 'إضافة' : 'منفصلة'}</small>
                      <ArrowLeft size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>لا توجد عقد مطابقة في العينة.</p>
          )}
          {results.length > 12 && <small>تظهر أول ١٢ نتيجة؛ ضيّق البحث لعرض البقية.</small>}
          {view.visible.length >= LIMIT && (
            <small>بلغ الرسم حد العرض؛ أخفِ عقدة غير مثبّتة لإضافة نتيجة جديدة.</small>
          )}
        </div>
      )}
      <div className="analyst-graph-status" role="status" aria-live="polite">
        {ar(nodes.length)} عقدة و{ar(edges.length)} علاقة معروضة · الحد {ar(LIMIT)} عقدة
        {notice && ` · ${notice}`}
      </div>
      <div
        className="analyst-canvas"
        style={{ height }}
        role="group"
        aria-label="العقد المعروضة في الرسم"
      >
        <svg
          viewBox={`0 0 1000 ${height}`}
          preserveAspectRatio="none"
          role="group"
          aria-label="خطوط العلاقات المعروضة"
        >
          {connected.map(edge => {
            const from = graph.nodes.find(node => node.key === edge.a),
              to = graph.nodes.find(node => node.key === edge.b),
              choose = () => commit({ ...view, selectedEdge: edge.key });
            return (
              <g key={edge.key}>
                <path
                  aria-hidden="true"
                  className={
                    edge.key === view.selectedEdge || edge.a === active.key || edge.b === active.key
                      ? 'active'
                      : ''
                  }
                  d={edge.path}
                />
                <path
                  className="graph-edge-hit"
                  d={edge.path}
                  role="button"
                  tabIndex="0"
                  aria-label={`فحص علاقة ${edge.relation}: ${from?.title || edge.a}، ${to?.title || edge.b}`}
                  onClick={choose}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      choose();
                    }
                  }}
                />
              </g>
            );
          })}
        </svg>
        {nodes.map(node => {
          const point = coords.get(node.key);
          if (!point) return null;
          const Icon = meta[node.kind]?.icon || Fingerprint,
            pinned = view.pinned.includes(node.key);
          return (
            <button
              type="button"
              key={node.key}
              className={`analyst-graph-node ${node.kind} ${active.key === node.key ? 'selected' : ''}`}
              style={{ left: `${point.x / 10}%`, top: `${(point.y / height) * 100}%` }}
              aria-pressed={active.key === node.key}
              aria-label={`${label(node)}${pinned ? ' · مثبتة' : ''}`}
              onClick={() => commit({ ...view, selected: node.key })}
            >
              <span>
                <Icon size={15} />
                {meta[node.kind]?.label}
                {pinned && <Pin size={12} aria-hidden="true" />}
              </span>
              <strong dir="auto">{node.title}</strong>
              <small dir="ltr">{node.id === node.title ? '' : node.id}</small>
            </button>
          );
        })}
      </div>
      <div className="analyst-node-list" role="group" aria-label="قائمة العقد المعروضة">
        {nodes.map(node => {
          const Icon = meta[node.kind]?.icon || Fingerprint,
            pinned = view.pinned.includes(node.key);
          return (
            <button
              type="button"
              key={node.key}
              className={active.key === node.key ? 'selected' : ''}
              aria-pressed={active.key === node.key}
              aria-label={`${label(node)}${pinned ? ' · مثبتة' : ''}`}
              onClick={() => commit({ ...view, selected: node.key })}
            >
              <Icon size={16} />
              <span>
                <strong dir="auto">{node.title}</strong>
                <small>
                  {meta[node.kind]?.label} · <bdi dir="ltr">{node.id}</bdi>
                  {pinned ? ' · مثبتة' : ''}
                </small>
              </span>
              <ArrowLeft size={14} />
            </button>
          );
        })}
      </div>
      <details className="graph-manage">
        <summary ref={manageSummary}>إدارة العقد المعروضة · تحديد متعدد</summary>
        <div>
          <p>
            حدّد عقدًا لإخفائها من الرسم فقط. البداية والعقد المثبّتة محمية من الإخفاء؛ لا تتغير
            السجلات أو العلاقات الأصلية.
          </p>
          <div className="graph-manage-list">
            {nodes.map(node => {
              const protectedNode = node.key === view.root || view.pinned.includes(node.key);
              return (
                <label key={node.key}>
                  <input
                    type="checkbox"
                    aria-label={`تحديد لإخفاء ${label(node)}`}
                    disabled={protectedNode}
                    checked={view.marked.includes(node.key)}
                    onChange={event =>
                      commit({
                        ...view,
                        marked: event.target.checked
                          ? [...view.marked, node.key]
                          : view.marked.filter(key => key !== node.key),
                      })
                    }
                  />
                  <span>
                    {meta[node.kind]?.label} · <bdi dir="auto">{node.id}</bdi>
                    {protectedNode ? ' · محمية' : ''}
                  </span>
                </label>
              );
            })}
          </div>
          <Button type="button" disabled={!view.marked.length} onClick={hideMarked}>
            إخفاء المحدد ({ar(view.marked.length)})
          </Button>
        </div>
      </details>
      {selectedEdge && (
        <section
          className="graph-edge-inspector"
          aria-label={landmark('تفاصيل العلاقة المختارة')}
          aria-live="polite"
        >
          <div className="graph-edge-inspector-head">
            <div>
              <span>العلاقة المختارة</span>
              <strong>{selectedEdge.relation}</strong>
            </div>
            <button type="button" onClick={() => commit({ ...view, selectedEdge: '' })}>
              إغلاق تفاصيل العلاقة
            </button>
          </div>
          <dl>
            <div>
              <dt>الطرف الأول</dt>
              <dd>
                {meta[edgeA?.kind]?.label} · <bdi dir="auto">{edgeA?.title || selectedEdge.a}</bdi>{' '}
                · <bdi dir="ltr">{edgeA?.id}</bdi>
              </dd>
            </div>
            <div>
              <dt>الطرف الثاني</dt>
              <dd>
                {meta[edgeB?.kind]?.label} · <bdi dir="auto">{edgeB?.title || selectedEdge.b}</bdi>{' '}
                · <bdi dir="ltr">{edgeB?.id}</bdi>
              </dd>
            </div>
          </dl>
          <div className="graph-edge-sources">
            <span>
              السجلات المرجعية · <strong>{ar(selectedEdge.evidence.length)}</strong>
            </span>
            {selectedEdge.evidence.map(source =>
              compact && `${source.kind}:${source.id}` === anchor ? (
                <span key={`${source.kind}-${source.id}`}>
                  <bdi dir="ltr">{source.id}</bdi> · السجل المفتوح
                </span>
              ) : (
                <button
                  type="button"
                  key={`${source.kind}-${source.id}`}
                  aria-label={`فتح مرجع العلاقة ${source.id}`}
                  onClick={() => openDetail(source.kind, source.id)}
                >
                  <bdi dir="ltr">{source.id}</bdi> <ArrowLeft size={13} />
                </button>
              ),
            )}
          </div>
          <p>
            العدد يشير إلى السجلات المرجعية في العينة، وليس عدد اتصالات أو درجة ثقة. العلاقة مستمدة
            من الحقول ولا تثبت اتصالًا أو سببًا؛ وقت السجل ليس وقتًا مثبتًا للعلاقة.
          </p>
        </section>
      )}
      <div className="analyst-inspector" aria-live="polite">
        <div className="analyst-inspector-head">
          <div>
            <span>{meta[active.kind]?.label}</span>
            <strong dir="auto">{active.title}</strong>
            <small>
              <bdi dir="ltr">{active.id}</bdi>
              {active.outside ? ' · خارج الفترة العامة' : ''}
              {active.time != null ? ` · ${localSampleTime(active.time, true)}` : ''}
            </small>
          </div>
          {compact && active.key === anchor ? (
            <small>الحادثة المفتوحة حاليًا</small>
          ) : (
            <Button type="button" onClick={() => openDetail(active.openKind, active.openId)}>
              فتح السياق
            </Button>
          )}
        </div>
        <div className="analyst-inspector-tools">
          <Button
            type="button"
            icon={GitBranch}
            onClick={expand}
            disabled={!hidden.length || view.visible.length >= LIMIT}
          >
            توسيع العلاقات ({ar(hidden.length)})
          </Button>
          <Button
            type="button"
            icon={view.pinned.includes(active.key) ? PinOff : Pin}
            aria-pressed={view.pinned.includes(active.key)}
            onClick={togglePin}
            disabled={!view.pinned.includes(active.key) && view.pinned.length >= MAX_PINNED}
          >
            {view.pinned.includes(active.key) ? 'إلغاء تثبيت العقدة' : 'تثبيت العقدة'}
          </Button>
          <small>
            {view.visible.length >= LIMIT && hidden.length
              ? 'وصلت إلى الحد؛ أخفِ عقدًا أو أعد الرسم.'
              : `حتى ${ar(MAX_PINNED)} عقد مثبّتة؛ لا تتوسع العقد تلقائيًا بعد تحديدها.`}
          </small>
        </div>
        {neighbors.length ? (
          <ul className="analyst-edges">
            {neighbors.map(({ node, edge }) => (
              <li key={edge.key}>
                <div>
                  <strong>{edge.relation}</strong>
                  <small>
                    {view.visible.includes(node.key) ? 'معروضة في الرسم' : 'لم تُعرض بعد'} ·{' '}
                    {meta[node.kind]?.label}
                  </small>
                  <button
                    type="button"
                    className="graph-inspect-edge"
                    aria-pressed={view.selectedEdge === edge.key}
                    onClick={() => commit({ ...view, selectedEdge: edge.key })}
                  >
                    فحص العلاقة
                  </button>
                  <button
                    type="button"
                    disabled={!view.visible.includes(node.key) && view.visible.length >= LIMIT}
                    onClick={() => chooseNode(node)}
                    aria-label={`تحديد ${label(node)}`}
                  >
                    {node.title} <ArrowLeft size={13} />
                  </button>
                </div>
                <div className="analyst-evidence">
                  <span>السجل المرجعي</span>
                  {edge.evidence.map(source =>
                    compact && `${source.kind}:${source.id}` === anchor ? (
                      <span key={`${source.kind}-${source.id}`}>
                        <bdi dir="ltr">{source.id}</bdi> · السجل المفتوح
                      </span>
                    ) : (
                      <button
                        type="button"
                        key={`${source.kind}-${source.id}`}
                        onClick={() => openDetail(source.kind, source.id)}
                        aria-label={`فتح السجل المرجعي ${source.id}`}
                      >
                        <bdi dir="ltr">{source.id}</bdi>
                      </button>
                    ),
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="detail-muted">لا توجد علاقات مباشرة مطابقة لهذا المرشح في العينة.</p>
        )}
      </div>
      <p className="analyst-graph-disclaimer">
        <CircleHelp size={15} /> هذه اقترانات من حقول السجلات التجريبية فقط، وليست طوبولوجيا أو
        إثبات اتصال أو اختراق. وجود اسم مستخدم لا يثبت ملكيته أو اختراقه.
      </p>
    </section>
  );
}
