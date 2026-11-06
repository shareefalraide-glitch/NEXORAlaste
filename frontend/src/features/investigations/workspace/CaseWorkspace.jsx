import { useLandmarkScope } from '../../../shared/hooks/landmark-scope';
import React from 'react';
import {
  ArrowLeft,
  BellRing,
  BookOpen,
  Boxes,
  FileSearch,
  Fingerprint,
  GitBranch,
  History,
} from 'lucide-react';
import { ar, Tag } from '../../../shared/ui/index';

// Links are taken from the selected incident's fixture associations; no
// inferred lateral movement or generated evidence is presented as observed.
export default function CaseWorkspace({
  incident,
  alerts,
  events,
  asset,
  openDetail,
  setTab,
  openReport,
  onGuide,
  onGraph,
  guideStarted,
}) {
  const landmark = useLandmarkScope();
  const event = events[0];
  const links = [
    {
      id: 'alerts',
      label: 'التنبيهات المرتبطة',
      detail: `${ar(alerts.length)} مفصّل من ${ar(incident.alerts || 0)} في المثال`,
      icon: BellRing,
      action: () => setTab('alerts'),
      disabled: !alerts.length,
    },
    {
      id: 'event',
      label: 'الحدث المتاح',
      detail: event?.id || 'لا يوجد حدث مفصّل',
      icon: History,
      action: () => event && openDetail('event', event.id),
      disabled: !event,
    },
    {
      id: 'asset',
      label: 'الأصل المرتبط',
      detail: asset?.name || 'غير متاح في العينة',
      icon: Boxes,
      action: () => asset && openDetail('asset', asset.id),
      disabled: !asset,
    },
    {
      id: 'evidence',
      label: 'مراجع الأدلة',
      detail: 'أوصاف محلية، لا ملفات محفوظة',
      icon: Fingerprint,
      action: () => setTab('evidence'),
    },
  ];
  return (
    <section className="case-workspace-overview" aria-label={landmark('مساحة التحقيق الموحّدة')}>
      <div className="case-workspace-head">
        <div>
          <span>
            <GitBranch size={17} /> مساحة التحقيق
          </span>
          <h4>سياق الحادثة في مكان واحد</h4>
          <p>افتح السجل المرتبط ثم عد للمسار السابق دون مغادرة سياق العينة.</p>
        </div>
        <Tag color="blue">واجهة تجريبية</Tag>
      </div>
      <div className="case-workspace-primary">
        <button type="button" onClick={onGuide}>
          <BookOpen size={16} />
          {guideStarted ? 'استئناف التحقيق الموجّه' : 'بدء تحقيق موجّه'}
        </button>
        <button type="button" onClick={onGraph}>
          <GitBranch size={16} /> مستكشف التحقيق
        </button>
      </div>
      <div className="case-workspace-links">
        {links.map(({ id, label, detail, icon: Icon, action, disabled }) => (
          <button type="button" key={id} onClick={action} disabled={disabled}>
            <span className="case-workspace-icon">
              <Icon size={16} />
            </span>
            <span>
              <strong>{label}</strong>
              <small dir="auto">{detail}</small>
            </span>
            <ArrowLeft size={15} />
          </button>
        ))}
      </div>
      <div className="case-workspace-foot">
        <span>الروابط تعكس السجلات المتاحة فقط؛ لا تثبت انتقالًا أو اختراقًا.</span>
        <button type="button" onClick={openReport}>
          <FileSearch size={15} /> معاينة تقرير الحادثة
        </button>
      </div>
    </section>
  );
}
