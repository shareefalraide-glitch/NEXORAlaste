import React from 'react';
import { Download, Layers3, Network } from 'lucide-react';
import { ar, Button, PageHeading, Panel, PanelHeading } from '../../shared/ui/index';
import { StackedBar } from '../../shared/charts/Visuals';

const tactics = [
  {
    name: 'الوصول الأولي',
    en: 'Initial Access',
    techniques: [
      ['T1190', 'استغلال تطبيق مكشوف', false],
      ['T1078', 'حسابات صالحة', false],
    ],
  },
  {
    name: 'التنفيذ',
    en: 'Execution',
    techniques: [
      ['T1059', 'مفسّر الأوامر', false],
      ['T1204', 'تنفيذ بواسطة المستخدم', false],
    ],
  },
  {
    name: 'الوصول للاعتمادات',
    en: 'Credential Access',
    techniques: [
      ['T1110', 'تخمين كلمات المرور', true],
      ['T1555', 'بيانات الاعتماد المخزّنة', false],
    ],
  },
  {
    name: 'الاستطلاع',
    en: 'Discovery',
    techniques: [
      ['T1046', 'اكتشاف خدمات الشبكة', true],
      ['T1018', 'اكتشاف الأنظمة البعيدة', false],
    ],
  },
  {
    name: 'القيادة والتحكم',
    en: 'Command and Control',
    techniques: [
      ['T1071.004', 'بروتوكول DNS', true],
      ['T1095', 'بروتوكول غير تطبيقي', false],
    ],
  },
  {
    name: 'تسريب البيانات',
    en: 'Exfiltration',
    techniques: [
      ['T1048', 'نقل عبر بروتوكول بديل', true],
      ['T1041', 'نقل عبر قناة تحكم', false],
    ],
  },
];
function LayoutIcon({ size = 18 }) {
  return <Layers3 size={size} />;
}
export function Mitre({ data, openModal }) {
  const visibleTactics = tactics.map(t => ({
    ...t,
    techniques: t.techniques.map(([id, name]) => {
      const linked = data.rules.filter(r => r.technique === id),
        enabled = linked.some(r => r.enabled);
      return {
        id,
        name,
        linked,
        status: enabled ? 'enabled' : linked.length ? 'disabled' : 'unmapped',
      };
    }),
  }));
  const all = visibleTactics.flatMap(t => t.techniques),
    count = state => all.filter(t => t.status === state).length,
    coveredCount = count('enabled');
  const statusText = {
    enabled: 'قاعدة مفعّلة',
    disabled: 'قاعدة معطّلة فقط',
    unmapped: 'لا توجد قاعدة في العينة',
  };
  const coverageSegments = [
    { label: 'مفعّلة', value: count('enabled'), color: 'var(--nx-brand)' },
    { label: 'معطّلة فقط', value: count('disabled'), color: 'var(--nx-chart-yellow)' },
    { label: 'غير مرتبطة', value: count('unmapped'), color: 'var(--nx-line2)' },
  ];
  return (
    <>
      <PageHeading
        title="تغطية MITRE ATT&CK"
        subtitle="قارن ارتباط القواعد التجريبية بالتقنيات؛ الربط لا يثبت فعالية الكشف."
        actions={
          <Button
            icon={Download}
            onClick={() =>
              openModal('mitreExport', {
                rows: visibleTactics.flatMap(t =>
                  t.techniques.map(x => ({
                    tactic: t.name,
                    technique: x.id,
                    name: x.name,
                    coverage: statusText[x.status],
                    rules: x.linked.map(r => r.id).join('، '),
                    test: 'غير مختبرة فعليًا',
                  })),
                ),
              })
            }
          >
            تصدير التغطية
          </Button>
        }
      />
      <div className="coverage-banner">
        <div className="coverage-symbol">
          <Network size={25} />
        </div>
        <div>
          <strong>خريطة ارتباط توضيحية</strong>
          <p>
            القاعدة المرتبطة ليست دليلًا على اكتشاف فعلي؛ الاختبارات الحقيقية غير متاحة في الواجهة.
          </p>
        </div>
        <div className="coverage-legend">
          <span>
            <i className="dot cyan" /> قاعدة مفعّلة
          </span>
          <span>
            <i className="dot amber" /> معطّلة فقط
          </span>
          <span>
            <i className="dot muted" /> لا توجد قاعدة
          </span>
        </div>
      </div>
      <div className="viz-coverage-summary">
        <div className="viz-summary-head">
          <div>
            <strong>الربط حسب التكتيك</strong>
            <small>عدد التقنيات المرتبطة بقواعد مفعّلة في العينة</small>
          </div>
          <b>
            {ar(coveredCount)} <small>من {ar(all.length)} تقنية</small>
          </b>
        </div>
        <StackedBar
          segments={coverageSegments}
          label="ارتباط تقنيات العينة بالقواعد المفعلة أو المعطلة"
        />
        <div className="coverage-state-legend">
          {coverageSegments.map(segment => (
            <span key={segment.label}>
              <i style={{ background: segment.color }} />
              {segment.label} <b>{ar(segment.value)}</b>
            </span>
          ))}
          <small>حالة الاختبار: غير مختبرة فعليًا</small>
        </div>
        <div className="viz-tactic-list">
          {visibleTactics.map(t => {
            const n = t.techniques.filter(x => x.status === 'enabled').length;
            return (
              <div
                key={t.en}
                role="img"
                aria-label={`${t.name}: ${ar(n)} من ${ar(t.techniques.length)} مرتبطة بقواعد مفعّلة`}
              >
                <span>
                  {t.name}
                  <b dir="ltr">
                    {ar(n)} / {ar(t.techniques.length)}
                  </b>
                </span>
                <div className="viz-tactic-track">
                  <i style={{ width: `${(n / t.techniques.length) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Panel className="mitre-panel">
        <PanelHeading
          title="مصفوفة التقنيات"
          subtitle="اختر تقنية لعرض حالة القواعد المرتبطة"
          icon={LayoutIcon}
        />
        <div className="mitre-grid">
          {visibleTactics.map(t => (
            <div className="mitre-column" key={t.en}>
              <div className="mitre-head">
                <strong>{t.name}</strong>
                <small dir="ltr">{t.en}</small>
              </div>
              {t.techniques.map(x => (
                <button
                  className={`mitre-cell ${x.status === 'enabled' ? 'covered' : x.status === 'disabled' ? 'is-disabled' : ''}`}
                  key={x.id}
                  onClick={() =>
                    openModal('mitreDetail', {
                      id: x.id,
                      name: x.name,
                      covered: x.status === 'enabled',
                      status: x.status,
                      linkedRules: x.linked,
                    })
                  }
                >
                  <span dir="ltr">{x.id}</span>
                  <strong>{x.name}</strong>
                  <small>{statusText[x.status]}</small>
                </button>
              ))}
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
