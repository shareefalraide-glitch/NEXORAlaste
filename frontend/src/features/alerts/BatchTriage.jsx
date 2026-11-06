import React, { useLayoutEffect, useRef, useState } from 'react';
import { ClipboardList, ListChecks, SearchCheck } from 'lucide-react';
import { ar, Button, InfoBox, Modal, Severity, Tag } from '../../shared/ui/index';
import {
  TRIAGE_CHOICES,
  TRIAGE_PRIORITIES,
  completeTriage,
  triageChoiceLabel,
  triagePriorityLabel,
  validateTriageBatch,
} from './triage-model';

const empty = () => ({ decision: '', priority: '', reason: '', note: '' });
export default function BatchTriage({
  ids,
  alerts,
  history,
  sessionRef,
  onClose,
  onComplete,
  submit,
  offlineSimulation,
}) {
  const selected = [...new Set(ids)],
    [active, setActive] = useState(selected[0] || ''),
    [preview, setPreview] = useState(false),
    [error, setError] = useState('');
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      selected.map(id => [
        id,
        { ...empty(), ...(sessionRef.current.__batchTriageDrafts?.[id] || {}) },
      ]),
    ),
  );
  const decisionRef = useRef(null);
  useLayoutEffect(() => {
    sessionRef.current.__batchTriageDrafts = {
      ...(sessionRef.current.__batchTriageDrafts || {}),
      ...drafts,
    };
  }, [drafts, sessionRef]);
  const edit = (field, value) =>
    setDrafts(previous => ({ ...previous, [active]: { ...previous[active], [field]: value } }));
  const values = selected.map(id => ({ id, ...(drafts[id] || empty()) })),
    valid = validateTriageBatch(values, alerts, history),
    current = alerts.find(item => item.id === active),
    draft = drafts[active] || empty();
  const completed = values.filter(completeTriage).length;
  const showPreview = () => {
    if (!valid.ok) {
      setError(valid.error);
      const incomplete = values.find(
        item => !completeTriage(item) || (history[item.id] || []).length >= 20,
      );
      if (incomplete) setActive(incomplete.id);
      requestAnimationFrame(() => decisionRef.current?.focus());
      return;
    }
    setError('');
    setPreview(true);
  };
  const confirm = () => {
    const checked = validateTriageBatch(values, alerts, history);
    if (!checked.ok || offlineSimulation) {
      setError(checked.error || 'الإجراء متوقف أثناء محاكاة الانقطاع.');
      return;
    }
    if (submit(values)) {
      const all = sessionRef.current.__batchTriageDrafts || {};
      selected.forEach(id => delete all[id]);
      onComplete?.();
      onClose();
    }
  };
  return (
    <Modal
      title="مراجعة مستقلة للتنبيهات"
      subtitle="قرار وأولوية وسبب لكل تنبيه، ثم معاينة واحدة قبل التأكيد"
      onClose={onClose}
      wide
      className="batch-modal"
    >
      <div className="modal-content batch-triage">
        <div className="batch-intro">
          <span>
            <ClipboardList size={19} />
          </span>
          <div>
            <strong>قائمة المراجعة</strong>
            <p>املأ كل تنبيه على حدة. لا تُنسخ القرارات بين التنبيهات ولا يُتخذ قرار تلقائي.</p>
          </div>
          <Tag color="blue">
            {ar(completed)} / {ar(selected.length)} مكتمل
          </Tag>
        </div>
        <InfoBox tone="amber">
          التأكيد يسجّل قرارات محلية ويغيّر حالة كل تنبيه إلى «تمت المراجعة» في العينة؛ لا يعني
          تنفيذ تصعيد أو إغلاق حقيقي. يمكن التراجع عن آخر دفعة.
        </InfoBox>
        {!preview ? (
          <div className="batch-layout">
            <div className="batch-queue" role="group" aria-label="قائمة التنبيهات المختارة">
              {selected.map(id => {
                const alert = alerts.find(item => item.id === id),
                  done = completeTriage(drafts[id]);
                return (
                  <button
                    type="button"
                    key={id}
                    aria-pressed={active === id}
                    onClick={() => {
                      setActive(id);
                      setError('');
                    }}
                  >
                    <span>
                      <bdi dir="ltr">{id}</bdi>
                      <small>{alert?.title || 'السجل غير متاح'}</small>
                    </span>
                    <Tag color={done ? 'green' : 'neutral'}>{done ? 'مكتمل' : 'يحتاج إدخالًا'}</Tag>
                  </button>
                );
              })}
            </div>
            {current && (
              <div className="batch-editor">
                <div className="batch-editor-head">
                  <div>
                    <strong>{current.title}</strong>
                    <small dir="ltr">
                      {current.id} · {current.asset}
                    </small>
                  </div>
                  <Severity value={current.severity} />
                </div>
                <div className="triage-fields">
                  <label className="analyst-field">
                    قرار هذا التنبيه <em>*</em>
                    <select
                      ref={decisionRef}
                      aria-label={`قرار التنبيه ${active}`}
                      value={draft.decision}
                      disabled={offlineSimulation}
                      onChange={event => edit('decision', event.target.value)}
                    >
                      <option value="">اختر القرار</option>
                      {TRIAGE_CHOICES.map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="analyst-field">
                    أولوية المراجعة <em>*</em>
                    <select
                      aria-label={`أولوية التنبيه ${active}`}
                      value={draft.priority}
                      disabled={offlineSimulation}
                      onChange={event => edit('priority', event.target.value)}
                    >
                      <option value="">اختر الأولوية</option>
                      {TRIAGE_PRIORITIES.map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="analyst-field">
                  سبب هذا القرار <em>*</em>
                  <textarea
                    aria-label={`سبب التنبيه ${active}`}
                    value={draft.reason}
                    maxLength={400}
                    disabled={offlineSimulation}
                    placeholder="اكتب سببًا مستقلًا غير حساس…"
                    onChange={event => edit('reason', event.target.value)}
                  />
                </label>
                <label className="analyst-field">
                  ملاحظة اختيارية
                  <textarea
                    aria-label={`ملاحظة التنبيه ${active}`}
                    value={draft.note}
                    maxLength={500}
                    disabled={offlineSimulation}
                    onChange={event => edit('note', event.target.value)}
                  />
                </label>
                <small>
                  سجل هذا التنبيه: {ar((history[active] || []).length)} من ٢٠ قرارًا في الجلسة.
                </small>
              </div>
            )}
          </div>
        ) : (
          <div className="batch-preview" role="region" aria-label="معاينة القرارات المستقلة">
            <div className="batch-preview-head">
              <strong>
                <ListChecks size={16} /> راجع القرارات قبل تسجيلها
              </strong>
              <Tag>لم تُسجّل بعد</Tag>
            </div>
            {values.map(value => {
              const item = alerts.find(alert => alert.id === value.id);
              return (
                <article key={value.id}>
                  <div>
                    <bdi dir="ltr">{value.id}</bdi>
                    <strong>{item?.title}</strong>
                  </div>
                  <dl>
                    <div>
                      <dt>القرار</dt>
                      <dd>{triageChoiceLabel(value.decision)}</dd>
                    </div>
                    <div>
                      <dt>الأولوية</dt>
                      <dd>{triagePriorityLabel(value.priority)}</dd>
                    </div>
                    <div>
                      <dt>السبب</dt>
                      <dd>{value.reason.trim()}</dd>
                    </div>
                    {value.note.trim() && (
                      <div>
                        <dt>الملاحظة</dt>
                        <dd>{value.note.trim()}</dd>
                      </div>
                    )}
                  </dl>
                </article>
              );
            })}
          </div>
        )}
        {error && (
          <p className="analyst-error batch-error" role="alert">
            {error}
          </p>
        )}
        <p className="experience-footnote">
          المسودات والقرارات مؤقتة وتُمسح عند إعادة التحميل أو تسجيل الخروج. لا تُرسل البيانات إلى
          خادم.
        </p>
        <div className="modal-actions">
          <Button type="button" onClick={onClose}>
            إغلاق
          </Button>
          {preview ? (
            <>
              <Button type="button" onClick={() => setPreview(false)}>
                تعديل القرارات
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={offlineSimulation}
                onClick={confirm}
              >
                تأكيد تسجيل القرارات
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="primary"
              icon={SearchCheck}
              disabled={offlineSimulation}
              onClick={showPreview}
            >
              معاينة القرارات المستقلة
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
