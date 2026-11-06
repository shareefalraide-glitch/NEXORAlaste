import React, { useState } from 'react';
import { ArrowDown, ArrowUp, GitBranch, Plus, Trash2 } from 'lucide-react';
import { ar, Button, InfoBox, Tag } from '../../../shared/ui/index';
import { defaultInvestigation } from './IncidentWorkspace';

const defaultSteps = () => [
  { id: 'step-context', kind: 'تحقق', text: 'راجع التنبيه والأصل المرتبط' },
  { id: 'step-evidence', kind: 'تحقق', text: 'افحص السجلات المتاحة وحدودها' },
  { id: 'step-approval', kind: 'موافقة', text: 'اطلب مراجعة بشرية قبل أي إجراء مقترح' },
];
export default function WorkflowDesigner({
  incident,
  investigations,
  setInvestigations,
  offlineSimulation,
}) {
  const [text, setText] = useState(''),
    [kind, setKind] = useState('تحقق');
  const steps = investigations[incident.id]?.workflowSteps || defaultSteps();
  const change = fn => {
    if (offlineSimulation) return;
    setInvestigations(current => {
      const ws = current[incident.id] || defaultInvestigation();
      return {
        ...current,
        [incident.id]: { ...ws, workflowSteps: fn(ws.workflowSteps || defaultSteps()) },
      };
    });
  };
  const move = (index, delta) =>
    change(items => {
      const next = [...items],
        to = index + delta;
      if (to < 0 || to >= next.length) return next;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  const add = () => {
    const value = text.trim();
    if (!value || steps.length >= 8 || offlineSimulation) return;
    change(items => [
      ...items,
      { id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind, text: value },
    ]);
    setText('');
  };
  return (
    <details className="workflow-designer">
      <summary>
        <span>
          <GitBranch size={17} />
          <strong>مصمم تدفق الاستجابة</strong>
        </span>
        <Tag color="blue">تصور محلي</Tag>
      </summary>
      <div className="workflow-body">
        <InfoBox>
          أنشئ ترتيبًا توضيحيًا للمراجعة فقط. لا تشغيل آلي، ولا قرارات أو موافقات حقيقية، ولا اتصال
          بأجهزة أو موصلات.
        </InfoBox>
        {steps.length ? (
          <ol className="workflow-steps">
            {steps.map((step, index) => (
              <li key={step.id}>
                <span className="workflow-number">{ar(index + 1)}</span>
                <div>
                  <strong>{step.text}</strong>
                  <small>{step.kind} · خطوة شكلية</small>
                </div>
                <div className="workflow-actions">
                  <button
                    type="button"
                    aria-label={`نقل خطوة ${step.text} لأعلى`}
                    disabled={offlineSimulation || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`نقل خطوة ${step.text} لأسفل`}
                    disabled={offlineSimulation || index === steps.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`حذف خطوة ${step.text}`}
                    disabled={offlineSimulation}
                    onClick={() => change(items => items.filter(x => x.id !== step.id))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="detail-muted">لا توجد خطوات في هذا التدفق التوضيحي.</p>
        )}
        <div className="workflow-add">
          <label>
            نوع الخطوة
            <select
              aria-label="نوع خطوة الاستجابة"
              value={kind}
              disabled={offlineSimulation}
              onChange={e => setKind(e.target.value)}
            >
              <option>تحقق</option>
              <option>قرار</option>
              <option>موافقة</option>
            </select>
          </label>
          <label>
            وصف الخطوة
            <input
              aria-label="وصف خطوة الاستجابة"
              value={text}
              disabled={offlineSimulation}
              maxLength={110}
              onChange={e => setText(e.target.value)}
              placeholder="خطوة توضيحية غير حساسة"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
            />
          </label>
          <Button
            type="button"
            icon={Plus}
            disabled={offlineSimulation || !text.trim() || steps.length >= 8}
            onClick={add}
          >
            إضافة خطوة
          </Button>
        </div>
        <p className="experience-footnote">
          حتى ٨ خطوات لكل حادثة · المحفوظ في ذاكرة الجلسة فقط، وليس سياسة استجابة فعلية.
        </p>
      </div>
    </details>
  );
}
