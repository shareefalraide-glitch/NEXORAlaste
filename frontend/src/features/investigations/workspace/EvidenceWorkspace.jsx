import { useLandmarkScope } from '../../../shared/hooks/landmark-scope';
import React, { useId, useState } from 'react';
import { ArrowLeft, FileSearch, GitBranch, LockKeyhole, Plus } from 'lucide-react';
import { ar, Button, InfoBox, Tag } from '../../../shared/ui/index';
import { defaultInvestigation } from './IncidentWorkspace';

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
function updateWorkspace(setInvestigations, incidentId, fn) {
  setInvestigations(current => ({
    ...current,
    [incidentId]: fn(current[incidentId] || defaultInvestigation()),
  }));
}
function EvidenceReference({ reference, onDelete, onAddEntry, offlineSimulation }) {
  const [actor, setActor] = useState(''),
    [action, setAction] = useState('مراجعة وصفية');
  const entries = reference.custody || [];
  return (
    <article className="evidence-record">
      <div className="evidence-record-head">
        <div>
          <strong>{reference.title}</strong>
          <small>
            {reference.type || 'مرجع نصي'} · {reference.source || 'مصدر غير محدد'}
          </small>
        </div>
        <button
          type="button"
          disabled={offlineSimulation}
          aria-label={`حذف المرجع ${reference.title}`}
          onClick={onDelete}
        >
          حذف
        </button>
      </div>
      <details>
        <summary>البيانات الوصفية وسجل الحيازة التوضيحي</summary>
        <div className="evidence-record-body">
          <dl>
            <div>
              <dt>معرّف المرجع المحلي</dt>
              <dd dir="ltr">{reference.id}</dd>
            </div>
            <div>
              <dt>وقت مدخل يدويًا</dt>
              <dd>
                <bdi dir="ltr">{reference.collectedAt || 'غير محدد'}</bdi> · غير موثوق
              </dd>
            </div>
            <div>
              <dt>بصمة نصية مدخلة</dt>
              <dd>
                <bdi dir="ltr">{reference.hash || 'غير متاحة'}</bdi>
                {reference.hash ? ' · غير متحقق منها' : ''}
              </dd>
            </div>
          </dl>
          <div className="custody-heading">
            <strong>سجل حيازة تصوري</strong>
            <Tag>{ar(entries.length)} إدخال</Tag>
          </div>
          <p>إدخالات وصفية غير موثوقة، بلا تحقق من الهوية أو الوقت أو سلامة الملفات.</p>
          {entries.length > 0 && (
            <ol className="custody-list">
              {entries.map(entry => (
                <li key={entry.id}>
                  <strong>{entry.action}</strong>
                  <span>{entry.actor} · جلسة غير مؤرخة</span>
                </li>
              ))}
            </ol>
          )}
          <div className="custody-form">
            <label>
              نوع الإدخال
              <select
                aria-label={`نوع حيازة ${reference.title}`}
                value={action}
                disabled={offlineSimulation}
                onChange={e => setAction(e.target.value)}
              >
                <option>مراجعة وصفية</option>
                <option>جمع وصفي</option>
                <option>تسليم وصفي</option>
              </select>
            </label>
            <label>
              اسم توضيحي غير حساس
              <input
                aria-label={`اسم حيازة ${reference.title}`}
                value={actor}
                maxLength={80}
                disabled={offlineSimulation}
                onChange={e => setActor(e.target.value)}
                placeholder="اسم في العينة"
              />
            </label>
            <Button
              type="button"
              disabled={!actor.trim() || offlineSimulation}
              onClick={() => {
                onAddEntry({ id: uid(), actor: actor.trim(), action });
                setActor('');
              }}
            >
              إضافة إدخال وصفي
            </Button>
          </div>
        </div>
      </details>
    </article>
  );
}
export default function EvidenceWorkspace({
  incident,
  relatedAlerts,
  relatedEvents,
  investigations,
  setInvestigations,
  openDetail,
  offlineSimulation,
}) {
  const landmark = useLandmarkScope();
  const [title, setTitle] = useState(''),
    [type, setType] = useState('مرجع نصي'),
    [source, setSource] = useState(''),
    [collectedAt, setCollectedAt] = useState(''),
    [hash, setHash] = useState('');
  const hashHint = useId(),
    references = investigations[incident.id]?.evidenceRefs || [],
    hashText = hash.trim();
  const invalidHash = !!hashText && !/^[a-fA-F0-9]{64}$/.test(hashText);
  const change = fn => updateWorkspace(setInvestigations, incident.id, fn);
  const add = () => {
    const text = title.trim();
    if (!text || invalidHash || offlineSimulation) return;
    change(ws => ({
      ...ws,
      evidenceRefs: [
        ...(ws.evidenceRefs || []),
        {
          id: `REF-${uid()}`,
          title: text,
          type,
          source: source.trim(),
          collectedAt,
          hash: hashText.toLowerCase(),
          custody: [],
        },
      ],
    }));
    setTitle('');
    setSource('');
    setCollectedAt('');
    setHash('');
  };
  return (
    <section className="evidence-workspace" aria-label={landmark('مراجع الأدلة التجريبية')}>
      <div className="experience-intro">
        <span>
          <LockKeyhole size={19} />
        </span>
        <div>
          <strong>مراجع الأدلة</strong>
          <p>
            سجلات مرتبطة من العينة كاملة وبيانات وصفية؛ قد تقع السجلات خارج الفترة، ولا توجد ملفات
            مرفوعة.
          </p>
        </div>
        <Tag color="blue">الجلسة فقط</Tag>
      </div>
      <InfoBox tone="amber" title="ليست خزنة أدلة فعلية">
        المراجع وسجل الحيازة أوصاف في ذاكرة الصفحة فقط؛ لا تحقق بصمة، ولا تشفير، ولا تخزين أدلة أو
        إثبات هوية أو سلسلة حيازة موثوقة. لا تُدخل معلومات حساسة.
      </InfoBox>
      <div className="experience-list">
        <h3>
          <FileSearch size={16} /> السجلات المتاحة في العينة
        </h3>
        {[
          ...relatedEvents.map(x => ({ kind: 'event', id: x.id, title: x.category })),
          ...relatedAlerts.map(x => ({ kind: 'alert', id: x.id, title: x.title })),
        ].map(x => (
          <button
            type="button"
            className="experience-list-row"
            key={x.id}
            onClick={() => openDetail(x.kind, x.id)}
          >
            <span>
              <strong>{x.title}</strong>
              <small>
                <bdi dir="ltr">{x.id}</bdi> · سجل افتراضي، ليس ملف دليل
              </small>
            </span>
            <ArrowLeft size={15} />
          </button>
        ))}
        {!relatedEvents.length && !relatedAlerts.length && (
          <p className="detail-muted">لا توجد سجلات مفصّلة مرتبطة في العينة.</p>
        )}
      </div>
      <div className="experience-list">
        <h3>
          <GitBranch size={16} /> مراجع وصفية للجلسة <Tag>{ar(references.length)}</Tag>
        </h3>
        {references.map(ref => (
          <EvidenceReference
            key={ref.id}
            reference={ref}
            offlineSimulation={offlineSimulation}
            onDelete={() =>
              change(ws => ({
                ...ws,
                evidenceRefs: (ws.evidenceRefs || []).filter(x => x.id !== ref.id),
              }))
            }
            onAddEntry={entry =>
              change(ws => ({
                ...ws,
                evidenceRefs: (ws.evidenceRefs || []).map(x =>
                  x.id === ref.id ? { ...x, custody: [...(x.custody || []), entry] } : x,
                ),
              }))
            }
          />
        ))}
        <div className="evidence-fields">
          <label>
            عنوان المرجع
            <input
              aria-label="عنوان المرجع التجريبي"
              value={title}
              maxLength={100}
              disabled={offlineSimulation}
              onChange={e => setTitle(e.target.value)}
              placeholder="عنوان مرجع غير حساس"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
            />
          </label>
          <label>
            النوع
            <select
              aria-label="نوع المرجع التجريبي"
              value={type}
              disabled={offlineSimulation}
              onChange={e => setType(e.target.value)}
            >
              <option>مرجع نصي</option>
              <option>سجل وصفي</option>
              <option>ملاحظة خارجية</option>
            </select>
          </label>
          <label>
            مصدر وصفي · اختياري
            <input
              aria-label="مصدر المرجع التجريبي"
              value={source}
              maxLength={100}
              disabled={offlineSimulation}
              onChange={e => setSource(e.target.value)}
              placeholder="مثال: سجل العينة"
            />
          </label>
          <label>
            وقت مدخل يدويًا · اختياري
            <input
              aria-label="وقت المرجع التجريبي"
              type="datetime-local"
              value={collectedAt}
              disabled={offlineSimulation}
              onChange={e => setCollectedAt(e.target.value)}
            />
          </label>
          <label className="evidence-hash">
            بصمة نصية SHA-256 · اختيارية
            <input
              aria-label="بصمة المرجع المدخلة"
              aria-describedby={hashHint}
              aria-invalid={invalidHash || undefined}
              dir="ltr"
              value={hash}
              maxLength={64}
              disabled={offlineSimulation}
              onChange={e => setHash(e.target.value)}
              placeholder="64 hexadecimal characters"
            />
            <small id={hashHint}>
              {invalidHash
                ? 'يجب أن تكون ٦٤ خانة سداسية، أو اتركها فارغة.'
                : 'قيمة يدوية للعرض فقط؛ لا تُحسب ولا يتم التحقق منها.'}
            </small>
          </label>
        </div>
        <div>
          <Button
            type="button"
            icon={Plus}
            disabled={offlineSimulation || !title.trim() || invalidHash}
            onClick={add}
          >
            إضافة مرجع
          </Button>
        </div>
        <p className="experience-footnote">
          لا ترفع الواجهة ملفات ولا تتحقق من سلامتها؛ تُمسح المراجع عند تحديث الصفحة أو الخروج.
        </p>
      </div>
    </section>
  );
}
