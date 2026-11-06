import React from 'react';

import { ar, Button, FormField, InfoBox, NativeSelect, TextInput } from '../../../shared/ui/index';

import { normalizeMac } from '../../../shared/lib/mac';

import { Actions, MacField } from './DialogFields';

export function SourceForms({
  modal,
  p,
  values,
  set,
  requestClose,
  manualSubmit,
  wizardStep,
  setWizardStep,
  macAttempted,
  setMacAttempted,
}) {
  return (
    <>
      {modal.type === 'addSource' && (
        <>
          <ol className="source-wizard-steps" aria-label="خطوات إضافة مصدر تجريبي">
            {['الجهاز أو المستشعر', 'طريقة الجمع', 'المراجعة'].map((label, i) => (
              <li
                key={label}
                className={`${i === wizardStep ? 'current' : ''} ${i < wizardStep ? 'done' : ''}`}
                aria-current={i === wizardStep ? 'step' : undefined}
              >
                <span>{i < wizardStep ? '✓' : ar(i + 1)}</span>
                <strong>{label}</strong>
              </li>
            ))}
          </ol>
          {wizardStep === 0 && (
            <div className="wizard-stage">
              <div className="wizard-heading">
                <span>الخطوة ١ من ٣</span>
                <h3>عرّف الجهاز أو المستشعر</h3>
                <p>المصدر هو الجهاز أو المستشعر الذي تملكه المؤسسة، وليس اسم أداة الجمع.</p>
              </div>
              <FormField
                label="اسم المصدر"
                required
                hint="اسم واضح للجهاز أو المستشعر داخل مؤسستك."
              >
                <TextInput
                  required
                  value={values.name}
                  onChange={e => set('name', e.target.value)}
                  placeholder="مثال: مستشعر المقر الرئيسي"
                />
              </FormField>
              <div className="form-grid">
                <FormField label="نوع المصدر">
                  <NativeSelect value={values.kind} onChange={e => set('kind', e.target.value)}>
                    <option>مستشعر شبكة</option>
                    <option>بوابة وصول</option>
                    <option>جدار حماية</option>
                    <option>موجّه شبكة</option>
                    <option>خادم</option>
                    <option>مصدر آخر</option>
                  </NativeSelect>
                </FormField>
                <FormField label="موقع المصدر">
                  <TextInput
                    value={values.location}
                    onChange={e => set('location', e.target.value)}
                    placeholder="مثال: المقر الرئيسي"
                  />
                </FormField>
              </div>
              <MacField
                value={values.mac}
                onChange={v => set('mac', v)}
                attempted={macAttempted}
                onAttempt={() => setMacAttempted(true)}
              />
            </div>
          )}
          {wizardStep === 1 && (
            <div className="wizard-stage">
              <div className="wizard-heading">
                <span>الخطوة ٢ من ٣</span>
                <h3>اختر طريقة جمع البيانات</h3>
                <p>طريقة الجمع مستقلة عن الجهاز، وتُعرض هنا كإعداد تكاملي تجريبي.</p>
              </div>
              <FormField
                label="طريقة جمع البيانات"
                hint="محرك التحليل أو البروتوكول/الصيغة، وليس اسم المصدر."
              >
                <NativeSelect value={values.method} onChange={e => set('method', e.target.value)}>
                  <optgroup label="محركات الاستشعار">
                    <option>Zeek</option>
                    <option>Suricata</option>
                  </optgroup>
                  <optgroup label="بروتوكولات وصيغ السجلات">
                    <option>Syslog</option>
                    <option>NetFlow</option>
                  </optgroup>
                </NativeSelect>
              </FormField>
              <div className="wizard-method-explainer">
                <strong>
                  <bdi dir="ltr">{values.method}</bdi>
                </strong>
                <span>
                  {
                    {
                      Zeek: 'محرك تحليل شبكة',
                      Suricata: 'محرك كشف الشبكة',
                      Syslog: 'بروتوكول لنقل السجلات',
                      NetFlow: 'صيغة لتدفقات الشبكة',
                    }[values.method]
                  }
                </span>
              </div>
              <InfoBox>اختيار الطريقة لا يثبت برنامجًا ولا يُنشئ اتصالًا فعليًا.</InfoBox>
            </div>
          )}
          {wizardStep === 2 && (
            <div className="wizard-stage">
              <div className="wizard-heading">
                <span>الخطوة ٣ من ٣</span>
                <h3>راجع المصدر قبل إضافته</h3>
                <p>سيضاف إلى بيانات العينة المؤقتة داخل الواجهة فقط.</p>
              </div>
              <div className="wizard-review">
                <div>
                  <span>اسم الجهاز أو المستشعر</span>
                  <strong>{values.name.trim()}</strong>
                </div>
                <div>
                  <span>نوع المصدر</span>
                  <strong>{values.kind}</strong>
                </div>
                <div>
                  <span>الموقع</span>
                  <strong>{values.location.trim() || 'غير محدد'}</strong>
                </div>
                <div>
                  <span>MAC الواجهة</span>
                  <strong>
                    <bdi dir="ltr">{normalizeMac(values.mac) || '—'}</bdi>
                  </strong>
                </div>
                <div>
                  <span>طريقة الجمع</span>
                  <strong>
                    <bdi dir="ltr">{values.method}</bdi>
                  </strong>
                </div>
              </div>
              <InfoBox tone="amber">
                سيظهر المصدر «غير متصل»: لا يُختبر الاتصال ولا تُرسل إعدادات إلى أي جهاز أو خادم.
              </InfoBox>
            </div>
          )}
          <div className="modal-actions source-wizard-actions">
            <Button type="button" onClick={requestClose}>
              إلغاء
            </Button>
            {wizardStep > 0 && (
              <Button type="button" onClick={() => setWizardStep(i => i - 1)}>
                السابق
              </Button>
            )}
            <Button type="button" data-form-submit onClick={manualSubmit} variant="primary">
              {wizardStep === 2 ? 'إضافة إلى العينة' : 'التالي'}
            </Button>
          </div>
        </>
      )}
      {modal.type === 'editSource' && (
        <>
          <FormField label="اسم المصدر">
            <TextInput value={p.name} readOnly />
          </FormField>
          <MacField
            value={values.mac}
            onChange={v => set('mac', v)}
            attempted={macAttempted}
            onAttempt={() => setMacAttempted(true)}
          />
          <InfoBox>تعديل بيانات العينة فقط؛ لا يغيّر إعدادات أي جهاز أو يفحص الاتصال.</InfoBox>
          <Actions close={requestClose} onSubmit={manualSubmit} />
        </>
      )}
    </>
  );
}
