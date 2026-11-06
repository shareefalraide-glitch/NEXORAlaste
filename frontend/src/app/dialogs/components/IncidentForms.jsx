import React from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  ar,
  FormField,
  InfoBox,
  NativeSelect,
  Status,
  Textarea,
  TextInput,
} from '../../../shared/ui/index';

import { Actions, DemoNote } from './DialogFields';

export function IncidentForms({
  modal,
  incident,
  p,
  values,
  set,
  requestClose,
  manualSubmit,
  data,
}) {
  return (
    <>
      {modal.type === 'transition' && (
        <>
          <div className="transition-preview">
            <Status value={incident?.status} />
            <ArrowLeft size={18} />
            <Status value={p.next} />
          </div>
          {p.next === 'مسندة' && (
            <FormField label="إسناد إلى" required>
              <NativeSelect value={values.owner} onChange={e => set('owner', e.target.value)}>
                {data.users
                  .filter(x => x.status === 'نشط')
                  .map(u => (
                    <option key={u.id}>{u.name}</option>
                  ))}
              </NativeSelect>
            </FormField>
          )}
          {['معالجة', 'مغلقة'].includes(p.next) && (
            <FormField
              label="السبب الجذري"
              required={p.next === 'مغلقة'}
              hint="مطلوب قبل إغلاق الحادثة."
            >
              <Textarea
                value={values.rootCause}
                onChange={e => set('rootCause', e.target.value)}
                required={p.next === 'مغلقة'}
                placeholder="وثّق السبب الجذري للحادثة"
              />
            </FormField>
          )}
          {p.next === 'جديدة' && (
            <FormField
              label="سبب طلب إعادة الفتح"
              required
              hint="يُوثّق طلب تدقيق قبل إعادة فتح حادثة مغلقة."
            >
              <Textarea
                value={values.reason}
                onChange={e => set('reason', e.target.value)}
                required
                placeholder="اكتب سبب إعادة الفتح"
              />
            </FormField>
          )}
          {p.next !== 'جديدة' && (
            <FormField label="ملاحظة إضافية">
              <Textarea
                value={values.reason}
                onChange={e => set('reason', e.target.value)}
                placeholder="أضف ملاحظة اختيارية"
              />
            </FormField>
          )}
          <DemoNote />
          <Actions close={requestClose} onSubmit={manualSubmit} submit="تأكيد الانتقال" />
        </>
      )}
      {modal.type === 'falsePositive' && (
        <>
          <InfoBox tone="amber">
            يتطلب تصنيف الحادثة إنذارًا كاذبًا سببًا واضحًا يُضاف إلى تسلسل الحادثة التجريبي.
          </InfoBox>
          <FormField label="سبب التصنيف" required>
            <Textarea
              value={values.reason}
              onChange={e => set('reason', e.target.value)}
              required
              placeholder="اشرح لماذا يعدّ هذا إنذارًا كاذبًا"
            />
          </FormField>
          <DemoNote />
          <Actions close={requestClose} onSubmit={manualSubmit} submit="تأكيد التصنيف" />
        </>
      )}
      {modal.type === 'approval' && (
        <>
          {p.mode === 'request' ? (
            <>
              <FormField label="الإجراء المقترح">
                <NativeSelect value={values.action} onChange={e => set('action', e.target.value)}>
                  <option>حجب عنوان المصدر</option>
                  <option>حجب عنوان الوجهة</option>
                  <option>تقييد اتصال الأصل</option>
                </NativeSelect>
              </FormField>
              <FormField label="الهدف المحدد">
                <TextInput
                  dir="ltr"
                  readOnly
                  value={
                    values.action === 'حجب عنوان الوجهة'
                      ? incident?.destinationIp || incident?.ip || '—'
                      : values.action === 'تقييد اتصال الأصل'
                        ? incident?.ip || '—'
                        : incident?.sourceIp || '—'
                  }
                />
              </FormField>
              <FormField label="سبب طلب الاحتواء" required>
                <Textarea
                  required
                  value={values.reason}
                  onChange={e => set('reason', e.target.value)}
                  placeholder="اشرح سبب اقتراح الإجراء"
                />
              </FormField>
              {incident?.approval === 'أعيد للتعديل' && (
                <InfoBox>
                  أُعيد الطلب للتعديل في العينة؛ راجع الإجراء والسبب قبل إرساله مجددًا.
                </InfoBox>
              )}
              {incident?.approval === 'مرفوض' && (
                <InfoBox>الطلب السابق مرفوض في العينة؛ يمكن تقديم اقتراح جديد بسبب واضح.</InfoBox>
              )}
            </>
          ) : (
            <>
              <div className="approval-review">
                <span>الإجراء المقترح</span>
                <strong>{incident?.containmentAction || 'إجراء احتواء'}</strong>
                <span>الهدف المحدد</span>
                <strong dir="ltr">{incident?.containmentTarget || 'غير محدد'}</strong>
                <span>طلب بواسطة</span>
                <strong>
                  {incident?.requestedBy || 'غير محدد'} · {incident?.requestedAt || '—'}
                </strong>
                <span>الحادثة</span>
                <strong dir="ltr">{incident?.id}</strong>
                <span>حالة الطلب</span>
                <strong>بانتظار موافقة بشرية</strong>
              </div>
              <fieldset className="approval-decisions">
                <legend>قرار المراجعة التجريبية</legend>
                {[
                  ['approve', 'موافقة'],
                  ['reject', 'رفض الطلب'],
                  ['return', 'إعادة للتعديل'],
                ].map(([value, label]) => (
                  <label key={value} className={values.decision === value ? 'selected' : ''}>
                    <input
                      type="radio"
                      name="approval-decision"
                      value={value}
                      checked={values.decision === value}
                      onChange={() => set('decision', value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
              {values.decision !== 'approve' && (
                <FormField
                  label={values.decision === 'reject' ? 'سبب الرفض' : 'سبب الإعادة للتعديل'}
                  required
                >
                  <Textarea
                    required
                    value={values.reason}
                    onChange={e => set('reason', e.target.value)}
                    placeholder="وضّح السبب في سجل العينة"
                  />
                </FormField>
              )}
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={values.confirm}
                  onChange={e => set('confirm', e.target.checked)}
                  required
                />
                <span>راجعت الطلب وأؤكد تسجيل القرار في المحاكاة.</span>
              </label>
            </>
          )}
          <InfoBox tone="amber">
            القرار توضيحي فقط؛ لا يوجد تفويض فعلي ولا يُنفّذ أي احتواء أو حجب.
          </InfoBox>
          <Actions
            close={requestClose}
            onSubmit={manualSubmit}
            submit={
              p.mode === 'request'
                ? 'إرسال طلب تجريبي'
                : values.decision === 'approve'
                  ? 'تسجيل الموافقة'
                  : values.decision === 'reject'
                    ? 'تسجيل الرفض'
                    : 'تسجيل الإعادة للتعديل'
            }
          />
        </>
      )}
      {['bulkReview', 'bulkAssign'].includes(modal.type) && (
        <>
          <div className="bulk-confirm-summary">
            <strong>{ar((p.ids || []).length)} تنبيه في الاختيار</strong>
            <p>
              {modal.type === 'bulkReview'
                ? 'سيُغيّر هذا الإجراء الحالة فقط إلى «تمت المراجعة» دون تسجيل قرار أو سبب مستقل. استخدم «فرز مستقل للمحدد» لتوثيق قرار لكل تنبيه.'
                : 'سيُضاف مسؤول للتنبيهات في العينة دون تغيير مسؤول الحادثة المرتبطة.'}
            </p>
            <div>
              {(p.ids || []).map(id => (
                <bdi dir="ltr" key={id}>
                  {id}
                </bdi>
              ))}
            </div>
          </div>
          {modal.type === 'bulkAssign' && (
            <FormField label="إسناد إلى مستخدم تجريبي" required>
              <NativeSelect
                required
                value={values.owner}
                onChange={e => set('owner', e.target.value)}
              >
                <option value="">اختر مستخدمًا</option>
                {data.users
                  .filter(u => u.status === 'نشط')
                  .map(u => (
                    <option key={u.id}>{u.name}</option>
                  ))}
              </NativeSelect>
            </FormField>
          )}
          <label className="check-field">
            <input
              type="checkbox"
              required
              checked={values.confirm}
              onChange={e => set('confirm', e.target.checked)}
            />
            <span>راجعت التنبيهات وأؤكد التغيير في العينة فقط.</span>
          </label>
          <InfoBox>
            لن يُنفّذ هذا الإجراء أي معالجة فعلية. يمكن التراجع عن آخر تغيير للتنبيهات في الواجهة.
          </InfoBox>
          <Actions
            close={requestClose}
            onSubmit={manualSubmit}
            submit={modal.type === 'bulkReview' ? 'تأكيد مراجعة المحدد' : 'تأكيد الإسناد'}
          />
        </>
      )}
      {['newIncident', 'createFromAlert'].includes(modal.type) && (
        <>
          <FormField label="التنبيه" required>
            <NativeSelect
              value={values.id}
              onChange={e => set('id', e.target.value)}
              disabled={modal.type === 'createFromAlert'}
              required
            >
              <option value="">اختر تنبيهًا</option>
              {data.alerts
                .filter(x => !x.incident || x.id === p.id)
                .map(a => (
                  <option key={a.id} value={a.id}>
                    {a.id} · {a.title}
                  </option>
                ))}
            </NativeSelect>
          </FormField>
          <FormField
            label="سبب الإنشاء اليدوي"
            required
            hint="يمكن للمحلل رفع تنبيه متوسط يدويًا عند تراكم القرائن."
          >
            <Textarea
              required
              value={values.reason}
              onChange={e => set('reason', e.target.value)}
              placeholder="اشرح سبب تحويل التنبيه إلى حادثة"
            />
          </FormField>
          <DemoNote />
          <Actions
            close={requestClose}
            onSubmit={manualSubmit}
            submit="إنشاء حادثة تجريبية"
            disabled={!values.id}
          />
        </>
      )}
    </>
  );
}
