import React, { useState } from 'react';
import {
  CircleHelp,
  Fingerprint,
  GitBranch,
  Link2,
  Server,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { events } from '../../data/fixtures/demo-records';
import { inPeriod } from '../../shared/lib/time-scope';
import { Button, InfoBox, Panel, PanelHeading, Tag } from '../../shared/ui/index';

export default function AttackPath({ data, openDetail, timeRange = '24h' }) {
  const [showHypothesis, setShowHypothesis] = useState(true),
    event = events.find(e => e.id === 'EVT-90481'),
    inScope = event && inPeriod(event, 'event', timeRange);
  const nodes = [
    {
      id: 'source',
      icon: Fingerprint,
      kicker: 'حقل في حدث العينة',
      title: '198.51.100.23',
      desc: 'عنوان مصدر محاولة مصادقة فاشلة',
      kind: 'entity',
      record: 'ip|198.51.100.23',
      observed: true,
    },
    {
      id: 'host',
      icon: Server,
      kicker: 'أصل مرتبط في العينة',
      title: 'AD-SRV-01',
      desc: 'الأصل المرتبط بالحدث التجريبي',
      kind: 'asset',
      record: 'AST-001',
      observed: true,
    },
    {
      id: 'user',
      icon: UserRound,
      kicker: 'حقل في حدث العينة',
      title: 'svc-auth',
      desc: 'هوية مذكورة في الحدث؛ ليس دليلًا على اختراقها',
      kind: 'entity',
      record: 'user|svc-auth',
      observed: true,
    },
    {
      id: 'scenario',
      icon: ShieldAlert,
      kicker: 'افتراض مستقل',
      title: 'DB-SRV-03',
      desc: 'خطوة محتملة للشرح فقط؛ لا دليل على انتقال إليها',
      kind: 'asset',
      record: 'AST-002',
      observed: false,
    },
  ].filter(x => showHypothesis || x.observed);
  return (
    <Panel className="attack-path-panel">
      <PanelHeading
        title="مسار افتراضي للتحقيق"
        subtitle="اقتران حقول السجل ليس مسارًا مثبتًا؛ الخطوة الأخيرة افتراضية."
        icon={GitBranch}
        aside={<Tag color="blue">سيناريو تجريبي</Tag>}
      />
      <div className="attack-path-tools">
        <label>
          <input
            type="checkbox"
            checked={showHypothesis}
            onChange={e => setShowHypothesis(e.target.checked)}
          />{' '}
          إظهار الخطوة الافتراضية
        </label>
        <span>
          <i className="observed" /> حقل أو سجل في العينة
        </span>
        <span>
          <i className="hypothetical" /> افتراض غير مثبت
        </span>
      </div>
      <div className="attack-path-nodes">
        {nodes.map((node, i) => (
          <React.Fragment key={node.id}>
            {i > 0 && (
              <div className={`attack-connector ${node.observed ? 'association' : 'hypothetical'}`}>
                <Link2 size={16} aria-hidden="true" />
                <small>
                  {node.observed ? 'اقتران في السجل، لا انتقال' : 'افتراض دون سجل انتقال'}
                </small>
              </div>
            )}
            <button
              type="button"
              className={`attack-node ${node.observed ? 'observed' : 'hypothetical'}`}
              onClick={() => openDetail(node.kind, node.record)}
            >
              <span className="attack-node-icon">
                <node.icon size={18} />
              </span>
              <small>{node.kicker}</small>
              <strong dir="ltr">{node.title}</strong>
              <p>{node.desc}</p>
              <b>فتح السياق</b>
            </button>
          </React.Fragment>
        ))}
      </div>
      <div className="attack-evidence">
        <span>
          <CircleHelp size={17} />
          <span>
            <strong>
              مصدر المثال: <bdi dir="ltr">EVT-90481</bdi>
            </strong>
            <small>
              {inScope ? 'الحدث متاح ضمن الفترة العامة.' : 'الحدث خارج الفترة العامة الحالية.'}{' '}
              المحاولة المسجلة فاشلة؛ لا تثبت دخولًا ناجحًا.
            </small>
          </span>
        </span>
        <Button type="button" onClick={() => openDetail('event', 'EVT-90481')}>
          عرض الحدث
        </Button>
      </div>
      <InfoBox>
        الخطوط الأولى تقرن حقولًا وأصلًا في المثال، ولا تثبت اتجاهًا أو سلسلة انتقالات. ظهور اسم
        المستخدم لا يعني اختراق الحساب؛ والخطوة الأخيرة لا تستند إلى سجل انتقال.
      </InfoBox>
    </Panel>
  );
}
