import React from 'react';
import { Upload } from 'lucide-react';
import { FormField, InfoBox, NativeSelect, Textarea, TextInput } from '../../../shared/ui/index';
import { roles } from '../../../data/fixtures/demo-records';

import { Actions, DemoNote } from './DialogFields';

export function AdministrationForms({ modal, values, set, requestClose, manualSubmit, notify }) {
  return (
    <>
      {modal.type === 'newUser' && (
        <>
          <div className="form-grid">
            <FormField label="الاسم الكامل" required>
              <TextInput
                required
                value={values.name}
                onChange={e => set('name', e.target.value)}
                placeholder="اسم المستخدم"
              />
            </FormField>
            <FormField label="البريد الإلكتروني" required>
              <TextInput
                type="email"
                required
                dir="ltr"
                value={values.email}
                onChange={e => set('email', e.target.value)}
                placeholder="user@example.local"
              />
            </FormField>
          </div>
          <FormField label="الدور">
            <NativeSelect value={values.role} onChange={e => set('role', e.target.value)}>
              {roles.map(r => (
                <option key={r.name}>{r.name}</option>
              ))}
            </NativeSelect>
          </FormField>
          <DemoNote />
          <Actions close={requestClose} onSubmit={manualSubmit} submit="إضافة المستخدم" />
        </>
      )}
      {modal.type === 'editUser' && (
        <>
          <FormField label="المستخدم">
            <TextInput readOnly value={values.name} />
          </FormField>
          <div className="form-grid">
            <FormField label="الدور">
              <NativeSelect value={values.role} onChange={e => set('role', e.target.value)}>
                {roles.map(r => (
                  <option key={r.name}>{r.name}</option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="الحالة">
              <NativeSelect value={values.status} onChange={e => set('status', e.target.value)}>
                <option>نشط</option>
                <option>غير نشط</option>
              </NativeSelect>
            </FormField>
          </div>
          <InfoBox>هذه صلاحيات مرئية للتصميم، وليست تفويضًا مطبّقًا على الخادم.</InfoBox>
          <Actions close={requestClose} onSubmit={manualSubmit} />
        </>
      )}
      {modal.type === 'newRule' && (
        <>
          <FormField label="اسم القاعدة" required>
            <TextInput
              required
              value={values.name}
              onChange={e => set('name', e.target.value)}
              placeholder="أدخل اسمًا واضحًا للقاعدة"
            />
          </FormField>
          <div className="form-grid">
            <FormField label="المصدر">
              <NativeSelect value={values.source} onChange={e => set('source', e.target.value)}>
                <option>Sigma</option>
                <option>Suricata</option>
              </NativeSelect>
            </FormField>
            <FormField label="الخطورة">
              <NativeSelect value={values.severity} onChange={e => set('severity', e.target.value)}>
                <option>حرجة</option>
                <option>عالية</option>
                <option>متوسطة</option>
              </NativeSelect>
            </FormField>
          </div>
          <FormField label="تقنية ATT&CK">
            <TextInput
              dir="ltr"
              value={values.technique}
              onChange={e => set('technique', e.target.value)}
              placeholder="T1110"
            />
          </FormField>
          <FormField label="الوصف">
            <Textarea
              value={values.desc}
              onChange={e => set('desc', e.target.value)}
              placeholder="ما السلوك الذي تصفه القاعدة؟"
            />
          </FormField>
          <DemoNote />
          <Actions close={requestClose} onSubmit={manualSubmit} submit="إضافة القاعدة" />
        </>
      )}
      {modal.type === 'importIoc' && (
        <>
          <div className="form-grid">
            <FormField label="نوع المؤشر">
              <NativeSelect value={values.type} onChange={e => set('type', e.target.value)}>
                <option>عنوان IP</option>
                <option>نطاق</option>
                <option>تجزئة</option>
              </NativeSelect>
            </FormField>
            <FormField label="الخطورة">
              <NativeSelect value={values.severity} onChange={e => set('severity', e.target.value)}>
                <option>حرجة</option>
                <option>عالية</option>
                <option>متوسطة</option>
                <option>منخفضة</option>
              </NativeSelect>
            </FormField>
          </div>
          <FormField
            label="المؤشرات"
            required
            hint="سطر لكل مؤشر أو قيم مفصولة بفاصلة؛ حتى ٥٠ قيمة في المحاكاة."
          >
            <Textarea
              rows="5"
              dir="ltr"
              value={values.text}
              onChange={e => set('text', e.target.value)}
              placeholder={'198.51.100.23\n203.0.113.42'}
            />
          </FormField>
          <label className="upload-inline">
            <Upload size={16} /> أو اختر ملفًا نصيًا تجريبيًا
            <input
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) {
                  if (f.size > 100_000) {
                    notify('حجم الملف يتجاوز الحد التجريبي', 'error');
                    return;
                  }
                  f.text().then(t => set('text', t));
                }
              }}
            />
          </label>
          <DemoNote />
          <Actions close={requestClose} onSubmit={manualSubmit} submit="استيراد إلى العينة" />
        </>
      )}
    </>
  );
}
