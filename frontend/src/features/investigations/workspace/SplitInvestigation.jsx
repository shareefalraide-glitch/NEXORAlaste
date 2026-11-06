import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Columns2, GitCompareArrows, Link2, MoveHorizontal } from 'lucide-react';
import Details from '../details/Details';
import { assetForRecord } from '../../assets/asset-relations';
import { ar, Modal } from '../../../shared/ui/index';
import { LandmarkScope } from '../../../shared/hooks/landmark-scope';

// The two case trails and their drafts remain in memory; their underlying demo
// records are deliberately shared. There is no temporal synchronization.
function Pane({
  pane,
  index,
  active,
  onActivate,
  onNavigate,
  onBack,
  onJump,
  data,
  sessionRef,
  detailsProps,
}) {
  const body = useRef(null),
    current = pane.stack.at(-1),
    incident = data.incidents.find(item => item.id === pane.id);
  const rootAt = Math.max(
    0,
    pane.stack.findLastIndex(item => item.kind === 'incident' && item.id === pane.id),
  );
  const scrollKey = `${pane.id}:${current?.key || ''}`;
  useLayoutEffect(() => {
    const el = body.current;
    if (!el || !current) return;
    const memory = sessionRef.current.__drawerScroll || (sessionRef.current.__drawerScroll = {});
    el.scrollTop = memory[scrollKey] || 0;
    return () => {
      memory[scrollKey] = el.scrollTop;
    };
  }, [scrollKey, sessionRef]);
  const focusNew = () =>
    requestAnimationFrame(() =>
      body.current
        ?.querySelector('.split-layer:not([hidden]) .split-detail-heading')
        ?.focus({ preventScroll: true }),
    );
  return (
    <section
      id={`split-pane-${index}`}
      className={`split-pane ${active ? 'active' : ''}`}
      aria-label={`لوحة تحقيق ${pane.id}`}
      onFocusCapture={onActivate}
      onPointerDown={onActivate}
    >
      <header className="split-pane-head">
        <span>
          <Columns2 size={16} /> التحقيق {ar(index + 1)}
        </span>
        <strong dir="ltr">{pane.id}</strong>
        <small>{incident?.title || 'حادثة تجريبية'}</small>
      </header>
      <div className="split-pane-body" ref={body}>
        {pane.stack.map((selection, i) => (
          <div className="split-layer" hidden={i !== pane.stack.length - 1} key={selection.key}>
            <LandmarkScope.Provider value={pane.id}>
              <Details
                {...detailsProps}
                data={data}
                sessionRef={sessionRef}
                selection={selection}
                embedded
                history={pane.stack.slice(rootAt, i + 1)}
                workspaceTabs={{ state: { activeId: pane.id } }}
                onBack={() => {
                  onBack(index);
                  focusNew();
                }}
                onJump={at => {
                  onJump(index, rootAt + at);
                  focusNew();
                }}
                openDetail={(kind, id) => {
                  if (onNavigate(index, kind, id) !== false) focusNew();
                }}
              />
            </LandmarkScope.Provider>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function SplitInvestigation({
  initial,
  onChange,
  onClose,
  data,
  sessionRef,
  ...detailsProps
}) {
  const [panes, setPanes] = useState(initial.panes),
    [active, setActive] = useState(initial.active || 0),
    [ratio, setRatio] = useState(50),
    [notice, setNotice] = useState('');
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 960px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 960px)'),
      change = () => setNarrow(mq.matches);
    mq.addEventListener('change', change);
    return () => mq.removeEventListener('change', change);
  }, []);
  useLayoutEffect(() => {
    onChange({ panes, active });
  }, [panes, active, onChange]);
  const navigate = (index, kind, id) => {
    const pane = panes[index],
      other = panes[1 - index];
    if (!pane || !kind || !id) return;
    if (kind === 'incident' && id !== pane.id) {
      if (other?.id === id) {
        setActive(1 - index);
        setNotice('الحادثة مفتوحة في اللوحة الأخرى؛ انتقل إليها دون دمج المسارين.');
        requestAnimationFrame(() =>
          document
            .querySelector(
              `#split-pane-${1 - index} .split-layer:not([hidden]) .split-detail-heading`,
            )
            ?.focus({ preventScroll: true }),
        );
      } else setNotice('افتح الحادثة الأخرى من تبويبات التحقيق بعد إنهاء العرض المنقسم.');
      return false;
    }
    setNotice('');
    setPanes(current =>
      current.map((item, i) => {
        if (i !== index) return item;
        const root = item.stack.findLastIndex(
          entry => entry.kind === 'incident' && entry.id === item.id,
        );
        const existing = item.stack.findLastIndex(
          (entry, n) => n >= root && entry.kind === kind && entry.id === id,
        );
        if (existing >= root) return { ...item, stack: item.stack.slice(0, existing + 1) };
        return {
          ...item,
          stack: [
            ...item.stack,
            {
              kind,
              id,
              key: `split-${kind}-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            },
          ],
        };
      }),
    );
  };
  const back = index =>
    setPanes(current =>
      current.map((item, i) => {
        if (i !== index) return item;
        const root = item.stack.findLastIndex(
          entry => entry.kind === 'incident' && entry.id === item.id,
        );
        return item.stack.length > root + 1 ? { ...item, stack: item.stack.slice(0, -1) } : item;
      }),
    );
  const jump = (index, at) =>
    setPanes(current =>
      current.map((item, i) =>
        i === index ? { ...item, stack: item.stack.slice(0, at + 1) } : item,
      ),
    );
  const incidents = panes.map(pane => data.incidents.find(item => item.id === pane.id));
  const assets = incidents.map(item => item && assetForRecord(data.assets, item));
  const sameAsset = assets.every(Boolean) && assets[0].id === assets[1].id;
  const sources = incidents.map(item => String(item?.sourceIp || '').trim());
  const sameSource = !!sources[0] && sources[0] === sources[1];
  const [firstRecord, secondRecord] = panes.map(pane => pane.stack.at(-1));
  const sharedRecord =
    firstRecord &&
    secondRecord &&
    firstRecord.kind === secondRecord.kind &&
    firstRecord.id === secondRecord.id
      ? firstRecord
      : null;
  const sharedLabel =
    { alert: 'التنبيه', event: 'الحدث', asset: 'الأصل', source: 'مصدر البيانات', rule: 'القاعدة' }[
      sharedRecord?.kind
    ] || 'السجل';
  return (
    <Modal
      title="عرض تحقيقين"
      subtitle="مساران مستقلان · بيانات العينة مشتركة · الجلسة فقط"
      onClose={onClose}
      wide
      className="split-modal"
    >
      <div className="split-workspace">
        <div className="split-context">
          <div>
            <GitCompareArrows size={17} />
            <span>
              <strong>مقارنة سياق السجل</strong>
              <small>
                {sameAsset ? 'الأصل المسجل مشترك' : 'الأصل المسجل مختلف أو غير محدد'} ·{' '}
                {sameSource ? 'عنوان المصدر في السجل متطابق' : 'عنوان المصدر مختلف أو غير محدد'}
              </small>
            </span>
          </div>
          <p>التطابق لا يثبت علاقة أو سببية. لم تُفعّل مزامنة زمنية.</p>
        </div>
        <div className="split-sharing" role="note" aria-label="حدود الاستقلال والبيانات المشتركة">
          <span>
            <strong>مستقل</strong> المسار ومسودة الدفتر ومراجعة التنبيه لكل تحقيق.
          </span>
          <span>
            <strong>مشترك</strong> حالة السجل نفسه وقراراته المؤكدة في الجلسة.
          </span>
        </div>
        <div className="split-controls">
          <div className="split-mobile-tabs" role="group" aria-label="التبديل بين لوحتي التحقيق">
            {panes.map((pane, index) => (
              <button
                type="button"
                key={pane.id}
                aria-controls={`split-pane-${index}`}
                aria-pressed={active === index}
                onClick={() => setActive(index)}
              >
                التحقيق {ar(index + 1)} · <bdi dir="ltr">{pane.id}</bdi>
              </button>
            ))}
          </div>
          {!narrow && (
            <label className="split-resize">
              <MoveHorizontal size={16} />
              <span>حجم اللوحة الأولى</span>
              <input
                aria-label="حجم لوحة التحقيق الأولى"
                type="range"
                min="35"
                max="65"
                step="5"
                value={ratio}
                onChange={event => setRatio(Number(event.target.value))}
              />
              <output>{ar(ratio)}٪</output>
            </label>
          )}
        </div>
        {notice && (
          <p className="split-notice" role="status">
            {notice}
          </p>
        )}
        {sharedRecord && (
          <p className="split-shared-record" role="status">
            <Link2 size={15} aria-hidden="true" />
            <span>
              {sharedLabel} <bdi dir="ltr">{sharedRecord.id}</bdi> مفتوح في اللوحتين؛{' '}
              {sharedRecord.kind === 'alert'
                ? 'حالته وقراراته المؤكدة مشتركة، ومسودة المراجعة مستقلة لكل تحقيق.'
                : 'تعديلاته المؤكدة على السجل نفسه مشتركة في الجلسة.'}
            </span>
          </p>
        )}
        <div className="split-grid" style={{ '--split-first': `${ratio}%` }}>
          {panes.map((pane, index) => (
            <div key={pane.id} className="split-pane-wrap" hidden={narrow && active !== index}>
              <Pane
                pane={pane}
                index={index}
                active={active === index}
                onActivate={() => setActive(index)}
                onNavigate={navigate}
                onBack={back}
                onJump={jump}
                data={data}
                sessionRef={sessionRef}
                detailsProps={detailsProps}
              />
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
