import React, { useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowUpLeft,
  BellRing,
  BookOpen,
  Box,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  Clock3,
  Database,
  ExternalLink,
  Eye,
  FileSearch,
  Fingerprint,
  Globe2,
  Layers3,
  ListFilter,
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import {
  ar,
  Avatar,
  Button,
  ltr,
  PageHeading,
  Panel,
  PanelHeading,
  Select,
  Severity,
  StatCard,
  Status,
  Table,
  Tag,
} from '../../shared/ui/index';
import { ActivityChart, SeverityDonut } from '../../shared/charts/Visuals';
import { overviewSeries, seriesTotal } from '../../shared/charts/visual-data';
import { NeedsAttention, RoleFocus } from './DashboardFocus';
import { GettingStarted, MetricDefinitions } from './DashboardHelp';
import {
  defaultMetricOrder,
  metricLabels,
  defaultWidgetOrder,
  widgetLabels,
  roleNames,
} from '../../shared/lib/preferences';
import NamedViews from '../../shared/components/NamedViews';
import { useSessionValue } from '../../shared/hooks/session-state';
import { NetworkOverview } from '../network/NetworkOverview';
import RadarDisplay from './RadarDisplay';
import { inPeriod, PERIOD_LABELS, relativeSampleTime } from '../../shared/lib/time-scope';

function RecentIncidents({ incidents, go, openDetail, timeRange }) {
  const rows = incidents.filter(x => inPeriod(x, 'incident', timeRange)).slice(0, 4);
  return (
    <Panel className="recent-panel">
      <PanelHeading
        title="الحوادث الأخيرة"
        subtitle={`حسب ${PERIOD_LABELS[timeRange]} من العينة؛ الأوقات غير المتاحة تبقى معلّمة`}
        icon={ShieldAlert}
        aside={
          <button className="text-link" onClick={() => go('incidents')}>
            عرض كل الحوادث <ArrowLeft size={15} />
          </button>
        }
      />
      <Table
        head={['الحادثة', 'درجة الخطورة', 'الأصل المتأثر', 'الحالة', 'المسؤول', 'الوقت', '']}
        empty={!rows.length}
      >
        {rows.map((x, i) => (
          <tr
            key={x.id}
            className="clickable-row"
            tabIndex="0"
            onClick={() => openDetail('incident', x.id)}
            onKeyDown={e => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                openDetail('incident', x.id);
              }
            }}
          >
            <td>
              <div className="incident-cell">
                <span className={`incident-icon ${x.severity === 'حرجة' ? 'red' : 'orange'}`}>
                  <ShieldAlert size={16} />
                </span>
                <div>
                  <strong>{x.title}</strong>
                  <small dir="ltr">{x.id}</small>
                </div>
              </div>
            </td>
            <td>
              <Severity value={x.severity} />
            </td>
            <td>{ltr(x.asset, 'mono muted-ltr')}</td>
            <td>
              <Status value={x.status} />
            </td>
            <td>
              <div className="owner-cell">
                <Avatar name={x.owner} small tone={i % 2 ? 'purple' : 'blue'} />
                <span>{x.owner}</span>
              </div>
            </td>
            <td className="cell-muted nowrap">{relativeSampleTime(x, 'incident')}</td>
            <td>
              <button type="button" className="table-arrow" aria-label={`تفاصيل ${x.id}`}>
                <ChevronLeft size={16} />
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}

export default function Overview({
  data,
  go,
  openDetail,
  notify,
  openModal,
  offlineSimulation,
  guide,
  setGuide,
  startGuide,
  preferences,
  setPreferences,
  timeRange = '24h',
  setTimeRange,
  sessionRef,
  presentation,
  setPresentation,
}) {
  const period = timeRange,
    setPeriod = setTimeRange;
  const [role, setRole] = useSessionValue(sessionRef, 'overview', 'role', 'مدير النظام');
  const series = overviewSeries[period],
    severityCounts = series.severity;
  const total = seriesTotal(series.points, 'alerts'),
    eventTotal = seriesTotal(series.points, 'events');
  const openIncidents = data.incidents.filter(x => !['مغلقة', 'إنذار كاذب'].includes(x.status));
  const baselinePending = data.assets.filter(x => x.baseline === 'قيد التأسيس').length;
  const order = preferences.layouts[role] || defaultMetricOrder;
  const hidden = preferences.hiddenMetrics?.[role] || [],
    visibleOrder = order.filter(id => !hidden.includes(id));
  const toggleMetric = id =>
    setPreferences(current => {
      const list = current.hiddenMetrics?.[role] || [];
      return {
        ...current,
        hiddenMetrics: {
          ...(current.hiddenMetrics || {}),
          [role]: list.includes(id) ? list.filter(x => x !== id) : [...list, id],
        },
      };
    });
  const widgetOrder = preferences.widgetOrders?.[role] || defaultWidgetOrder,
    hiddenWidgets = preferences.hiddenWidgets?.[role] || [];
  const toggleWidget = id =>
    setPreferences(current => {
      const list = current.hiddenWidgets?.[role] || [];
      return {
        ...current,
        hiddenWidgets: {
          ...(current.hiddenWidgets || {}),
          [role]: list.includes(id) ? list.filter(x => x !== id) : [...list, id],
        },
      };
    });
  const moveWidget = (id, delta) =>
    setPreferences(current => {
      const list = [...(current.widgetOrders?.[role] || defaultWidgetOrder)],
        from = list.indexOf(id),
        to = from + delta;
      if (to < 0 || to >= list.length) return current;
      [list[from], list[to]] = [list[to], list[from]];
      return { ...current, widgetOrders: { ...(current.widgetOrders || {}), [role]: list } };
    });
  const namedLayout = { role, metrics: order, hidden, widgets: widgetOrder, hiddenWidgets };
  const applyLayout = value => {
    const selected = roleNames.includes(value.role) ? value.role : role;
    const orderOf = (ids, defaults) => {
      const valid = Array.isArray(ids)
        ? ids.filter((id, i) => defaults.includes(id) && ids.indexOf(id) === i)
        : [];
      return [...valid, ...defaults.filter(id => !valid.includes(id))];
    };
    const subset = (ids, defaults) =>
      Array.isArray(ids)
        ? ids.filter((id, i) => defaults.includes(id) && ids.indexOf(id) === i)
        : [];
    setRole(selected);
    setPreferences(current => ({
      ...current,
      layouts: { ...current.layouts, [selected]: orderOf(value.metrics, defaultMetricOrder) },
      hiddenMetrics: {
        ...current.hiddenMetrics,
        [selected]: subset(value.hidden, defaultMetricOrder),
      },
      widgetOrders: {
        ...current.widgetOrders,
        [selected]: orderOf(value.widgets, defaultWidgetOrder),
      },
      hiddenWidgets: {
        ...current.hiddenWidgets,
        [selected]: subset(value.hiddenWidgets, defaultWidgetOrder),
      },
    }));
  };
  const cards = {
    events: {
      title: 'الأحداث المحلَّلة',
      value: ar(eventTotal),
      caption: 'إجمالي تجريبي للفترة',
      icon: Activity,
      tone: 'blue',
      page: 'events',
    },
    alerts: {
      title: 'التنبيهات المرصودة',
      value: ar(total),
      caption: 'إجمالي تجريبي للفترة',
      icon: BellRing,
      tone: 'purple',
      page: 'alerts',
    },
    incidents: {
      title: 'الحوادث المفتوحة',
      value: ar(openIncidents.length),
      caption: `لقطة حالية · ${ar(openIncidents.filter(x => x.severity === 'حرجة').length)} حرجة`,
      icon: ShieldAlert,
      tone: 'orange',
      page: 'incidents',
    },
    assets: {
      title: 'الأصول في العينة',
      value: ar(data.assets.length),
      caption: `${ar(baselinePending)} قيد التأسيس`,
      icon: Box,
      tone: 'cyan',
      page: 'assets',
    },
  };
  return (
    <>
      <PageHeading
        title="نظرة عامة"
        subtitle="كل ما تحتاج لمتابعة الوضع الأمني، في مكان واحد."
        actions={
          <>
            <span className="updated-label">
              <span className="pulse-dot" />
              بيانات توضيحية
            </span>
            <Button icon={BookOpen} onClick={() => startGuide('resume')}>
              دليل البدء
            </Button>
            <Button icon={RefreshCw} onClick={() => notify('تم تحديث العرض التجريبي')}>
              تحديث
            </Button>
          </>
        }
      />
      <div className="overview-hero">
        <div className="hero-copy">
          <span className="hero-overline">
            <span className="pulse-dot" /> مركز العمليات الأمنية{' '}
            <span className="hero-overline-en" dir="ltr">
              SECURITY OPERATIONS CENTER
            </span>
          </span>
          <h2>
            رؤية أوضح. <span>استجابة أسرع.</span>
          </h2>
          <p>راقب الأحداث، افهم التهديدات، وأدر الحوادث بثقة من منصة واحدة.</p>
          <div className="hero-meta">
            <span>
              <ShieldCheck size={15} /> مراقبة موحّدة
            </span>
            <i />
            <span>
              <Sparkles size={15} /> كشف هجين قابل للتفسير
            </span>
            <i />
            <span>
              <Clock3 size={15} /> دورة استجابة واضحة
            </span>
          </div>
          <button
            type="button"
            className="hero-journey-link"
            disabled={!data.incidents.some(x => x.id === 'INC-2026-084')}
            onClick={() => openDetail('incident', 'INC-2026-084')}
          >
            <FileSearch size={15} /> استكشف رحلة التحقيق <ArrowLeft size={14} />
          </button>
        </div>
        <div className="hero-visual">
          <RadarDisplay />
        </div>
        <div className="hero-grid" />
      </div>
      <GettingStarted guide={guide} setGuide={setGuide} startGuide={startGuide} />
      <RoleFocus data={data} role={role} setRole={setRole} go={go} />
      <div className="section-bar">
        <div>
          <h2>ملخص النشاط</h2>
          <p>لمحة سريعة عن بيانات المثال</p>
        </div>
        <Select value={period} onChange={setPeriod} ariaLabel="الفترة الزمنية">
          <option value="1h">آخر ساعة</option>
          <option value="24h">آخر ٢٤ ساعة</option>
          <option value="7d">آخر ٧ أيام</option>
        </Select>
      </div>
      <details className="dashboard-customize">
        <summary>تخصيص بطاقات ملخص النشاط لهذا الدور</summary>
        <div>
          <fieldset>
            <legend>البطاقات الظاهرة</legend>
            {order.map(id => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={!hidden.includes(id)}
                  onChange={() => toggleMetric(id)}
                />
                {metricLabels[id]}
              </label>
            ))}
          </fieldset>
          <button
            type="button"
            onClick={() =>
              setPreferences(current => ({
                ...current,
                hiddenMetrics: { ...(current.hiddenMetrics || {}), [role]: [] },
              }))
            }
          >
            إظهار الجميع
          </button>
          <small>الترتيب من الإعدادات، والمعاينة لا تغيّر صلاحيات.</small>
          <div className="dashboard-widgets-editor">
            <strong>مكونات اللوحة وترتيبها</strong>
            <p>اختر المكونات، واستخدم الأسهم لترتيبها لهذا الدور.</p>
            <ol>
              {widgetOrder.map((id, index) => (
                <li key={id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!hiddenWidgets.includes(id)}
                      onChange={() => toggleWidget(id)}
                    />
                    {widgetLabels[id]}
                  </label>
                  <div>
                    <button
                      type="button"
                      disabled={index === 0}
                      aria-label={`تقديم ${widgetLabels[id]}`}
                      onClick={() => moveWidget(id, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === widgetOrder.length - 1}
                      aria-label={`تأخير ${widgetLabels[id]}`}
                      onClick={() => moveWidget(id, 1)}
                    >
                      ↓
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <NamedViews
            scope="overview"
            current={namedLayout}
            onApply={applyLayout}
            sessionRef={sessionRef}
            presets={[
              {
                name: 'تخطيط المحلل',
                value: {
                  role: 'محلل أمني',
                  metrics: ['alerts', 'incidents', 'events', 'assets'],
                  widgets: ['attention', 'recent', 'charts', 'network', 'services'],
                },
              },
              {
                name: 'تخطيط المدير',
                value: {
                  role: 'مدير النظام',
                  metrics: ['events', 'alerts', 'incidents', 'assets'],
                  widgets: defaultWidgetOrder,
                },
              },
            ]}
          />
        </div>
      </details>
      {visibleOrder.length === 0 && (
        <p className="dashboard-empty">لا توجد بطاقات مختارة؛ افتح التخصيص لإظهارها.</p>
      )}
      <div className="presentation-control">
        <button type="button" aria-pressed={presentation} onClick={() => setPresentation(v => !v)}>
          {presentation ? 'إنهاء العرض الكبير' : 'وضع العرض الكبير'}
        </button>
        <small>يوسّع لوحة العينة بإخفاء القائمة على الشاشات الكبيرة؛ ليس ملء شاشة المتصفح.</small>
      </div>
      <div className="stats-grid" role="group" aria-label="ملخص مؤشرات الدور">
        {visibleOrder.map(id => {
          const card = cards[id];
          return (
            <StatCard
              key={id}
              title={card.title}
              value={card.value}
              caption={card.caption}
              icon={card.icon}
              tone={card.tone}
              onClick={() => go(card.page)}
            />
          );
        })}
      </div>
      <MetricDefinitions
        period={period}
        eventTotal={eventTotal}
        alertTotal={total}
        incidentCount={openIncidents.length}
        assetCount={data.assets.length}
        order={visibleOrder}
      />
      {widgetOrder
        .filter(id => !hiddenWidgets.includes(id))
        .map(id => (
          <React.Fragment key={id}>
            {id === 'network' && <NetworkOverview go={go} timeRange={timeRange} />}
            {id === 'attention' && (
              <NeedsAttention
                data={data}
                role={role}
                go={go}
                openDetail={openDetail}
                openModal={openModal}
                offlineSimulation={offlineSimulation}
              />
            )}
            {id === 'charts' && (
              <div className="dashboard-charts">
                <Panel className="activity-panel">
                  <PanelHeading
                    title="نشاط الشبكة والتهديدات"
                    subtitle="توزيع الأحداث والتنبيهات خلال الفترة المحددة"
                    icon={Activity}
                  />
                  <ActivityChart period={period} />
                </Panel>
                <Panel className="distribution-panel">
                  <PanelHeading
                    title="توزيع التنبيهات"
                    subtitle="حسب مستوى الخطورة · أرقام تجريبية"
                    icon={CircleDot}
                  />
                  <SeverityDonut counts={severityCounts} />
                </Panel>
              </div>
            )}
            {id === 'recent' && (
              <RecentIncidents
                incidents={data.incidents}
                go={go}
                openDetail={openDetail}
                timeRange={timeRange}
              />
            )}
            {id === 'services' && (
              <div className="dashboard-bottom">
                <Panel>
                  <PanelHeading
                    title="مصادر البيانات"
                    subtitle="الأجهزة والمستشعرات في العينة التجريبية"
                    icon={Database}
                    aside={
                      <button className="text-link" onClick={() => go('sources')}>
                        عرض الكل <ArrowLeft size={14} />
                      </button>
                    }
                  />
                  <div className="source-mini-grid">
                    {data.sources.slice(0, 4).map((s, i) => (
                      <button
                        type="button"
                        className="source-mini"
                        key={s.id}
                        onClick={() => openDetail('source', s.id)}
                        aria-label={`تفاصيل ${s.name}، الحالة ${s.health}`}
                      >
                        <span className={`source-mini-icon c${i % 4}`}>
                          <Radio size={16} />
                        </span>
                        <span>
                          <strong>{s.name}</strong>
                          <small>{s.kind}</small>
                        </span>
                        <i className={s.health === 'متصل' ? '' : 'offline'} />
                      </button>
                    ))}
                  </div>
                </Panel>
                <Panel>
                  <PanelHeading
                    title="نبض الاستجابة"
                    subtitle="مؤشرات توضيحية للفريق"
                    icon={Zap}
                    aside={
                      <button className="text-link" onClick={() => go('reports')}>
                        التقارير <ArrowLeft size={14} />
                      </button>
                    }
                  />
                  <div className="response-mini">
                    <div>
                      <span>متوسط زمن الإقرار</span>
                      <strong>
                        ٨ <small>دقائق</small>
                      </strong>
                      <p>من الإنشاء إلى أول إجراء</p>
                    </div>
                    <div>
                      <span>متوسط زمن الحل</span>
                      <strong>
                        ٢٫٤ <small>ساعة</small>
                      </strong>
                      <p>من الإنشاء حتى الإغلاق</p>
                    </div>
                  </div>
                </Panel>
              </div>
            )}
          </React.Fragment>
        ))}
      {widgetOrder.every(id => hiddenWidgets.includes(id)) && (
        <p className="dashboard-empty">جميع مكونات اللوحة مخفية؛ افتح التخصيص لإظهارها.</p>
      )}
      <div className="page-footnote">
        <Shield size={14} /> صُممت هذه الواجهة وفق متطلبات مشروع NEXORA. جميع البيانات الظاهرة
        افتراضية.
      </div>
    </>
  );
}
