import React from 'react';
import {
  Activity,
  ArrowLeft,
  Binary,
  BrainCircuit,
  Clock3,
  GitBranch,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ar, Button, PageHeading, Panel, PanelHeading, Status, Tag } from '../../shared/ui/index';
import { BaselineSummary, ModelGraphic } from '../../shared/charts/Visuals';

import { BehavioralBaselines } from '../demo/ExperienceModules';

export function Model({ data, openModal, openDetail }) {
  const ready = data.assets.filter(x => x.baseline === 'مكتمل').length,
    pending = data.assets.length - ready;
  const features = [
    'عدد الاتصالات الصادرة الفريدة',
    'نسبة الاتصالات الفاشلة',
    'حجم البايتات الصادرة',
    'حجم البايتات الواردة',
    'عدد النطاقات الفريدة',
    'تشتت المنافذ الوجهة',
    'نسبة الاتصالات إلى عناوين جديدة',
    'الانحراف المعياري لطول الاتصال',
    'تكرار المحاولات على المنفذ نفسه',
    'نسبة النقل التشفيري',
    'عدد سجلات المصادقة الفاشلة',
    'متوسط حجم الحزمة',
  ];
  return (
    <>
      <PageHeading
        title="نموذج الشذوذ"
        subtitle="تابع دورة النموذج وخطوط الأساس وقابلية تفسير الإشارات السلوكية."
        actions={
          <>
            <Button
              icon={RefreshCw}
              onClick={() => openModal('modelAction', { action: 'استعادة النسخة السابقة' })}
            >
              استعادة نسخة
            </Button>
            <Button
              icon={BrainCircuit}
              variant="primary"
              onClick={() => openModal('modelAction', { action: 'إعادة التدريب' })}
            >
              إعادة التدريب
            </Button>
          </>
        }
      />
      <div className="model-banner">
        <div>
          <div className="model-eyebrow">
            <Sparkles size={15} /> الكشف السلوكي غير المُراقَب
          </div>
          <h2>نموذج غابة العزل</h2>
          <p>يقارن سلوك كل أصل بخط الأساس الخاص به؛ دون الاعتماد على قاعدة توقيعية فقط.</p>
          <div className="model-tags">
            <Tag color="blue">Isolation Forest</Tag>
            <Tag color="green">نسخة توضيحية معتمدة</Tag>
          </div>
        </div>
        <div className="model-orb">
          <ModelGraphic />
          <BrainCircuit className="model-core" size={54} strokeWidth={1.1} />
        </div>
      </div>
      <div className="detection-top four">
        <Panel className="feature-card">
          <div className="feature-card-icon blue">
            <GitBranch size={20} />
          </div>
          <div>
            <span>إصدار النموذج</span>
            <strong dir="ltr">v1.4.2</strong>
            <small>بيانات تجريبية</small>
          </div>
        </Panel>
        <Panel className="feature-card">
          <div className="feature-card-icon purple">
            <Activity size={20} />
          </div>
          <div>
            <span>عتبة الشذوذ</span>
            <strong dir="ltr">0.68</strong>
            <small>قيمة توضيحية</small>
          </div>
        </Panel>
        <Panel className="feature-card">
          <div className="feature-card-icon green">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span>خط أساس مكتمل</span>
            <strong>{ar(ready)}</strong>
            <small>أصول في العينة</small>
          </div>
        </Panel>
        <Panel className="feature-card">
          <div className="feature-card-icon amber">
            <Clock3 size={20} />
          </div>
          <div>
            <span>قيد التأسيس</span>
            <strong>{ar(pending)}</strong>
            <small>لا تُصدر درجة تشغيلية</small>
          </div>
        </Panel>
      </div>
      <div className="two-columns uneven">
        <Panel>
          <PanelHeading
            title="حالة خطوط الأساس"
            subtitle="لكل أصل سلوك مرجعي مستقل"
            icon={Activity}
          />
          <BaselineSummary assets={data.assets} compact />
          <div className="baseline-list">
            {[
              ...data.assets.filter(a => a.baseline === 'قيد التأسيس').slice(0, 1),
              ...data.assets.filter(a => a.baseline === 'مكتمل').slice(0, 4),
            ].map((a, i) => (
              <div className="baseline-item" key={a.id}>
                <span className="small-device">
                  <Server size={16} />
                </span>
                <div>
                  <strong dir="ltr">{a.name}</strong>
                  <small>{a.baseline === 'مكتمل' ? 'خط الأساس مكتمل' : 'جمع بيانات التأسيس'}</small>
                </div>
                <Status value={a.baseline} />
              </div>
            ))}
          </div>
          <button className="text-link card-bottom-link" onClick={() => openModal('baselineInfo')}>
            كيف تعمل فترة التأسيس؟ <ArrowLeft size={14} />
          </button>
        </Panel>
        <Panel>
          <PanelHeading
            title="حوكمة النموذج"
            subtitle="دورة مراجعة قابلة للتتبّع"
            icon={GitBranch}
          />
          <div className="lifecycle">
            <div>
              <i>١</i>
              <span>
                <strong>تأسيس</strong>
                <small>١٤ يومًا أو ١٠٠٬٠٠٠ حدث</small>
              </span>
            </div>
            <div>
              <i>٢</i>
              <span>
                <strong>ضبط العتبة</strong>
                <small>مجموعة تحقق زمنية مستقلة</small>
              </span>
            </div>
            <div>
              <i>٣</i>
              <span>
                <strong>التحديث</strong>
                <small>دوريًا أو عند رصد انحراف</small>
              </span>
            </div>
            <div>
              <i>٤</i>
              <span>
                <strong>التقويم والاستعادة</strong>
                <small>العودة للنسخة المعتمدة عند الحاجة</small>
              </span>
            </div>
          </div>
        </Panel>
      </div>
      <BehavioralBaselines data={data} openDetail={openDetail} />
      <Panel className="features-panel">
        <PanelHeading
          title="سمات الكشف السلوكي"
          subtitle="١٢ سمة شبكية دون تحليل محتوى الحزم المشفّرة"
          icon={Binary}
        />
        <div className="feature-list">
          {features.map((x, i) => (
            <div key={x}>
              <span dir="ltr">{String(i + 1).padStart(2, '0')}</span>
              {x}
            </div>
          ))}
        </div>
        <div className="in-panel-note">
          السمات هنا توضيحية؛ تُعرّف تحويلاتها ومصادرها عند ربط واجهة المشروع بمحرك الكشف.
        </div>
      </Panel>
    </>
  );
}
