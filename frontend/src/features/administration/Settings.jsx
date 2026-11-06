import React, { useRef, useState } from 'react';
import {
  Activity,
  Bell,
  DatabaseBackup,
  ChevronLeft,
  Clock3,
  Keyboard,
  Palette,
  Save,
  Settings2,
  SlidersHorizontal,
  Waypoints,
} from 'lucide-react';
import {
  Button,
  enterToSubmit,
  FormField,
  InfoBox,
  NativeSelect,
  PageHeading,
  Panel,
  PanelHeading,
  Switch,
  TextInput,
} from '../../shared/ui/index';

import { StatesShowcase } from '../../shared/ui/UIStates';
import DesignLibrary from './DesignLibrary';
import { LayoutPreferences, ShortcutPreferences } from './Personalization';

import WhatIf from './WhatIf';
import { BackupRecovery } from '../demo/ProductExtensions';

export function Settings({
  data,
  notify,
  offlineSimulation,
  setOfflineSimulation,
  onDirtyChange,
  preferences,
  setPreferences,
}) {
  const [tab, setTab] = useState('general');
  const settingsForm = useRef(null);
  const [form, setForm] = useState({
    org: 'المؤسسة التجريبية',
    timezone: 'Asia/Aden',
    window: '15',
    hot: '90',
    cold: '365',
    evidence: '30',
    notify: true,
    sound: false,
    rule: '0.45',
    anomaly: '0.35',
    asset: '0.12',
    frequency: '0.08',
  });
  const savedForm = useRef(JSON.stringify(form));
  // Update the parent's synchronous guard before the next browser event.
  const set = (k, v) => {
    const next = { ...form, [k]: v };
    onDirtyChange?.(JSON.stringify(next) !== savedForm.current);
    setForm(next);
  };
  const weightTotal = ['rule', 'anomaly', 'asset', 'frequency'].reduce(
    (a, k) => a + (Number(form[k]) || 0),
    0,
  );
  const submit = e => {
    e.preventDefault();
    if (offlineSimulation) {
      notify('محاكاة عدم الاتصال: لا يمكن حفظ الإعدادات', 'error');
      return;
    }
    if (tab === 'detection' && Math.abs(weightTotal - 1) > 0.0001) {
      notify('يجب أن يكون مجموع الأوزان ١٫٠٠', 'error');
      return;
    }
    savedForm.current = JSON.stringify(form);
    onDirtyChange?.(false);
    notify('تم حفظ إعدادات العرض مؤقتًا في الواجهة فقط');
  };
  const manualSubmit = e => {
    e.preventDefault();
    if (settingsForm.current && !settingsForm.current.reportValidity()) return;
    submit(e);
  };
  return (
    <>
      <PageHeading
        title="الإعدادات"
        subtitle="هيّئ تجربة المنصة وسياسات التشغيل وفق احتياجات المؤسسة."
        actions={
          ['states', 'design', 'shortcuts', 'layout', 'backup'].includes(tab) ? null : (
            <Button type="button" onClick={manualSubmit} icon={Save} variant="primary">
              حفظ التغييرات
            </Button>
          )
        }
      />
      <div className="settings-layout">
        <Panel className="settings-nav">
          {[
            {
              id: 'general',
              title: 'الإعدادات العامة',
              desc: 'المؤسسة والمنطقة الزمنية',
              icon: Settings2,
            },
            {
              id: 'detection',
              title: 'الكشف والربط',
              desc: 'الأوزان ونافذة الربط',
              icon: Waypoints,
            },
            { id: 'retention', title: 'سياسات الاحتفاظ', desc: 'الأحداث والأدلة', icon: Clock3 },
            { id: 'notifications', title: 'التنبيهات', desc: 'تفضيلات الإشعارات', icon: Bell },
            {
              id: 'backup',
              title: 'النسخ والاستعادة',
              desc: 'تصور لبيانات المنصة',
              icon: DatabaseBackup,
            },
            {
              id: 'shortcuts',
              title: 'اختصارات لوحة المفاتيح',
              desc: 'تخصيص المفاتيح',
              icon: Keyboard,
            },
            {
              id: 'layout',
              title: 'تخصيص الواجهة',
              desc: 'الكثافة وترتيب اللوحة',
              icon: SlidersHorizontal,
            },
            {
              id: 'states',
              title: 'حالات الواجهة',
              desc: 'معاينة الرسائل الموحدة',
              icon: Activity,
            },
            {
              id: 'design',
              title: 'مكتبة المكوّنات',
              desc: 'الألوان والأزرار والحالات',
              icon: Palette,
            },
          ].map(t => (
            <button
              type="button"
              key={t.id}
              data-settings-tab={t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={17} />
              <span>
                <strong>{t.title}</strong>
                <small>{t.desc}</small>
              </span>
              <ChevronLeft size={15} />
            </button>
          ))}
        </Panel>
        <form
          id="settings-form"
          ref={settingsForm}
          onSubmit={manualSubmit}
          onKeyDown={enterToSubmit(manualSubmit)}
          className="settings-content"
        >
          {tab === 'backup' && (
            <Panel>
              <BackupRecovery />
            </Panel>
          )}
          {tab === 'states' && (
            <Panel>
              <StatesShowcase />
            </Panel>
          )}
          {tab === 'design' && (
            <Panel>
              <DesignLibrary />
            </Panel>
          )}
          {tab === 'shortcuts' && (
            <Panel>
              <ShortcutPreferences preferences={preferences} setPreferences={setPreferences} />
            </Panel>
          )}
          {tab === 'layout' && (
            <Panel>
              <LayoutPreferences preferences={preferences} setPreferences={setPreferences} />
            </Panel>
          )}
          {tab === 'general' && (
            <Panel>
              <PanelHeading
                title="الإعدادات العامة"
                subtitle="معلومات مساحة العمل وتفضيلات العرض"
                icon={Settings2}
              />
              <div className="form-grid">
                <FormField label="اسم المؤسسة">
                  <TextInput value={form.org} onChange={e => set('org', e.target.value)} />
                </FormField>
                <FormField label="المنطقة الزمنية">
                  <NativeSelect
                    value={form.timezone}
                    onChange={e => set('timezone', e.target.value)}
                  >
                    <option value="Asia/Aden">اليمن · صنعاء (UTC+03)</option>
                    <option value="UTC">التوقيت العالمي UTC</option>
                  </NativeSelect>
                </FormField>
                <FormField label="لغة الواجهة">
                  <NativeSelect defaultValue="ar">
                    <option value="ar">العربية</option>
                  </NativeSelect>
                </FormField>
                <FormField label="اتجاه العرض">
                  <TextInput value="من اليمين إلى اليسار (RTL)" readOnly />
                </FormField>
              </div>
              <div className="setting-toggle">
                <span>
                  <strong>محاكاة انقطاع الاتصال</strong>
                  <small>اختبر حالة القراءة فقط ومنع التعديلات في الواجهة.</small>
                </span>
                <Switch
                  label="محاكاة انقطاع الاتصال"
                  checked={offlineSimulation}
                  onChange={setOfflineSimulation}
                />
              </div>
              <InfoBox>إعدادات العرض مؤقتة ولا تُحفظ على خادم في هذه النسخة.</InfoBox>
            </Panel>
          )}
          {tab === 'detection' && (
            <Panel>
              <PanelHeading
                title="الكشف والربط"
                subtitle="قيم تصميمية أولية قابلة للمعايرة"
                icon={Waypoints}
              />
              <div className="form-grid">
                <FormField
                  label="نافذة ربط التنبيهات (دقيقة)"
                  hint="القيمة الافتراضية المقترحة في التقرير: ١٥ دقيقة."
                >
                  <TextInput
                    type="number"
                    min="1"
                    max="1440"
                    value={form.window}
                    onChange={e => set('window', e.target.value)}
                  />
                </FormField>
              </div>
              <h3 className="form-section-title">أوزان درجة الخطورة المدمجة</h3>
              <div className="form-grid four-fields">
                {[
                  ['rule', 'شدّة القاعدة'],
                  ['anomaly', 'الشذوذ السلوكي'],
                  ['asset', 'أهمية الأصل'],
                  ['frequency', 'تكرار المصدر'],
                ].map(([k, l]) => (
                  <FormField key={k} label={l}>
                    <TextInput
                      type="number"
                      step="0.01"
                      min="0"
                      max="1"
                      dir="ltr"
                      value={form[k]}
                      onChange={e => set(k, e.target.value)}
                    />
                  </FormField>
                ))}
              </div>
              <div
                className={`weight-total ${Math.abs(weightTotal - 1) > 0.0001 ? 'invalid' : ''}`}
              >
                <span>مجموع الأوزان</span>
                <strong dir="ltr">{weightTotal.toFixed(2)} / 1.00</strong>
              </div>
              <InfoBox>
                عند غياب إشارة تُصفّر مساهمتها ولا يُعاد توزيع وزنها. لا يتم احتساب نتائج فعلية هنا.
              </InfoBox>
              <WhatIf data={data} settingsWeights={form} />
            </Panel>
          )}
          {tab === 'retention' && (
            <Panel>
              <PanelHeading
                title="سياسات الاحتفاظ"
                subtitle="المدد المقترحة في التصميم، ويمكن تعديلها تجريبيًا"
                icon={Clock3}
              />
              <div className="form-grid">
                <FormField label="الأحداث · تخزين ساخن (يوم)">
                  <TextInput
                    type="number"
                    min="1"
                    value={form.hot}
                    onChange={e => set('hot', e.target.value)}
                  />
                </FormField>
                <FormField label="الأحداث · تخزين بارد (يوم)">
                  <TextInput
                    type="number"
                    min="1"
                    value={form.cold}
                    onChange={e => set('cold', e.target.value)}
                  />
                </FormField>
                <FormField
                  label="أدلة PCAP (يوم كحد أقصى)"
                  hint="أو عند إغلاق الحادثة، أيهما أقرب."
                >
                  <TextInput
                    type="number"
                    min="1"
                    value={form.evidence}
                    onChange={e => set('evidence', e.target.value)}
                  />
                </FormField>
                <FormField label="الحوادث والتنبيهات وسجل التدقيق">
                  <TextInput value="سنة على الأقل وفق سياسة التشغيل" readOnly />
                </FormField>
              </div>
              <InfoBox tone="amber">
                لا تُخزّن الأدلة محليًا في هذا النموذج، ولا ينفّذ أي حذف مجدول.
              </InfoBox>
            </Panel>
          )}
          {tab === 'notifications' && (
            <Panel>
              <PanelHeading
                title="تفضيلات التنبيهات"
                subtitle="خيارات الواجهة للفت انتباه المحلل"
                icon={Bell}
              />
              <div className="setting-toggle">
                <span>
                  <strong>إشعارات الحوادث الحرجة</strong>
                  <small>إظهار تنبيه عند إنشاء حادثة حرجة في التصميم.</small>
                </span>
                <Switch
                  label="إشعارات الحوادث الحرجة"
                  checked={form.notify}
                  onChange={v => set('notify', v)}
                />
              </div>
              <div className="setting-toggle">
                <span>
                  <strong>تنبيه صوتي</strong>
                  <small>خيار عرض توضيحي، دون تشغيل صوت فعلي.</small>
                </span>
                <Switch label="تنبيه صوتي" checked={form.sound} onChange={v => set('sound', v)} />
              </div>
              <InfoBox>التحديثات الفورية ستحتاج إلى قناة دفع من الخادم في مرحلة الربط.</InfoBox>
            </Panel>
          )}
        </form>
      </div>
    </>
  );
}
