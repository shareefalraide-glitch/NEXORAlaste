import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Boxes, Database, GitBranch, Network, Search, ShieldAlert } from 'lucide-react';
import { events } from '../../data/fixtures/demo-records';
import { relationshipGraph } from './relationship-model';
import { buildAnalystGraph } from '../investigations/graph/analyst-graph';
import AttackPath from './AttackPath';
import InvestigationGraph from '../investigations/graph/InvestigationGraph';
import { useSessionValue } from '../../shared/hooks/session-state';
import { ar, Button, InfoBox, PageHeading, Panel, SearchInput, Tag } from '../../shared/ui/index';

const types = [
  { id: 'source', label: 'المصادر والأجهزة', icon: Database },
  { id: 'asset', label: 'الأصول', icon: Boxes },
  { id: 'incident', label: 'الحوادث', icon: ShieldAlert },
];
const titleFor = { source: 'مصدر', asset: 'أصل', incident: 'حادثة' };

export default function Relationships({
  data,
  openDetail,
  timeRange = '24h',
  sessionRef,
  tourActive = false,
}) {
  const [query, setQuery] = useState(''),
    [selected, setSelected] = useState(''),
    [focusNeighbors, setFocusNeighbors] = useState(false);
  const [viewMode, setViewMode] = useSessionValue(
      sessionRef,
      'relationships',
      'viewMode',
      'summary',
    ),
    [investigationView, setInvestigationView] = useSessionValue(
      sessionRef,
      'relationships',
      'investigationView',
      null,
    );
  // Tour targets the summary without overwriting the user's saved graph view.
  const renderMode = tourActive ? 'summary' : viewMode;
  const graph = useMemo(() => relationshipGraph(data, events), [data]);
  const analystGraph = useMemo(
    () => (renderMode === 'investigation' ? buildAnalystGraph(data, events, timeRange) : null),
    [data, timeRange, renderMode],
  );
  const displayGraph = analystGraph || graph;
  const { nodes, edges } = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    let keys = new Set(graph.nodes.map(n => n.key));
    if (needle) {
      const matched = new Set(
        graph.nodes
          .filter(n =>
            n.search.some(v =>
              String(v || '')
                .toLocaleLowerCase()
                .includes(needle),
            ),
          )
          .map(n => n.key),
      );
      keys = new Set(matched);
      graph.edges.forEach(e => {
        if (matched.has(e.a)) keys.add(e.b);
        if (matched.has(e.b)) keys.add(e.a);
      });
    }
    if (focusNeighbors && selected && keys.has(selected)) {
      const direct = new Set([selected]);
      graph.edges.forEach(e => {
        if (e.a === selected) direct.add(e.b);
        if (e.b === selected) direct.add(e.a);
      });
      keys = new Set([...keys].filter(k => direct.has(k)));
    }
    return {
      nodes: graph.nodes.filter(n => keys.has(n.key)),
      edges: graph.edges.filter(e => keys.has(e.a) && keys.has(e.b)),
    };
  }, [graph, query, selected, focusNeighbors]);
  const active = nodes.find(n => n.key === selected),
    linkedEdges = active ? graph.edges.filter(e => e.a === active.key || e.b === active.key) : [];
  const linked = linkedEdges
    .map(e => ({
      edge: e,
      node: graph.nodes.find(n => n.key === (e.a === active.key ? e.b : e.a)),
    }))
    .filter(x => x.node);
  const mapRef = useRef(null),
    refs = useRef(new Map()),
    [drawing, setDrawing] = useState({ width: 1, height: 1, paths: [] });
  useLayoutEffect(() => {
    const container = mapRef.current;
    if (!container) return;
    let frame = 0;
    const draw = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = container.getBoundingClientRect(),
          width = container.clientWidth,
          height = container.clientHeight;
        if (!width || !height || window.matchMedia('(max-width: 760px)').matches) {
          setDrawing({ width: 1, height: 1, paths: [] });
          return;
        }
        const paths = edges.flatMap(edge => {
          const from = refs.current.get(edge.a)?.getBoundingClientRect(),
            to = refs.current.get(edge.b)?.getBoundingClientRect();
          if (!from || !to) return [];
          const rightToLeft = from.left + from.width / 2 > to.left + to.width / 2;
          const x1 = (rightToLeft ? from.left : from.right) - box.left,
            x2 = (rightToLeft ? to.right : to.left) - box.left;
          const y1 = from.top + from.height / 2 - box.top,
            y2 = to.top + to.height / 2 - box.top,
            dx = (x2 - x1) * 0.55;
          return [
            {
              key: edge.key,
              a: edge.a,
              b: edge.b,
              d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
            },
          ];
        });
        const next = { width, height, paths };
        setDrawing(old => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
      });
    };
    draw();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(draw) : null;
    observer?.observe(container);
    refs.current.forEach(el => observer?.observe(el));
    window.addEventListener('resize', draw);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', draw);
    };
  }, [nodes, edges]);
  return (
    <>
      <PageHeading
        title="خريطة العلاقات"
        subtitle="استكشف الروابط بين المصادر والأصول والحوادث ضمن بيانات العينة."
        badge={<Tag color="blue">عينة محلية</Tag>}
      />
      <div className="relationship-intro">
        <span>
          <Network size={22} />
        </span>
        <div>
          <strong>سياق التحقيق في نظرة واحدة</strong>
          <p>
            {renderMode === 'summary'
              ? 'اختر عقدة لرؤية علاقاتها ثم افتح تفاصيلها. الروابط مستمدة من أحداث وتنبيهات العينة وربط الحوادث بالأصول، وليست خريطة اتصال فعلية.'
              : 'يعرض المستكشف عقد السجلات والعناوين والأسماء وروابطها المرجعية من العينة، لا اتصالات أو مسارات هجوم فعلية.'}
          </p>
        </div>
        <div className="relationship-stats">
          <b>
            {ar(displayGraph.nodes.length)}{' '}
            <small>{renderMode === 'summary' ? 'سجل' : 'عقدة في العينة'}</small>
          </b>
          <b>
            {ar(displayGraph.edges.length)} <small>علاقة في العينة</small>
          </b>
        </div>
      </div>
      <div className="relationship-view-switch" role="group" aria-label="طريقة استكشاف العلاقات">
        <button
          type="button"
          aria-pressed={renderMode === 'summary'}
          onClick={() => setViewMode('summary')}
        >
          العلاقات المباشرة
        </button>
        <button
          type="button"
          aria-pressed={renderMode === 'investigation'}
          onClick={() => setViewMode('investigation')}
        >
          مستكشف التحقيق
        </button>
      </div>
      {renderMode === 'summary' ? (
        <Panel className="relationship-panel">
          <div className="relationship-toolbar">
            <div>
              <h2>استكشف العلاقات</h2>
              <p>يُظهر البحث النتائج وجيرانها المباشرين فقط.</p>
            </div>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="بحث باسم الجهاز أو الأصل أو الحادثة أو المعرّف"
            />
          </div>
          <div className="relationship-focus">
            <label>
              <input
                type="checkbox"
                checked={focusNeighbors}
                onChange={e => setFocusNeighbors(e.target.checked)}
              />{' '}
              إظهار العقدة المختارة وجيرانها المباشرين فقط
            </label>
            {selected && (
              <button type="button" onClick={() => setSelected('')}>
                مسح التحديد
              </button>
            )}
          </div>
          <div className="relationship-status" role="status" aria-live="polite">
            {ar(nodes.length)} سجل و{ar(edges.length)} علاقة معروضة من العينة
          </div>
          <div className="relationship-selection" aria-live="polite">
            {active ? (
              <>
                <div className="relationship-selection-title">
                  <span>
                    <GitBranch size={17} />
                  </span>
                  <div>
                    <strong>
                      {titleFor[active.kind]}: <bdi dir="auto">{active.title}</bdi>
                    </strong>
                    <small>
                      <bdi dir="ltr">{active.id}</bdi> · {ar(linked.length)} علاقة مباشرة
                    </small>
                  </div>
                  <Button onClick={() => openDetail(active.kind, active.id)}>فتح التفاصيل</Button>
                </div>
                {linked.length ? (
                  <div className="relationship-neighbors">
                    <span>مرتبط في العينة بـ</span>
                    {linked.map(({ node, edge }) => (
                      <button type="button" key={node.key} onClick={() => setSelected(node.key)}>
                        <span>{titleFor[node.kind]}</span> <bdi dir="auto">{node.title}</bdi>{' '}
                        <small>
                          (<bdi dir="ltr">{node.id}</bdi> ·{' '}
                          {edge.relation === 'source-asset' ? 'سجلات مشتركة' : 'أصل الحادثة'})
                        </small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p>لا توجد علاقة مباشرة مسجلة لهذه العقدة في العينة.</p>
                )}
              </>
            ) : (
              <p>اختر مصدرًا أو أصلًا أو حادثة من الخريطة لعرض العلاقات المباشرة نصيًا.</p>
            )}
          </div>
          {nodes.length ? (
            <div
              className="relationship-map-grid"
              ref={mapRef}
              role="group"
              aria-label="عقد وعلاقات العينة"
            >
              <svg
                className="relationship-lines"
                viewBox={`0 0 ${drawing.width} ${drawing.height}`}
                aria-hidden="true"
                focusable="false"
                preserveAspectRatio="none"
              >
                {drawing.paths.map(path => (
                  <path
                    key={path.key}
                    d={path.d}
                    className={
                      active && (path.a === active.key || path.b === active.key) ? 'active' : ''
                    }
                  />
                ))}
              </svg>
              {types.map(type => (
                <section
                  className={`relationship-column relationship-${type.id}`}
                  aria-label={type.label}
                  key={type.id}
                >
                  <h3>
                    <type.icon size={16} />
                    {type.label}
                    <span>{ar(nodes.filter(n => n.kind === type.id).length)}</span>
                  </h3>
                  <div>
                    {nodes
                      .filter(n => n.kind === type.id)
                      .map(node => (
                        <button
                          type="button"
                          key={node.key}
                          ref={el => {
                            if (el) refs.current.set(node.key, el);
                            else refs.current.delete(node.key);
                          }}
                          className={`relationship-node ${selected === node.key ? 'selected' : ''}`}
                          aria-label={`${titleFor[node.kind]} ${node.title} ${node.id}`}
                          aria-pressed={selected === node.key}
                          onClick={() => setSelected(node.key)}
                        >
                          <span className="relationship-node-icon">
                            <type.icon size={16} />
                          </span>
                          <span className="relationship-node-content">
                            <strong>
                              <bdi dir="auto">{node.title}</bdi>
                            </strong>
                            <small>
                              <bdi dir="ltr">{node.id}</bdi> · {node.subtitle}
                            </small>
                          </span>
                        </button>
                      ))}
                    {!nodes.some(n => n.kind === type.id) && (
                      <p className="relationship-empty">لا توجد عقد من هذا النوع.</p>
                    )}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="relationship-no-results">
              <Search size={18} /> لا توجد نتائج في العينة؛ جرّب كلمة أخرى.
            </div>
          )}
        </Panel>
      ) : (
        <InvestigationGraph
          data={data}
          graphData={analystGraph}
          openDetail={openDetail}
          timeRange={timeRange}
          savedView={investigationView}
          onViewChange={setInvestigationView}
        />
      )}
      <AttackPath data={data} openDetail={openDetail} timeRange={timeRange} />
      <InfoBox title="قراءة الخريطة">
        صلة المصدر بالأصل تعني وجودهما في حدث أو تنبيه تجريبي مشترك، وصلة الحادثة بالأصل مأخوذة من
        سجل الحادثة. لا تمثل الخطوط مسار شبكة أو اتصالًا أو اكتشافًا فعليًا.
      </InfoBox>
    </>
  );
}
