import { useLandmarkScope } from '../../../shared/hooks/landmark-scope';
import React from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, GitBranch, Pause, SearchCheck } from 'lucide-react';
import { ar, Button, InfoBox, Tag } from '../../../shared/ui/index';

const stages = [
  {
    id: 'context',
    title: 'ابدأ بسياق التنبيه',
    desc: 'راجع ما يقوله التنبيه وأصل العينة والعوامل المعروضة، وميّز نقص المعلومات عن النتائج المؤكدة.',
    action: 'فتح التنبيه المرتبط',
    target: 'alert',
  },
  {
    id: 'graph',
    title: 'استكشف الروابط',
    desc: 'وسّع علاقات السجلات المتاحة تدريجيًا، وافتح السجل المرجعي قبل تفسير أي علاقة.',
    action: 'فتح مستكشف التحقيق',
    target: 'graph',
  },
  {
    id: 'notebook',
    title: 'وثّق الملاحظات والأسئلة',
    desc: 'دوّن ما لاحظته، وافصل الفرضيات عن الأسئلة المفتوحة، واربط الملاحظة بالسجل المناسب.',
    action: 'فتح دفتر الحادثة',
    target: 'notebook',
  },
  {
    id: 'triage',
    title: 'راجع قرار التنبيه',
    desc: 'اختر قرارًا وسببًا وأولوية للمراجعة في الواجهة، أو اترك النتيجة غير محسومة حتى تتوفر معلومات كافية.',
    action: 'مراجعة التنبيه',
    target: 'triage',
  },
  {
    id: 'review',
    title: 'راجع الصورة قبل المتابعة',
    desc: 'تحقق من الملاحظات والقرارات وروابط السجلات، ثم عاين التقرير إن رغبت. لا يغلق الإرشاد الحادثة.',
    action: 'معاينة التقرير',
    target: 'report',
  },
];
export const initialGuided = () => ({ index: 0, visited: ['context'], status: 'active' });
export default function GuidedInvestigation({
  incident,
  progress,
  onProgress,
  onClose,
  onAction,
  hasAlert,
}) {
  const landmark = useLandmarkScope();
  const state = progress || initialGuided(),
    index = Math.max(0, Math.min(stages.length - 1, Number(state.index) || 0)),
    stage = stages[index];
  const visited = Array.isArray(state.visited) ? state.visited : [];
  const visit = next => {
    const target = Math.max(0, Math.min(stages.length - 1, next)),
      id = stages[target].id;
    onProgress({
      ...state,
      index: target,
      status: 'active',
      visited: [...new Set([...visited, id])],
    });
  };
  const pause = () => {
    onProgress({ ...state, status: 'paused' });
    onClose();
  };
  const finish = () => {
    onProgress({ ...state, status: 'finished' });
    onClose();
  };
  const unavailable = (stage.target === 'alert' || stage.target === 'triage') && !hasAlert;
  return (
    <section
      className="guided-investigation"
      aria-label={landmark('التحقيق الموجّه للحادثة')}
      tabIndex={-1}
    >
      <div className="guided-heading">
        <div>
          <span>
            <BookOpen size={16} /> التحقيق الموجّه
          </span>
          <h3>تحقيقك، وقرارك</h3>
          <p>
            مراحل استرشادية للحادثة <bdi dir="ltr">{incident.id}</bdi>؛ لا تعدّل حالة الحادثة أو
            تتخذ قرارًا بدلًا منك.
          </p>
        </div>
        <Tag color="blue">الجلسة فقط</Tag>
      </div>
      <div className="guided-progress">
        <span>
          مراحل زرتها{' '}
          <strong>
            {ar(visited.length)} من {ar(stages.length)}
          </strong>
        </span>
        <progress
          aria-label="المراحل المزارة في التحقيق الموجّه"
          value={visited.length}
          max={stages.length}
        />
      </div>
      <ol className="guided-steps" aria-label="مراحل التحقيق الموجّه">
        {stages.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              aria-current={i === index ? 'step' : undefined}
              onClick={() => visit(i)}
            >
              <span>{visited.includes(item.id) ? <CheckCircle2 size={16} /> : ar(i + 1)}</span>
              <b>{item.title}</b>
              <small>
                {i === index ? 'الحالية' : visited.includes(item.id) ? 'زرتها' : 'لم تُزر'}
              </small>
            </button>
          </li>
        ))}
      </ol>
      <div className="guided-stage">
        <div className="guided-stage-title">
          <span>
            <SearchCheck size={17} />
          </span>
          <div>
            <small>
              المرحلة {ar(index + 1)} من {ar(stages.length)}
            </small>
            <h4>{stage.title}</h4>
          </div>
        </div>
        <p>{stage.desc}</p>
        <Button
          type="button"
          icon={stage.target === 'graph' ? GitBranch : ArrowLeft}
          disabled={unavailable}
          onClick={() => onAction(stage.target)}
        >
          {stage.action}
        </Button>
        {unavailable && (
          <small className="guided-unavailable">
            لا يوجد تنبيه مفصّل مرتبط بهذه الحادثة في العينة.
          </small>
        )}
      </div>
      <InfoBox>
        زيارة المرحلة لا تعني إكمال مهمة أو اعتماد قرار. يمكن تخطي المراحل والعودة إليها؛ التقدم في
        ذاكرة الجلسة فقط.
      </InfoBox>
      <div className="guided-actions">
        <div>
          <Button type="button" icon={Pause} onClick={pause}>
            إيقاف مؤقت
          </Button>
          <Button type="button" onClick={() => onProgress(initialGuided())}>
            إعادة الإرشاد
          </Button>
        </div>
        <div>
          <Button type="button" disabled={index === 0} onClick={() => visit(index - 1)}>
            السابق
          </Button>
          {index < stages.length - 1 ? (
            <Button type="button" variant="primary" onClick={() => visit(index + 1)}>
              التالي
            </Button>
          ) : (
            <Button type="button" variant="primary" onClick={finish}>
              إنهاء الإرشاد
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
