import { useLandmarkScope } from '../../shared/hooks/landmark-scope';
import React, { useState } from 'react';
import { ClipboardCheck, History, SearchCheck } from 'lucide-react';
import { ar, Button, InfoBox, Tag } from '../../shared/ui/index';
import { useSessionValue } from '../../shared/hooks/session-state';
import { TRIAGE_CHOICES as choices, TRIAGE_PRIORITIES as priorities } from './triage-model';

export default function TriageAssistant({
  alert,
  history = [],
  submitTriage,
  offlineSimulation,
  sessionRef,
  workspaceId,
}) {
  const landmark = useLandmarkScope();
  const scope = `triage-draft:${workspaceId || 'ordinary'}:${alert.id}`;
  const [decision, setDecision] = useSessionValue(sessionRef, scope, 'decision', ''),
    [priority, setPriority] = useSessionValue(sessionRef, scope, 'priority', ''),
    [reason, setReason] = useSessionValue(sessionRef, scope, 'reason', ''),
    [note, setNote] = useSessionValue(sessionRef, scope, 'note', ''),
    [preview, setPreview] = useSessionValue(sessionRef, scope, 'preview', false),
    [error, setError] = useState('');
  const hasDraft = !!(decision || priority || reason || note);
  const decisionLabel = choices.find(x => x[0] === decision)?.[1],
    priorityLabel = priorities.find(x => x[0] === priority)?.[1];
  const prepare = () => {
    if (!decisionLabel || !priorityLabel || !reason.trim()) {
      setError('اختر القرار والأولوية واكتب سببًا قبل المعاينة.');
      return;
    }
    setError('');
    setPreview(true);
  };
  const submit = () => {
    if (offlineSimulation || !decisionLabel || !priorityLabel || !reason.trim()) return;
    const ok = submitTriage(alert.id, {
      decision,
      decisionLabel,
      priority,
      priorityLabel,
      reason: reason.trim(),
      note: note.trim(),
    });
    if (ok) {
      setPreview(false);
      setDecision('');
      setPriority('');
      setReason('');
      setNote('');
    }
  };
  return (
    <details className="triage-assistant">
      <summary>
        <span>
          <ClipboardCheck size={17} />
          <span>
            <strong>مساعد مراجعة التنبيه</strong>
            <small>
              {hasDraft ? 'مسودة غير مسجّلة محفوظة لهذه الجلسة' : 'قرار وسبب وأولوية يحددها المحلل'}
            </small>
          </span>
        </span>
        <Tag color="blue">محلي</Tag>
      </summary>
      <div className="triage-body">
        <InfoBox>
          مراجعة إرشادية بلا ذكاء اصطناعي أو تنفيذ. تُعلّم حالة التنبيه «تمت المراجعة» بعد التأكيد،
          لكن القرار قد يظل غير محسوم. الأولوية هنا لا تغيّر درجة الخطورة الأصلية.
        </InfoBox>
        {offlineSimulation && (
          <p className="preference-warning" role="status">
            يمكن قراءة سجل الجلسة فقط أثناء محاكاة الانقطاع.
          </p>
        )}
        {!preview ? (
          <>
            <div className="triage-fields">
              <label className="analyst-field">
                قرار المحلل <em>*</em>
                <select
                  aria-label="قرار مراجعة التنبيه"
                  value={decision}
                  disabled={offlineSimulation}
                  aria-required="true"
                  onChange={e => setDecision(e.target.value)}
                >
                  <option value="">اختر القرار</option>
                  {choices.map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="analyst-field">
                أولوية المراجعة <em>*</em>
                <select
                  aria-label="أولوية مراجعة التنبيه"
                  value={priority}
                  disabled={offlineSimulation}
                  aria-required="true"
                  onChange={e => setPriority(e.target.value)}
                >
                  <option value="">اختر الأولوية</option>
                  {priorities.map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="analyst-field">
              سبب القرار <em>*</em>
              <textarea
                aria-label="سبب قرار مراجعة التنبيه"
                aria-required="true"
                maxLength={400}
                value={reason}
                disabled={offlineSimulation}
                onChange={e => setReason(e.target.value)}
                placeholder="اكتب سببًا توضيحيًا غير حساس…"
              />
            </label>
            <label className="analyst-field">
              ملاحظة إضافية <small>اختيارية</small>
              <textarea
                aria-label="ملاحظة مراجعة التنبيه"
                maxLength={500}
                value={note}
                disabled={offlineSimulation}
                onChange={e => setNote(e.target.value)}
                placeholder="ما الذي يحتاجه المحلل التالي؟"
              />
            </label>
            {error && (
              <p role="alert" className="analyst-error">
                {error}
              </p>
            )}
            <div className="triage-buttons">
              <Button
                type="button"
                icon={SearchCheck}
                onClick={prepare}
                disabled={offlineSimulation || history.length >= 20}
              >
                معاينة القرار
              </Button>
              {history.length >= 20 && <small>بلغ سجل الجلسة حد ٢٠ قرارًا لهذا التنبيه.</small>}
            </div>
          </>
        ) : (
          <section className="triage-preview" aria-label={landmark('معاينة قرار المراجعة')}>
            <div className="triage-preview-head">
              <strong>معاينة قبل التسجيل</strong>
              <Tag>لم يُسجّل بعد</Tag>
            </div>
            <dl>
              <div>
                <dt>التنبيه</dt>
                <dd dir="ltr">{alert.id}</dd>
              </div>
              <div>
                <dt>القرار</dt>
                <dd>{decisionLabel}</dd>
              </div>
              <div>
                <dt>أولوية المراجعة</dt>
                <dd>{priorityLabel}</dd>
              </div>
              <div>
                <dt>السبب</dt>
                <dd>{reason.trim()}</dd>
              </div>
              {note.trim() && (
                <div>
                  <dt>الملاحظة</dt>
                  <dd>{note.trim()}</dd>
                </div>
              )}
            </dl>
            <p>هذا تغيير تجريبي فقط؛ لا يُصعّد أو يستبعد التنبيه من نظام حقيقي.</p>
            <div className="triage-buttons">
              <Button type="button" onClick={() => setPreview(false)}>
                تعديل
              </Button>
              <Button type="button" variant="primary" onClick={submit} disabled={offlineSimulation}>
                تأكيد تسجيل القرار
              </Button>
            </div>
          </section>
        )}
        <div className="triage-history-head">
          <strong>
            <History size={15} /> قرارات هذه الجلسة
          </strong>
          <Tag>{ar(history.length)}</Tag>
        </div>
        {history.length ? (
          <ol className="triage-history">
            {[...history].reverse().map(entry => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.decisionLabel}</strong>
                  <Tag>{entry.priorityLabel}</Tag>
                </div>
                <p>{entry.reason}</p>
                {entry.note && <p>{entry.note}</p>}
                <small>
                  محلل العرض التجريبي · وقت الجهاز <bdi dir="ltr">{entry.localTime}</bdi>
                </small>
              </li>
            ))}
          </ol>
        ) : (
          <p className="detail-muted">لا توجد قرارات محفوظة في هذه الجلسة لهذا التنبيه.</p>
        )}
        <p className="experience-footnote">
          التاريخ أعلاه وقت الجهاز وليس جزءًا من التسلسل التاريخي للعينة. البيانات مؤقتة وتُمسح عند
          التحديث أو الخروج، وليست سجل تدقيق.
        </p>
      </div>
    </details>
  );
}
