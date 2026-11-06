import { useLandmarkScope } from '../../../shared/hooks/landmark-scope';
import React from 'react';
import { ArrowLeft, CircleHelp, FileSearch, GitBranch, ListChecks } from 'lucide-react';
import { inPeriod, localSampleTime, recordTime } from '../../../shared/lib/time-scope';
import { ar, Button, Tag } from '../../../shared/ui/index';

const referencesFor = note =>
  Array.isArray(note.links) ? note.links : note.link ? [note.link] : [];

export default function AttackStoryboard({
  incident,
  relatedAlerts,
  relatedEvents,
  investigation,
  triageRecords = {},
  openDetail,
  onNotebook,
  onIncidentContext,
  timeRange = '24h',
}) {
  const landmark = useLandmarkScope();
  const records = [
    { kind: 'incident', item: incident, title: 'سجل الحادثة', description: incident.title },
    ...relatedAlerts.map(item => ({
      kind: 'alert',
      item,
      title: 'تنبيه مرتبط',
      description: item.title,
    })),
    ...relatedEvents.map(item => ({
      kind: 'event',
      item,
      title: 'حدث مرتبط',
      description: `${item.category} · النتيجة: ${item.outcome}`,
    })),
  ]
    .map(entry => ({
      ...entry,
      time: recordTime(entry.item, entry.kind),
      outside: !inPeriod(entry.item, entry.kind, timeRange),
    }))
    .sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));
  const notes = investigation?.notes || [],
    hypotheses = notes.filter(n => n.type === 'hypothesis' || n.type === 'conclusion'),
    questions = notes.filter(n => n.type === 'question' && !n.resolved);
  const decisions = relatedAlerts.flatMap(alert =>
    (triageRecords[alert.id] || []).map(entry => ({ ...entry, alertId: alert.id })),
  );
  return (
    <section className="attack-storyboard" aria-label={landmark('قصة التحقيق التجريبية')}>
      <div className="story-heading">
        <div>
          <span>
            <GitBranch size={16} /> قصة التحقيق
          </span>
          <h3>ما نراه، وما نفترضه، وما لا نعرفه</h3>
          <p>منظور بصري للسجلات وملاحظات المحلل، لا سرد آلي لمسار هجوم.</p>
        </div>
        <Tag color="blue">عينة محلية</Tag>
      </div>
      <div className="story-legend">
        <span>
          <i className="story-evidence-dot" /> سجل في العينة
        </span>
        <span>
          <i className="story-hypothesis-dot" /> رأي أو فرضية المحلل
        </span>
        <span>
          <i className="story-unknown-dot" /> سؤال غير محسوم
        </span>
      </div>
      <div className="story-lane">
        <div className="story-lane-heading">
          <strong>
            <FileSearch size={16} /> السجلات المتاحة
          </strong>
          <Tag>{ar(records.length)}</Tag>
        </div>
        <p>مرتبة بحسب الوقت المتاح؛ اقترانها لا يثبت تسلسل هجوم أو نجاح دخول.</p>
        <div className="story-cards">
          {records.map(entry => (
            <article className="story-card evidence" key={`${entry.kind}-${entry.item.id}`}>
              <div>
                <small>{entry.title}</small>
                <Tag color="blue">سجل في العينة</Tag>
              </div>
              <strong>{entry.description}</strong>
              <span>
                <bdi dir="ltr">{entry.item.id}</bdi> ·{' '}
                {entry.time === null ? 'وقت غير متاح' : localSampleTime(entry.time, true)}
                {entry.outside ? ' · خارج الفترة العامة' : ''}
              </span>
              {entry.kind === 'incident' ? (
                <small>الحادثة المفتوحة حاليًا</small>
              ) : (
                <button type="button" onClick={() => openDetail(entry.kind, entry.item.id)}>
                  فتح السجل <ArrowLeft size={14} />
                </button>
              )}
            </article>
          ))}
        </div>
      </div>
      <div className="story-lane">
        <div className="story-lane-heading">
          <strong>
            <GitBranch size={16} /> استنتاجات وفرضيات المحلل
          </strong>
          <Tag>{ar(hypotheses.length)}</Tag>
        </div>
        <p>من دفتر الحادثة؛ لا تتحول إلى حقائق بمجرد ظهورها هنا.</p>
        {hypotheses.length ? (
          <div className="story-cards">
            {hypotheses.map(note => (
              <article className="story-card hypothesis" key={note.id}>
                <div>
                  <small>{note.type === 'hypothesis' ? 'فرضية غير مثبتة' : 'استنتاج المحلل'}</small>
                  <Tag color="purple">جلسة</Tag>
                </div>
                <strong>{note.text}</strong>
                {referencesFor(note).map(ref => (
                  <button
                    type="button"
                    key={`${ref.kind}-${ref.id}`}
                    aria-label={`فتح السجل المرتبط ${ref.id}`}
                    onClick={() => {
                      if (ref.kind === 'incident' && ref.id === incident.id) onIncidentContext();
                      else openDetail(ref.kind, ref.id);
                    }}
                  >
                    فتح السجل المرتبط <bdi dir="ltr">{ref.id}</bdi> <ArrowLeft size={14} />
                  </button>
                ))}
              </article>
            ))}
          </div>
        ) : (
          <div className="story-empty">لا توجد فرضيات أو استنتاجات مدوّنة بعد.</div>
        )}
      </div>
      <div className="story-lane">
        <div className="story-lane-heading">
          <strong>
            <CircleHelp size={16} /> أسئلة تحتاج إجابة
          </strong>
          <Tag>{ar(questions.length)}</Tag>
        </div>
        {questions.length ? (
          <div className="story-cards">
            {questions.map(note => (
              <article className="story-card unknown" key={note.id}>
                <div>
                  <small>سؤال مفتوح</small>
                  <Tag color="orange">غير محسوم</Tag>
                </div>
                <strong>{note.text}</strong>
                {referencesFor(note).map(ref => (
                  <button
                    type="button"
                    key={`${ref.kind}-${ref.id}`}
                    aria-label={`فتح السجل المرتبط ${ref.id}`}
                    onClick={() => {
                      if (ref.kind === 'incident' && ref.id === incident.id) onIncidentContext();
                      else openDetail(ref.kind, ref.id);
                    }}
                  >
                    فتح السجل المرتبط <bdi dir="ltr">{ref.id}</bdi> <ArrowLeft size={14} />
                  </button>
                ))}
              </article>
            ))}
          </div>
        ) : (
          <div className="story-empty">لا توجد أسئلة مفتوحة في دفتر هذه الحادثة.</div>
        )}
      </div>
      <div className="story-lane">
        <div className="story-lane-heading">
          <strong>
            <ListChecks size={16} /> قرارات مراجعة الجلسة
          </strong>
          <Tag>{ar(decisions.length)}</Tag>
        </div>
        {decisions.length ? (
          <div className="story-cards">
            {decisions.map(entry => (
              <article className="story-card decision" key={entry.id}>
                <div>
                  <small>{entry.decisionLabel}</small>
                  <Tag>{entry.priorityLabel}</Tag>
                </div>
                <strong>{entry.reason}</strong>
                <span>
                  وقت الجهاز · <bdi dir="ltr">{entry.localTime}</bdi>
                </span>
                <button type="button" onClick={() => openDetail('alert', entry.alertId)}>
                  فتح التنبيه <ArrowLeft size={14} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="story-empty">لم تُسجّل قرارات للتنبيهات المرتبطة في هذه الجلسة.</div>
        )}
      </div>
      <div className="story-footer">
        <Button type="button" onClick={onNotebook}>
          فتح دفتر الحادثة
        </Button>
        <small>الملاحظات والقرارات مؤقتة وغير مؤرخة ضمن العينة، وليست سجل أدلة.</small>
      </div>
    </section>
  );
}
