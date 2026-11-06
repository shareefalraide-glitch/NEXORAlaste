import React, { useRef } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  FileCheck2,
  GitBranch,
  History,
  ListChecks,
  LockKeyhole,
  Plus,
  Server,
  Shield,
  ShieldAlert,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { ar, Button, Empty, InfoBox, ltr, Severity, Status, Tag } from '../../../shared/ui/index';
import { events } from '../../../data/fixtures/demo-records';
import { assetForRecord } from '../../assets/asset-relations';

import IncidentWorkspace, { defaultInvestigation } from '../workspace/IncidentWorkspace';
import GuidedInvestigation, { initialGuided } from '../workspace/GuidedInvestigation';
import InvestigationGraph from '../graph/InvestigationGraph';

import AttackStoryboard from '../timeline/AttackStoryboard';

import { useSessionValue } from '../../../shared/hooks/session-state';
import CaseWorkspace from '../workspace/CaseWorkspace';
import { EntityLink } from './EntityContext';
import { EvidenceVault, ResponsePlaybooks, UnifiedTimeline } from '../timeline/InvestigationPlus';
import { BusinessImpact, SlaPreview } from '../../demo/ProductExtensions';
import { DetailGrid, RelatedRecords, RiskExplanation } from './DetailComponents';
const nextMap = {
  جديدة: 'مسندة',
  مسندة: 'قيد المعالجة',
  'قيد المعالجة': 'محتواة',
  محتواة: 'معالجة',
  معالجة: 'مغلقة',
  مغلقة: 'جديدة',
};
function ShieldCheckIcon() {
  return <Shield size={20} />;
}
export function IncidentDetails({
  item,
  data,
  openModal,
  openDetail,
  offlineSimulation,
  investigations,
  setInvestigations,
  triageRecords,
  timeRange,
  sessionRef,
  viewSessionRef,
}) {
  const scope = `incident-view:${item.id}`;
  const [tab, setTab] = useSessionValue(viewSessionRef, scope, 'tab', 'overview'),
    [analystView, setAnalystView] = useSessionValue(viewSessionRef, scope, 'analystView', ''),
    [timelineView, setTimelineView] = useSessionValue(
      viewSessionRef,
      scope,
      'timelineView',
      'timeline',
    ),
    analystSectionRef = useRef(null),
    incidentRegion = useRef(null);
  const focusAnalystView = () =>
    requestAnimationFrame(() => {
      const region = analystSectionRef.current?.querySelector('section[aria-label]');
      region?.scrollIntoView({ block: 'start', behavior: 'auto' });
      region?.focus({ preventScroll: true });
    });
  const closeAnalystView = kind => {
    setAnalystView('');
    requestAnimationFrame(() =>
      incidentRegion.current
        ?.querySelector(
          `.case-workspace-primary button:${kind === 'guided' ? 'first' : 'last'}-child`,
        )
        ?.focus(),
    );
  };
  const showIncidentOverview = () => {
    setTab('overview');
    requestAnimationFrame(() =>
      incidentRegion.current?.querySelector('.analyst-case-title h3')?.focus(),
    );
  };
  const workspace = investigations[item.id] || defaultInvestigation(),
    guided = workspace.guided,
    focused = !!workspace.focused;
  const changeWorkspace = fn =>
    setInvestigations(current => ({
      ...current,
      [item.id]: fn(current[item.id] || defaultInvestigation()),
    }));
  const openGuide = () => {
    changeWorkspace(ws => ({
      ...ws,
      guided: { ...(ws.guided || initialGuided()), status: 'active' },
    }));
    setTab('overview');
    setAnalystView('guided');
    focusAnalystView();
  };
  const openGraph = () => {
    setTab('overview');
    setAnalystView('graph');
    focusAnalystView();
  };
  const related = data.alerts.filter(a => a.incident === item.id);
  const relatedEvents = events.filter(event => related.some(alert => alert.id === event.alert));
  const asset = assetForRecord(data.assets, item);
  const next = nextMap[item.status];
  const nextText =
    item.status === 'إنذار كاذب'
      ? 'لا توجد خطوة تالية في دورة الحادثة بعد تصنيفها إنذارًا كاذبًا.'
      : item.status === 'مغلقة'
        ? 'يمكن طلب إعادة الفتح مع توثيق السبب.'
        : item.status === 'جديدة'
          ? 'إسناد الحادثة إلى أحد أعضاء الفريق للمتابعة.'
          : item.status === 'مسندة'
            ? 'بدء المعالجة بعد مراجعة سياق الحادثة.'
            : item.status === 'قيد المعالجة'
              ? item.approval === 'بانتظار الموافقة'
                ? 'راجع طلب الاحتواء المحدد قبل تسجيل الموافقة البشرية.'
                : item.approval === 'تمت الموافقة'
                  ? 'تمت الموافقة تجريبيًا؛ يمكن متابعة انتقال الحالة.'
                  : item.approval === 'مرفوض'
                    ? 'رُفض الطلب السابق؛ يمكن تقديم اقتراح جديد للمراجعة.'
                    : item.approval === 'أعيد للتعديل'
                      ? 'راجع سبب الإعادة وعدّل الطلب قبل إرساله مجددًا.'
                      : 'اقترح إجراء احتواء محددًا قبل طلب الموافقة البشرية.'
              : item.status === 'محتواة'
                ? 'توثيق المعالجة والسبب الجذري قبل المتابعة.'
                : 'مراجعة السبب الجذري ثم توثيق الإغلاق.';
  const doNext = () => {
    if (item.status === 'قيد المعالجة' && item.approval !== 'تمت الموافقة') {
      openModal('approval', {
        id: item.id,
        mode: item.approval === 'بانتظار الموافقة' ? 'approve' : 'request',
      });
      return;
    }
    if (next) openModal('transition', { id: item.id, next });
  };
  return (
    <div ref={incidentRegion} className="incident-detail-content">
      <div className="detail-title-row analyst-case-title">
        <div>
          <h3 tabIndex={-1}>{item.title}</h3>
          <div className="detail-badges">
            <Severity value={item.severity} />
            <Status value={item.status} />
            <Tag color="blue">{item.alerts} تنبيه مرتبط</Tag>
          </div>
        </div>
        <button
          type="button"
          className="analyst-focus-toggle"
          aria-pressed={focused}
          onClick={() => changeWorkspace(ws => ({ ...ws, focused: !ws.focused }))}
        >
          {focused ? 'إنهاء التركيز' : 'وضع التركيز'}
        </button>
      </div>
      <p className="detail-description">{item.description}</p>
      <div className="case-brief">
        <div className="case-next">
          <span>
            <ListChecks size={16} /> الخطوة التالية في العينة
          </span>
          <strong>{nextText}</strong>
          <small>
            {offlineSimulation
              ? 'الإجراءات غير متاحة أثناء محاكاة الانقطاع.'
              : 'الخطوة توضيحية ولا تنفذ إجراءً على الشبكة.'}
          </small>
        </div>
      </div>
      <div className="detail-actions">
        {next && (
          <Button
            variant="primary"
            icon={item.status === 'جديدة' ? UserPlus : ArrowLeft}
            disabled={offlineSimulation}
            onClick={doNext}
          >
            {item.status === 'جديدة'
              ? 'إسناد الحادثة'
              : item.status === 'مغلقة'
                ? 'طلب إعادة الفتح'
                : item.status === 'قيد المعالجة' && item.approval !== 'تمت الموافقة'
                  ? item.approval === 'أعيد للتعديل'
                    ? 'تعديل الطلب'
                    : item.approval === 'مرفوض'
                      ? 'طلب جديد'
                      : 'موافقة الاحتواء'
                  : `الانتقال إلى «${next}»`}
          </Button>
        )}
        {item.status === 'قيد المعالجة' && (
          <Button
            disabled={offlineSimulation}
            onClick={() => openModal('falsePositive', { id: item.id })}
          >
            تصنيف إنذار كاذب
          </Button>
        )}
        <Button
          icon={FileCheck2}
          onClick={() => openModal('report', { type: 'حادثة تفصيلية', incident: item })}
        >
          تقرير الحادثة
        </Button>
        <Button
          type="button"
          icon={Sparkles}
          onClick={() => openModal('copilot', { incidentId: item.id })}
        >
          اسأل المساعد عن الحادثة
        </Button>
      </div>
      <div className="tabs detail-tabs">
        {[
          ['overview', 'نظرة عامة'],
          ['alerts', 'التنبيهات'],
          ['timeline', 'الخط الزمني'],
          ['actions', 'الإجراءات'],
          ['followup', 'المتابعة وSLA'],
          ['workspace', 'المهام والملاحظات'],
          ['evidence', 'مراجع الأدلة'],
          ['playbooks', 'قوالب الاستجابة'],
        ].map(([id, label]) => (
          <button
            type="button"
            className={tab === id ? 'active' : ''}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            key={id}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'overview' && (
        <>
          <CaseWorkspace
            incident={item}
            alerts={related}
            events={relatedEvents}
            asset={asset}
            openDetail={openDetail}
            setTab={setTab}
            openReport={() => openModal('report', { type: 'حادثة تفصيلية', incident: item })}
            onGuide={openGuide}
            onGraph={openGraph}
            guideStarted={!!guided}
          />
          {analystView === 'guided' && (
            <div ref={analystSectionRef}>
              <GuidedInvestigation
                incident={item}
                progress={guided}
                hasAlert={!!related.length}
                onProgress={progress => changeWorkspace(ws => ({ ...ws, guided: progress }))}
                onClose={() => closeAnalystView('guided')}
                onAction={target => {
                  if (target === 'graph') openGraph();
                  else if (target === 'notebook') setTab('workspace');
                  else if (target === 'report')
                    openModal('report', { type: 'حادثة تفصيلية', incident: item });
                  else if (related[0]) openDetail('alert', related[0].id);
                }}
              />
            </div>
          )}
          {analystView === 'graph' && (
            <div ref={analystSectionRef}>
              <div className="analyst-inline-actions">
                {guided && (
                  <Button type="button" onClick={openGuide}>
                    العودة للتحقيق الموجّه
                  </Button>
                )}
                <Button type="button" onClick={() => closeAnalystView('graph')}>
                  إغلاق المستكشف
                </Button>
              </div>
              <InvestigationGraph
                compact
                data={data}
                openDetail={openDetail}
                timeRange={timeRange}
                anchor={`incident:${item.id}`}
                savedView={workspace.graphView}
                onViewChange={graphView => changeWorkspace(ws => ({ ...ws, graphView }))}
              />
            </div>
          )}
          {focused && (
            <p className="analyst-focus-notice" role="status">
              وضع التركيز نشط: أُخفيت الحقول الإضافية وتفسير الدرجة مؤقتًا. أوقفه لإظهارها؛ حالة
              الحادثة والإجراءات تبقى متاحة.
            </p>
          )}
          <div className="case-context-extras" hidden={focused}>
            <DetailGrid
              items={[
                ['الأصل المتأثر', ltr(item.asset, 'mono')],
                [
                  'MAC الأصل في السجل',
                  <EntityLink type="mac" value={asset?.mac || '—'} openDetail={openDetail} />,
                ],
                [
                  'عنوان المصدر',
                  <EntityLink type="ip" value={item.sourceIp} openDetail={openDetail} />,
                ],
                [
                  'عنوان الوجهة',
                  <EntityLink
                    type="ip"
                    value={item.destinationIp || item.ip}
                    openDetail={openDetail}
                  />,
                ],
                ['المسؤول', item.owner],
                ['تاريخ الإنشاء', item.date],
                ['مفتاح الربط', item.correlation],
                ['تقنية مرتبطة', ltr(item.technique, 'mono')],
              ]}
            />
            <p className="detail-muted">
              MAC الأصل مأخوذ من سجله الحالي في العينة، وليس دليلًا على عنوان مصدر أو وجهة مرصود.
            </p>
            <RiskExplanation item={item} baseline={asset?.baseline} />
            <div className="detail-section-title">
              <span>
                <GitBranch size={16} /> دورة حياة الحادثة
              </span>
            </div>
            <div className="steps">
              {['جديدة', 'مسندة', 'قيد المعالجة', 'محتواة', 'معالجة', 'مغلقة'].map((s, i) => {
                const current = [
                  'جديدة',
                  'مسندة',
                  'قيد المعالجة',
                  'محتواة',
                  'معالجة',
                  'مغلقة',
                ].indexOf(item.status);
                return (
                  <div
                    className={`${i === current ? 'current' : ''} ${i < current ? 'done' : ''}`}
                    key={s}
                  >
                    <i>{i < current ? <Check size={12} /> : ar(i + 1)}</i>
                    <span>{s}</span>
                  </div>
                );
              })}
            </div>
            <div className="sub-card">
              <div>
                <span className="small-device">
                  <Server size={17} />
                </span>
                <div>
                  <strong>سياق الأصل</strong>
                  <small>
                    {item.asset} · {asset?.criticality || 'غير محدد'} الأهمية
                  </small>
                </div>
              </div>
              <button className="text-link" onClick={() => asset && openDetail('asset', asset.id)}>
                عرض الأصل <ArrowLeft size={14} />
              </button>
            </div>
            <BusinessImpact assetId={asset?.id} compact />
          </div>
        </>
      )}
      {tab === 'alerts' && (
        <div className="related-list">
          {related.length ? (
            related.map(a => (
              <button key={a.id} className="related-row" onClick={() => openDetail('alert', a.id)}>
                <span className="incident-icon red">
                  <ShieldAlert size={16} />
                </span>
                <span>
                  <strong>{a.title}</strong>
                  <small dir="ltr">{a.id}</small>
                </span>
                <Severity value={a.severity} />
                <ChevronLeft size={16} />
              </button>
            ))
          ) : (
            <Empty
              title="لا توجد تنبيهات مفصّلة في العينة"
              text="قد تحتوي الحادثة على تنبيهات أخرى لم تُدرج تفاصيلها في الواجهة التجريبية."
            />
          )}
          <div className="inline-note">
            تظهر السجلات المرتبطة من العينة كاملة؛ قد يقع بعضها خارج الفترة العامة، ويظهر وقت كل سجل
            في تفاصيله.
          </div>
          <RelatedRecords
            title="أحداث مرتبطة بالتنبيهات المتاحة"
            items={relatedEvents}
            kind="event"
            openDetail={openDetail}
          />
        </div>
      )}
      {tab === 'followup' && (
        <SlaPreview
          incident={item}
          investigations={investigations}
          setInvestigations={setInvestigations}
          offlineSimulation={offlineSimulation}
        />
      )}
      {tab === 'workspace' && (
        <>
          {guided && (
            <div className="analyst-inline-actions">
              <Button type="button" onClick={openGuide}>
                العودة للتحقيق الموجّه
              </Button>
            </div>
          )}
          <IncidentWorkspace
            sessionRef={sessionRef}
            incidentId={item.id}
            incident={item}
            investigations={investigations}
            setInvestigations={setInvestigations}
            offlineSimulation={offlineSimulation}
            relatedAlerts={related}
            relatedEvents={relatedEvents}
            asset={asset}
            openDetail={openDetail}
            onIncidentContext={showIncidentOverview}
          />
        </>
      )}
      {tab === 'evidence' && (
        <EvidenceVault
          incident={item}
          relatedAlerts={related}
          relatedEvents={relatedEvents}
          investigations={investigations}
          setInvestigations={setInvestigations}
          openDetail={openDetail}
          offlineSimulation={offlineSimulation}
        />
      )}
      {tab === 'playbooks' && (
        <ResponsePlaybooks
          incident={item}
          investigations={investigations}
          setInvestigations={setInvestigations}
          offlineSimulation={offlineSimulation}
        />
      )}
      {tab === 'timeline' && (
        <>
          <div className="timeline-view-switch" role="group" aria-label="طريقة عرض تسلسل التحقيق">
            <button
              type="button"
              aria-pressed={timelineView === 'timeline'}
              onClick={() => setTimelineView('timeline')}
            >
              العرض الزمني
            </button>
            <button
              type="button"
              aria-pressed={timelineView === 'story'}
              onClick={() => setTimelineView('story')}
            >
              قصة التحقيق
            </button>
          </div>
          {timelineView === 'timeline' ? (
            <UnifiedTimeline
              incident={item}
              relatedAlerts={related}
              relatedEvents={relatedEvents}
              investigation={investigations[item.id]}
              openDetail={openDetail}
              timeRange={timeRange}
            />
          ) : (
            <AttackStoryboard
              incident={item}
              relatedAlerts={related}
              relatedEvents={relatedEvents}
              investigation={investigations[item.id]}
              triageRecords={triageRecords}
              openDetail={openDetail}
              onNotebook={() => setTab('workspace')}
              onIncidentContext={showIncidentOverview}
              timeRange={timeRange}
            />
          )}
        </>
      )}
      {tab === 'actions' && (
        <>
          <div className="detail-section-title">
            <span>
              <ListChecks size={16} /> إجراء الاستجابة
            </span>
            <Status value={item.approval} />
          </div>
          <div className="response-card">
            <div className="response-icon">
              <ShieldCheckIcon />
            </div>
            <div>
              <strong>طلب احتواء بموافقة بشرية</strong>
              <p>
                {item.containmentAction
                  ? `${item.containmentAction} · ${item.containmentTarget}`
                  : 'يمكن اقتراح حجب المصدر أو الوجهة عبر موصل معتمد بعد موافقة بشرية.'}{' '}
                لا يتم تنفيذ أي حجب هنا.
              </p>
            </div>
          </div>
          <div className="detail-actions">
            <Button
              icon={Plus}
              onClick={() => openModal('approval', { id: item.id, mode: 'request' })}
              disabled={
                offlineSimulation ||
                item.approval === 'بانتظار الموافقة' ||
                item.approval === 'تمت الموافقة'
              }
            >
              طلب الموافقة
            </Button>
            <Button
              variant="primary"
              icon={CheckCircle2}
              onClick={() => openModal('approval', { id: item.id, mode: 'approve' })}
              disabled={offlineSimulation || item.approval !== 'بانتظار الموافقة'}
            >
              مراجعة الموافقة
            </Button>
          </div>
          <p className="case-disabled-reason">
            {offlineSimulation
              ? 'الإجراءات متوقفة لأن محاكاة الانقطاع مفعّلة.'
              : item.approval === 'بانتظار الموافقة'
                ? 'لا يمكن إنشاء طلب آخر أثناء انتظار المراجعة.'
                : item.approval === 'تمت الموافقة'
                  ? 'تمت الموافقة في المثال؛ لا يوجد طلب معلّق للمراجعة.'
                  : item.approval === 'مرفوض'
                    ? 'رُفض الطلب؛ يمكن اقتراح طلب جديد.'
                    : item.approval === 'أعيد للتعديل'
                      ? 'أُعيد الطلب للتعديل ويمكن تقديمه مجددًا.'
                      : 'تتاح مراجعة الموافقة بعد تقديم طلب تجريبي.'}
          </p>
          <InfoBox tone="amber">
            الموافقة والإجراء محاكاة واجهة؛ لا يوجد موصل تنفيذ ولا تغيير حقيقي على الشبكة.
          </InfoBox>
          <div className="detail-section-title space-top">
            <span>
              <History size={16} /> سجل قرارات الطلب
            </span>
            <Tag>تجريبي</Tag>
          </div>
          {item.approvalHistory?.length ? (
            <ol className="approval-history">
              {item.approvalHistory.map((entry, i) => (
                <li key={`${entry.time}-${i}`}>
                  <strong>{entry.decision}</strong>
                  <small>
                    {entry.actor} · <bdi dir="ltr">{entry.time}</bdi>
                  </small>
                  <p>{entry.reason}</p>
                  <span>
                    {entry.action} · <bdi dir="ltr">{entry.target}</bdi>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="detail-muted">لا تتوافر تفاصيل قرارات سابقة لهذا السجل في العينة.</p>
          )}
          <div className="detail-section-title space-top">
            <span>
              <LockKeyhole size={16} /> الأدلة وسلسلة الحيازة
            </span>
          </div>
          <p className="detail-muted">
            لا توجد ملفات أدلة في هذه العينة. سيُسجَّل كل وصول أو تصدير للأدلة عند ربط النظام
            الحقيقي.
          </p>
        </>
      )}
    </div>
  );
}
