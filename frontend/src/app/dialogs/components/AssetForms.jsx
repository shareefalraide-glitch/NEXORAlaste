import React from 'react';

import { FormField, InfoBox, NativeSelect, TextInput } from '../../../shared/ui/index';

import { validIp, validVlan } from '../../../features/assets/asset-model';

import { Actions, DemoNote, MacField } from './DialogFields';

export function AssetForms({
  modal,
  p,
  values,
  set,
  requestClose,
  manualSubmit,
  data,
  interfaceAttempted,
  macAttempted,
  setMacAttempted,
}) {
  return (
    <>
      {modal.type === 'newAsset' && (
        <>
          <div className="form-grid">
            <FormField label="اسم الأصل" required>
              <TextInput
                required
                dir="ltr"
                placeholder="SERVER-01"
                value={values.name}
                onChange={e => set('name', e.target.value)}
              />
            </FormField>
            <label className="form-field">
              <span>
                عنوان IP <em>*</em>
              </span>
              <TextInput
                required
                name="asset-ip"
                aria-label="عنوان IP"
                aria-invalid={(interfaceAttempted && !validIp(values.ip)) || undefined}
                aria-describedby={
                  interfaceAttempted && !validIp(values.ip) ? 'asset-ip-error' : undefined
                }
                dir="ltr"
                placeholder="10.20.1.20"
                value={values.ip}
                onChange={e => set('ip', e.target.value)}
              />
              {interfaceAttempted && !validIp(values.ip) && (
                <small id="asset-ip-error" className="field-error" role="alert">
                  أدخل عنوان IPv4 أو IPv6 صالحًا دون قناع شبكة.
                </small>
              )}
            </label>
            <FormField label="نوع الأصل">
              <NativeSelect value={values.type} onChange={e => set('type', e.target.value)}>
                <option>خادم</option>
                <option>محطة عمل</option>
                <option>جهاز شبكة</option>
                <option>خادم قاعدة بيانات</option>
              </NativeSelect>
            </FormField>
            <FormField label="الأهمية">
              <NativeSelect
                value={values.criticality}
                onChange={e => set('criticality', e.target.value)}
              >
                <option>حرجة</option>
                <option>متوسطة</option>
                <option>منخفضة</option>
              </NativeSelect>
            </FormField>
          </div>
          <MacField
            value={values.mac}
            onChange={v => set('mac', v)}
            attempted={macAttempted}
            onAttempt={() => setMacAttempted(true)}
          />
          <FormField label="المالك" required>
            <TextInput
              required
              value={values.owner}
              onChange={e => set('owner', e.target.value)}
              placeholder="مثال: فريق الشبكات"
            />
          </FormField>
          <details className="asset-optional-fields">
            <summary>بيانات الجهاز الإضافية · اختيارية</summary>
            <div className="form-grid">
              <FormField label="الشركة المصنّعة">
                <TextInput
                  value={values.manufacturer}
                  onChange={e => set('manufacturer', e.target.value)}
                  placeholder="مثال: الشركة المصنّعة"
                />
              </FormField>
              <FormField label="الطراز">
                <TextInput
                  dir="ltr"
                  value={values.deviceModel}
                  onChange={e => set('deviceModel', e.target.value)}
                  placeholder="Model 100"
                />
              </FormField>
              <FormField label="نظام التشغيل">
                <TextInput
                  value={values.operatingSystem}
                  onChange={e => set('operatingSystem', e.target.value)}
                  placeholder="مثال: Linux"
                />
              </FormField>
              <FormField label="الموقع">
                <TextInput
                  value={values.location}
                  onChange={e => set('location', e.target.value)}
                  placeholder="مثال: مركز البيانات"
                />
              </FormField>
            </div>
          </details>
          <InfoBox>يبدأ الأصل الجديد في حالة «قيد التأسيس» دون درجة شذوذ تشغيلية.</InfoBox>
          <DemoNote />
          <Actions close={requestClose} onSubmit={manualSubmit} submit="إضافة الأصل" />
        </>
      )}
      {modal.type === 'editAsset' && (
        <>
          <FormField label="اسم الأصل">
            <TextInput value={values.name} readOnly dir="ltr" />
          </FormField>
          <div className="form-grid">
            <FormField label="أهمية الأصل">
              <NativeSelect
                value={values.criticality}
                onChange={e => set('criticality', e.target.value)}
              >
                <option>حرجة</option>
                <option>متوسطة</option>
                <option>منخفضة</option>
              </NativeSelect>
            </FormField>
            <FormField label="المالك">
              <TextInput
                value={values.owner}
                onChange={e => set('owner', e.target.value)}
                required
              />
            </FormField>
          </div>
          <MacField
            value={values.mac}
            onChange={v => set('mac', v)}
            attempted={macAttempted}
            onAttempt={() => setMacAttempted(true)}
          />
          <details className="asset-optional-fields">
            <summary>بيانات الجهاز الإضافية · اختيارية</summary>
            <div className="form-grid">
              <FormField label="الشركة المصنّعة">
                <TextInput
                  value={values.manufacturer}
                  onChange={e => set('manufacturer', e.target.value)}
                  placeholder="مثال: الشركة المصنّعة"
                />
              </FormField>
              <FormField label="الطراز">
                <TextInput
                  dir="ltr"
                  value={values.deviceModel}
                  onChange={e => set('deviceModel', e.target.value)}
                  placeholder="Model 100"
                />
              </FormField>
              <FormField label="نظام التشغيل">
                <TextInput
                  value={values.operatingSystem}
                  onChange={e => set('operatingSystem', e.target.value)}
                  placeholder="مثال: Linux"
                />
              </FormField>
              <FormField label="الموقع">
                <TextInput
                  value={values.location}
                  onChange={e => set('location', e.target.value)}
                  placeholder="مثال: مركز البيانات"
                />
              </FormField>
            </div>
          </details>
          <InfoBox>تعديل الأهمية هنا لا يعيد احتساب الدرجات أو يُجري تغييرات على الشبكة.</InfoBox>
          <Actions close={requestClose} onSubmit={manualSubmit} />
        </>
      )}
      {modal.type === 'assetInterface' && (
        <>
          <InfoBox>
            واجهة ضمن سجل الأصل التجريبي فقط؛ لا تُجرى تغييرات على الشبكة. اترك العناوين غير
            المعروفة فارغة.
          </InfoBox>
          <div className="form-grid">
            <FormField label="اسم واجهة الشبكة" required>
              <TextInput
                required
                name="interface-name"
                dir="ltr"
                value={values.name}
                onChange={e => set('name', e.target.value)}
                placeholder="eth1"
                maxLength={80}
              />
            </FormField>
            <label className="form-field">
              <span>عنوان IP للواجهة · اختياري</span>
              <TextInput
                name="interface-ip"
                aria-label="عنوان IP للواجهة"
                aria-invalid={(interfaceAttempted && !validIp(values.ip)) || undefined}
                aria-describedby={
                  interfaceAttempted && !validIp(values.ip) ? 'interface-ip-error' : undefined
                }
                dir="ltr"
                value={values.ip}
                onChange={e => set('ip', e.target.value)}
                placeholder="10.20.1.20 أو IPv6"
              />
              {interfaceAttempted && !validIp(values.ip) && (
                <small id="interface-ip-error" className="field-error" role="alert">
                  أدخل عنوان IPv4 أو IPv6 صالحًا دون قناع شبكة، أو اترك الحقل فارغًا.
                </small>
              )}
            </label>
          </div>
          <MacField
            label="عنوان MAC للواجهة"
            value={values.mac}
            onChange={v => set('mac', v)}
            attempted={macAttempted}
            onAttempt={() => setMacAttempted(true)}
          />
          <label className="form-field">
            <span>VLAN · اختياري</span>
            <TextInput
              name="interface-vlan"
              aria-label="VLAN"
              aria-invalid={(interfaceAttempted && !validVlan(values.vlan)) || undefined}
              aria-describedby={
                interfaceAttempted && !validVlan(values.vlan)
                  ? 'interface-vlan-error'
                  : 'interface-vlan-hint'
              }
              dir="ltr"
              inputMode="numeric"
              value={values.vlan}
              onChange={e => set('vlan', e.target.value)}
              placeholder="1–4094"
            />
            <small id="interface-vlan-hint">رقم بين ١ و٤٠٩٤ أو اتركه فارغًا.</small>
            {interfaceAttempted && !validVlan(values.vlan) && (
              <small id="interface-vlan-error" className="field-error" role="alert">
                رقم VLAN يجب أن يكون من ١ إلى ٤٠٩٤.
              </small>
            )}
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={values.makePrimary}
              disabled={
                p.interfaceId === data.assets.find(x => x.id === p.assetId)?.primaryInterfaceId
              }
              onChange={e => set('makePrimary', e.target.checked)}
            />
            <span>جعلها الواجهة الرئيسية للأصل</span>
          </label>
          <DemoNote />
          <Actions
            close={requestClose}
            onSubmit={manualSubmit}
            submit={p.interfaceId ? 'حفظ الواجهة' : 'إضافة الواجهة'}
          />
        </>
      )}
      {modal.type === 'deleteInterface' && (
        <>
          <InfoBox tone="amber">
            سيُحذف سجل الواجهة من العينة فقط. إذا كانت رئيسية ستُختار أول واجهة متبقية، أو تصبح
            العناوين غير محددة عند عدم وجود واجهات.
          </InfoBox>
          <label className="check-field">
            <input
              type="checkbox"
              required
              checked={values.confirm}
              onChange={e => set('confirm', e.target.checked)}
            />
            <span>أؤكد حذف الواجهة من العينة المؤقتة.</span>
          </label>
          <Actions close={requestClose} onSubmit={manualSubmit} submit="حذف الواجهة" />
        </>
      )}
    </>
  );
}
