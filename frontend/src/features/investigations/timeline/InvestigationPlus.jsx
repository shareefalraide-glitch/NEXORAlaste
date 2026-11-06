import { useLandmarkScope } from '../../../shared/hooks/landmark-scope';
import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  GitBranch,
  History,
  LockKeyhole,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { ar, Button, InfoBox, Tag } from '../../../shared/ui/index';
import { defaultInvestigation } from '../workspace/IncidentWorkspace';
import WorkflowDesigner from '../workspace/WorkflowDesigner';
export { default as EvidenceVault } from '../workspace/EvidenceWorkspace';
import {
  SAMPLE_END_UTC,
  inPeriod,
  localSampleTime,
  recordTime,
} from '../../../shared/lib/time-scope';
import { noteReferences, NOTE_TYPES } from '../notebook/notebook-model';

const categories = [
  ['all', 'الكل'],
  ['event', 'الأحداث'],
  ['alert', 'التنبيهات'],
  ['action', 'الإجراءات'],
  ['note', 'الملاحظات'],
];
function fixtureActionTime(incident, entry) {
  if (entry.session) return null; // Device-clock session actions cannot be ordered into the historical sample.
  const base = recordTime(incident, 'incident'),
    match = /^(\d{2}):(\d{2})$/.exec(String(entry.time || ''));
  if (base === null || !match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  const localDay = new Date(base + 3 * 3600000);
  localDay.setUTCHours(Number(match[1]), Number(match[2]), 0, 0);
  return localDay.getTime() - 3 * 3600000;
}

export function UnifiedTimeline({
  incident,
  relatedAlerts,
  relatedEvents,
  investigation,
  openDetail,
  timeRange,
}) {
  const landmark = useLandmarkScope();
  const [category, setCategory] = useState('all'),
    [selectedKey, setSelectedKey] = useState(''),
    [zoom, setZoom] = useState('all');
  const actionItems = (incident.timeline || []).map((entry, i) => ({
    key: `action-${i}`,
    type: 'action',
    title: entry.title,
    description: entry.detail,
    actor: entry.actor,
    time: fixtureActionTime(incident, entry),
    session: !!entry.session,
    display: entry.time,
  }));
  const alertItems = relatedAlerts.map(a => ({
    key: `alert-${a.id}`,
    type: 'alert',
    title: a.title,
    description: `تنبيه ${a.id} · ${a.severity}`,
    time: recordTime(a, 'alert'),
    recordKind: 'alert',
    recordId: a.id,
  }));
  const eventItems = relatedEvents.map(e => ({
    key: `event-${e.id}`,
    type: 'event',
    title: e.category,
    description: `حدث ${e.id} · ${e.outcome}`,
    time: recordTime(e, 'event'),
    recordKind: 'event',
    recordId: e.id,
  }));
  const noteItems = (investigation?.notes || []).map((n, i) => ({
    key: `note-${n.id}`,
    type: 'note',
    title: `ملاحظة الجلسة ${ar(i + 1)}`,
    description: n.text,
    time: null,
    session: true,
  }));
  const all = [...eventItems, ...alertItems, ...actionItems, ...noteItems].filter(
    x => category === 'all' || x.type === category,
  );
  const dated = all
    .filter(
      x =>
        x.time !== null &&
        inPeriod({ sampleTime: x.time }, 'event', timeRange, { includeUndated: false }),
    )
    .sort((a, b) => a.time - b.time);
  const undated = all.filter(x => x.time === null);
  const selected = dated.find(x => x.key === selectedKey) || dated[0],
    selectedIndex = selected ? dated.findIndex(x => x.key === selected.key) : -1;
  const shown =
    zoom === 'focus' && selected
      ? dated.filter(x => Math.abs(x.time - selected.time) <= 3600000)
      : dated;
  const render = item => (
    <li
      key={item.key}
      className={`unified-item ${item.type} ${item.key === selected?.key ? 'is-selected' : ''}`}
    >
      <span className="unified-dot" />
      <div>
        <div className="unified-head">
          <strong>{item.title}</strong>
          <time dir="ltr">
            {item.time === null
              ? item.session
                ? 'جلسة · خارج زمن العينة'
                : 'وقت غير متاح'
              : localSampleTime(item.time, true)}
          </time>
        </div>
        <p>{item.description}</p>
        <small>
          {item.actor ? `${item.actor} · ` : ''}
          {item.type === 'action' && item.time !== null
            ? 'تاريخ مستند إلى يوم الحادثة · تجريبي'
            : item.type === 'event'
              ? 'حدث مفصّل في العينة'
              : item.type === 'alert'
                ? 'تنبيه مفصّل في العينة'
                : 'عنصر جلسة غير مؤرّخ ضمن العينة'}
        </small>
        {item.recordId &&
          (() => {
            const linked = (investigation?.notes || []).filter(note =>
              noteReferences(note).some(
                ref => ref.kind === item.recordKind && ref.id === item.recordId,
              ),
            );
            return linked.length ? (
              <aside
                className="timeline-linked-notes"
                aria-label={landmark(`ملاحظات الجلسة المرتبطة ${item.recordId}`)}
              >
                <strong>ملاحظات الجلسة المرتبطة بالسجل · ليست مؤرخة في زمن العينة</strong>
                {linked.map(note => (
                  <p key={note.id}>
                    <b>{NOTE_TYPES[note.type] || NOTE_TYPES.observation}:</b> {note.text}
                  </p>
                ))}
              </aside>
            ) : null;
          })()}
        <div className="timeline-entry-actions">
          {item.time !== null && (
            <button
              type="button"
              aria-pressed={item.key === selected?.key}
              onClick={() => setSelectedKey(item.key)}
            >
              تحديد العنصر
            </button>
          )}
          {item.recordId && (
            <button
              type="button"
              className="text-link"
              onClick={() => openDetail(item.recordKind, item.recordId)}
            >
              فتح السجل <ArrowLeft size={14} />
            </button>
          )}
        </div>
      </div>
    </li>
  );
  return (
    <section className="unified-timeline" aria-label={landmark('الخط الزمني الموحّد للتحقيق')}>
      <div className="experience-intro">
        <span>
          <History size={19} />
        </span>
        <div>
          <strong>الخط الزمني الموحّد</strong>
          <p>الأحداث والتنبيهات والقرارات المتاحة للحادثة، مرتّبة حسب وقت العينة.</p>
        </div>
        <Tag color="blue">UTC+03</Tag>
      </div>
      <div className="experience-pills" role="group" aria-label="أنواع عناصر الخط الزمني">
        {categories.map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={category === id}
            onClick={() => setCategory(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {dated.length > 0 && (
        <div className="timeline-navigator">
          <label>
            نطاق العرض{' '}
            <select
              aria-label="تكبير الخط الزمني"
              value={zoom}
              onChange={e => setZoom(e.target.value)}
            >
              <option value="all">كل عناصر الفترة</option>
              <option value="focus">ساعة قبل المحدد وساعة بعده</option>
            </select>
          </label>
          <div className="timeline-selected" role="status" aria-live="polite">
            <strong>{selected.title}</strong>
            <small>
              {localSampleTime(selected.time, true)} · {ar(selectedIndex + 1)} من {ar(dated.length)}
            </small>
            <p>{selected.description}</p>
          </div>
          <div className="timeline-navigation">
            <button
              type="button"
              disabled={selectedIndex <= 0}
              onClick={() => setSelectedKey(dated[selectedIndex - 1].key)}
            >
              السابق زمنيًا
            </button>
            <button
              type="button"
              disabled={selectedIndex >= dated.length - 1}
              onClick={() => setSelectedKey(dated[selectedIndex + 1].key)}
            >
              التالي زمنيًا
            </button>
            {selected.recordId && (
              <button
                type="button"
                onClick={() => openDetail(selected.recordKind, selected.recordId)}
              >
                تفاصيل العنصر المحدد
              </button>
            )}
          </div>
        </div>
      )}
      {dated.length ? (
        <ol className="unified-list">{shown.map(render)}</ol>
      ) : (
        <p className="detail-muted">لا توجد عناصر مؤرّخة من هذا النوع ضمن الفترة العامة.</p>
      )}
      {undated.length > 0 && (
        <>
          <div className="experience-divider">
            عناصر جلسة أو عناصر بلا وقت عينة · لا تدخل في الترتيب التاريخي
          </div>
          <ol className="unified-list undated">{undated.map(render)}</ol>
        </>
      )}
      <p className="experience-footnote">
        أوقات إجراءات السجل الأصلية تعرض ساعة فقط؛ تاريخها مستند إلى تاريخ الحادثة. تغييرات الجلسة
        لا تُخلط زمنيًا مع العينة.
      </p>
    </section>
  );
}

function changeWorkspace(setInvestigations, incidentId, fn) {
  setInvestigations(current => ({
    ...current,
    [incidentId]: fn(current[incidentId] || defaultInvestigation()),
  }));
}
const templates = [
  {
    id: 'authentication',
    name: 'مراجعة مصادقة مشبوهة',
    description: 'قائمة تحقق إرشادية للتعامل مع مثال المصادقة.',
    steps: [
      'راجع التنبيه والأصل المتأثر',
      'افحص سجلات المصادقة المرتبطة',
      'وثّق التوصية واطلب مراجعة بشرية',
    ],
  },
  {
    id: 'network',
    name: 'مراجعة اتصال غير معتاد',
    description: 'قائمة تحقق إرشادية لسياق حركة الشبكة.',
    steps: [
      'راجع عنوان المصدر والوجهة',
      'افحص السجلات وفترة العينة',
      'وثّق ما هو معروف وما يحتاج تحققًا',
    ],
  },
  {
    id: 'containment',
    name: 'اقتراح احتواء للمراجعة',
    description: 'يوضح نقطة الموافقة؛ لا ينفّذ أي إجراء.',
    steps: [
      'حدد الهدف المقترح في التحقيق',
      'راجع أثر الإجراء وحدود الدليل',
      'اطلب موافقة بشرية من قسم الإجراءات',
    ],
  },
];
export function ResponsePlaybooks({
  incident,
  investigations,
  setInvestigations,
  offlineSimulation,
}) {
  const landmark = useLandmarkScope();
  const [id, setId] = useState('authentication'),
    template = templates.find(x => x.id === id),
    progress = investigations[incident.id]?.playbookProgress || {};
  const toggle = index => {
    if (offlineSimulation) return;
    const key = `${id}:${index}`;
    changeWorkspace(setInvestigations, incident.id, ws => ({
      ...ws,
      playbookProgress: { ...(ws.playbookProgress || {}), [key]: !ws.playbookProgress?.[key] },
    }));
  };
  return (
    <section className="playbook-workspace" aria-label={landmark('قوالب الاستجابة التجريبية')}>
      <div className="experience-intro">
        <span>
          <ClipboardList size={19} />
        </span>
        <div>
          <strong>قوالب الاستجابة</strong>
          <p>قائمة إرشادية قابلة للتأشير في الجلسة، وليست تنفيذًا آليًا.</p>
        </div>
        <Tag color="blue">محاكاة</Tag>
      </div>
      <label className="experience-field">
        اختر القالب
        <select value={id} onChange={e => setId(e.target.value)}>
          {templates.map(t => (
            <option value={t.id} key={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <p className="detail-muted">{template.description}</p>
      <div className="playbook-steps">
        {template.steps.map((step, i) => (
          <label key={step}>
            <input
              type="checkbox"
              checked={!!progress[`${id}:${i}`]}
              disabled={offlineSimulation}
              onChange={() => toggle(i)}
            />
            <span>
              <strong>{step}</strong>
              <small>تأشير توضيحي فقط</small>
            </span>
            <CheckCircle2 size={17} />
          </label>
        ))}
      </div>
      <div className="playbook-approval">
        <ShieldCheck size={18} />
        <span>
          <strong>الموافقة البشرية: {incident.approval}</strong>
          <small>تدار في تبويب الإجراءات. لن تنفذ القوالب أي حجب أو تغيير على الشبكة.</small>
        </span>
      </div>
      <WorkflowDesigner
        incident={incident}
        investigations={investigations}
        setInvestigations={setInvestigations}
        offlineSimulation={offlineSimulation}
      />
      <p className="experience-footnote">
        التقدم مؤقت ويختفي عند إعادة التحميل أو تسجيل الخروج. نهاية العينة المرجعية:{' '}
        {localSampleTime(SAMPLE_END_UTC, true)}.
      </p>
    </section>
  );
}
