import React, { useState } from 'react';
import {
  ArrowLeft,
  BrainCircuit,
  FileSearch,
  MessageSquareText,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { events } from '../../data/fixtures/demo-records';
import { inPeriod, PERIOD_LABELS } from '../../shared/lib/time-scope';
import { ar, Button, InfoBox, Tag } from '../../shared/ui/index';

// This is a deliberately narrow, deterministic UI demonstration. It never
// sends text to a service, executes a command, or generates an AI inference.
function answerFor(question, incident, relatedAlerts, relatedEvents, counts, disabled, timeRange) {
  const q = question.trim().toLocaleLowerCase();
  let topic = 'unknown';
  if (/تغطي|قواعد|كشف|mitre|coverage|rule/.test(q)) topic = 'coverage';
  else if (/دليل|أدلة|ادلة|حدث|سجل|مصدر|evidence|event|source/.test(q)) topic = 'evidence';
  else if (/خطوة|الخطوه|تحقيق|تالي|افعل|إجراء|اجراء|next|investigat/.test(q)) topic = 'next';
  else if (/ملخص|لخص|الحالة|حال|summary|status/.test(q)) topic = 'summary';
  const scope = incident
    ? `${incident.id} · ${inPeriod(incident, 'incident', timeRange) ? 'ضمن الفترة' : 'خارج الفترة'}`
    : 'السياق العام';
  const refs = [];
  if (incident) refs.push({ kind: 'incident', id: incident.id, label: `الحادثة ${incident.id}` });
  if (relatedAlerts[0])
    refs.push({ kind: 'alert', id: relatedAlerts[0].id, label: `التنبيه ${relatedAlerts[0].id}` });
  if (relatedEvents[0])
    refs.push({ kind: 'event', id: relatedEvents[0].id, label: `الحدث ${relatedEvents[0].id}` });
  const observation = incident
    ? `الحادثة ${incident.id} حالتها «${incident.status}»، وبها ${ar(relatedAlerts.length)} تنبيه مفصّل و${ar(relatedEvents.length)} حدث مفصّل مرتبط عبر العينة كاملة، وقد تقع السجلات المرتبطة خارج الفترة.`
    : `ضمن ${PERIOD_LABELS[timeRange]}: ${ar(counts.incidents)} حادثة، و${ar(counts.alerts)} تنبيه، و${ar(counts.events)} حدث مفصّل في العينة.`;
  const disclaimer = 'هذه حقول عينة، وليست دليلًا على اختراق أو نتيجة تحليل مستقل.';
  if (topic === 'unknown')
    return {
      topic: 'قالب غير متاح',
      scope,
      observation: 'لم أجد قالبًا محليًا لهذا السؤال.',
      interpretation: 'لا يمكن استنتاج إجابة من السؤال الحر في هذا العرض.',
      next: 'جرّب سؤالًا عن ملخص الحالة أو الأدلة أو الخطوة التالية أو تغطية القواعد.',
      refs: [],
    };
  if (topic === 'coverage')
    return {
      topic: 'مراجعة التغطية',
      scope: 'قواعد العينة',
      observation: `توجد ${ar(disabled)} قاعدة معطّلة في عينة القواعد.`,
      interpretation: 'ربط قاعدة بتقنية لا يثبت أنها فعّالة أو مختبرة.',
      next: 'افتح مصفوفة MITRE وراجع القواعد المرتبطة واختبارها التوضيحي.',
      refs: [],
    };
  if (topic === 'evidence')
    return {
      topic: 'السجلات والمراجع',
      scope,
      observation,
      interpretation: relatedEvents[0]
        ? `نتيجة الحدث ${relatedEvents[0].id} في العينة: «${relatedEvents[0].outcome}» (${inPeriod(relatedEvents[0], 'event', timeRange) ? 'ضمن الفترة' : 'خارج الفترة'}). ${disclaimer}`
        : 'لا تتوفر سجلات تفصيلية كافية لهذا السياق لإثبات سبب أو نتيجة.',
      next: incident
        ? 'افتح السجلات المرتبطة وراجع مراجع الأدلة في ملف الحادثة؛ لا توجد ملفات أدلة هنا.'
        : 'اختر حادثة لتحديد السجلات ذات الصلة.',
      refs,
    };
  if (topic === 'next')
    return {
      topic: 'خطوة مقترحة للمراجعة',
      scope,
      observation,
      interpretation: 'الانتقال بين السجلات لا يثبت انتقال المهاجم، والقرارات تتطلب مراجعة بشرية.',
      next: incident
        ? 'راجع التنبيه والحدث والأصل، ثم وثّق المجهول قبل اقتراح أي إجراء.'
        : 'اختر حادثة ثم راجع التنبيه والحدث والأصل المرتبط.',
      refs,
    };
  return {
    topic: 'ملخص وصفي',
    scope,
    observation,
    interpretation: disclaimer,
    next: 'افتح السجلات للتحقق من التفاصيل والوقت قبل الاستنتاج.',
    refs,
  };
}

export default function DemoCopilot({
  data,
  timeRange = '24h',
  close,
  openDetail,
  go,
  initialIncidentId = '',
  history = [],
  setHistory = () => {},
  offlineSimulation = false,
}) {
  const [view, setView] = useState('summary'),
    [incidentId, setIncidentId] = useState(initialIncidentId),
    [question, setQuestion] = useState('');
  const incidents = data.incidents.filter(x => inPeriod(x, 'incident', timeRange)),
    alerts = data.alerts.filter(x => inPeriod(x, 'alert', timeRange)),
    eventCount = events.filter(x => inPeriod(x, 'event', timeRange)).length;
  const selected = data.incidents.find(x => x.id === incidentId),
    suggested = incidents.find(x => !['مغلقة', 'إنذار كاذب'].includes(x.status));
  const active = selected || (view === 'investigation' ? suggested : null);
  const relatedAlerts = active ? data.alerts.filter(a => a.incident === active.id) : [],
    relatedEvents = events.filter(e => relatedAlerts.some(a => a.id === e.alert));
  const disabled = data.rules.filter(x => !x.enabled).length;
  const openRef = ref => {
    close();
    openDetail(ref.kind, ref.id);
  };
  const send = () => {
    const text = question.trim();
    if (!text || offlineSimulation) return;
    const reply = answerFor(
      text,
      active,
      relatedAlerts,
      relatedEvents,
      { incidents: incidents.length, alerts: alerts.length, events: eventCount },
      disabled,
      timeRange,
    );
    setHistory(current =>
      [
        ...current,
        {
          id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          question: text,
          reply,
        },
      ].slice(-20),
    );
    setQuestion('');
  };
  return (
    <div className="demo-copilot">
      <div className="copilot-intro">
        <span>
          <Sparkles size={22} />
        </span>
        <div>
          <strong>مساعد استرشادي تجريبي</strong>
          <p>قوالب وقواعد عرض محلية؛ لا يوجد نموذج ذكاء اصطناعي أو اتصال بخدمة.</p>
        </div>
        <Tag color="blue">DEMO</Tag>
      </div>
      <label className="copilot-context">
        سياق المساعد{' '}
        <select
          aria-label="حادثة سياق المساعد"
          value={incidentId}
          onChange={e => setIncidentId(e.target.value)}
        >
          <option value="">السياق العام للعينة</option>
          {data.incidents.map(item => (
            <option key={item.id} value={item.id}>
              {item.id} · {item.title}
              {inPeriod(item, 'incident', timeRange) ? '' : ' · خارج الفترة'}
            </option>
          ))}
        </select>
      </label>
      {selected && !inPeriod(selected, 'incident', timeRange) && (
        <p className="copilot-context-warning">
          الحادثة المختارة خارج الفترة العامة؛ تُعرض بوضوح كسياق مستقل.
        </p>
      )}
      <div className="experience-pills" role="group" aria-label="اقتراحات المساعد التجريبي">
        <button type="button" aria-pressed={view === 'summary'} onClick={() => setView('summary')}>
          ملخص العينة
        </button>
        <button
          type="button"
          aria-pressed={view === 'investigation'}
          onClick={() => setView('investigation')}
        >
          ابدأ التحقيق
        </button>
        <button
          type="button"
          aria-pressed={view === 'coverage'}
          onClick={() => setView('coverage')}
        >
          راجع التغطية
        </button>
      </div>
      <div className="copilot-answer">
        {view === 'summary' ? (
          <>
            <div>
              <FileSearch size={18} />
              <strong>ملخص السجلات المفصّلة</strong>
            </div>
            <p>
              في {PERIOD_LABELS[timeRange]} من العينة: {ar(incidents.length)} حادثة،{' '}
              {ar(alerts.length)} تنبيه، و{ar(eventCount)} حدث مفصّل. هذه ليست إجماليات النشاط
              المستقلة في النظرة العامة.
            </p>
            {selected && (
              <p>
                السياق المختار: <bdi dir="ltr">{selected.id}</bdi> · {selected.status}.
              </p>
            )}
          </>
        ) : view === 'investigation' ? (
          <>
            <div>
              <ShieldAlert size={18} />
              <strong>{selected ? 'سياق الحادثة المختارة' : 'اقتراح من ترتيب العينة'}</strong>
            </div>
            <p>
              {active
                ? `يمكن مراجعة الحادثة ${active.id}، ثم فحص التنبيهات والأحداث المرتبطة بها.`
                : 'لا توجد حادثة مفتوحة متاحة ضمن الفترة العامة؛ يمكنك اختيار حادثة أخرى يدويًا.'}
            </p>
            {active && (
              <Button
                type="button"
                icon={ArrowLeft}
                onClick={() => openRef({ kind: 'incident', id: active.id })}
              >
                فتح الحادثة
              </Button>
            )}
          </>
        ) : (
          <>
            <div>
              <BrainCircuit size={18} />
              <strong>مراجعة الربط</strong>
            </div>
            <p>
              توجد {ar(disabled)} قاعدة معطّلة في عينة القواعد. راجع حالة الربط والاختبار في مصفوفة
              MITRE؛ الربط لا يثبت فعالية الكشف.
            </p>
            <Button
              type="button"
              icon={ArrowLeft}
              onClick={() => {
                close();
                go('mitre');
              }}
            >
              فتح المصفوفة
            </Button>
          </>
        )}
      </div>
      <section className="copilot-chat" aria-label="سجل أسئلة المساعد">
        <div className="copilot-chat-head">
          <span>
            <MessageSquareText size={17} />
            <strong>أسئلة بقوالب محدودة</strong>
          </span>
          <button
            type="button"
            disabled={!history.length || offlineSimulation}
            onClick={() => setHistory([])}
          >
            <Trash2 size={14} /> مسح السجل
          </button>
        </div>
        <p>
          جرّب «ما السجلات؟» أو «ما الخطوة التالية؟». السجل في ذاكرة الجلسة فقط؛ لا تكتب معلومات
          حساسة.
        </p>
        {history.length > 0 && (
          <div
            className="copilot-history"
            role="log"
            aria-label="محادثة استرشادية محلية"
            aria-live="polite"
          >
            {history.map(entry => (
              <article key={entry.id} className="copilot-exchange">
                <div className="copilot-question">
                  <span>
                    سؤالك · <bdi dir="auto">{entry.reply.scope}</bdi>
                  </span>
                  <p dir="auto">{entry.question}</p>
                </div>
                <div className="copilot-reply">
                  <strong>{entry.reply.topic}</strong>
                  <dl>
                    <div>
                      <dt>المتاح في العينة</dt>
                      <dd>{entry.reply.observation}</dd>
                    </div>
                    <div>
                      <dt>حد الاستنتاج</dt>
                      <dd>{entry.reply.interpretation}</dd>
                    </div>
                    <div>
                      <dt>تحقق مقترح</dt>
                      <dd>{entry.reply.next}</dd>
                    </div>
                  </dl>
                  {entry.reply.refs.length > 0 && (
                    <div className="copilot-references">
                      <span>مصادر العينة:</span>
                      {entry.reply.refs.map(ref => (
                        <button
                          type="button"
                          key={`${ref.kind}-${ref.id}`}
                          onClick={() => openRef(ref)}
                        >
                          {ref.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
        <label className="copilot-question-field">
          سؤال تجريبي غير حساس
          <textarea
            aria-label="سؤال للمساعد التجريبي"
            value={question}
            disabled={offlineSimulation}
            maxLength={300}
            rows="2"
            onChange={e => setQuestion(e.target.value)}
            placeholder="مثال: ما السجلات المرتبطة؟"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                send();
              }
            }}
          />
        </label>
        <div className="copilot-chat-actions">
          <small>
            {offlineSimulation
              ? 'الإدخال متوقف أثناء محاكاة الانقطاع.'
              : 'قوالب محلية فقط · Ctrl/⌘ + Enter للإرسال'}
          </small>
          <Button
            type="button"
            icon={Send}
            variant="primary"
            disabled={!question.trim() || offlineSimulation}
            onClick={send}
          >
            عرض الرد التجريبي
          </Button>
        </div>
      </section>
      <InfoBox>
        الردود قوالب محدودة على عينة محلية؛ لا يقدم المساعد حكمًا أمنيًا ولا ينفّذ أو يعتمد إجراءً.
        يُمسح السجل عند التحديث أو الخروج.
      </InfoBox>
    </div>
  );
}
