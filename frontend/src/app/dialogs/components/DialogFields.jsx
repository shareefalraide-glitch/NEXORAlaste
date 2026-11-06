import React, { useId } from 'react';
import { Info } from 'lucide-react';
import { Button, TextInput } from '../../../shared/ui/index';

import { normalizeMac } from '../../../shared/lib/mac';

export function Actions({ close, onSubmit, submit = 'حفظ تجريبي', icon, disabled = false }) {
  return (
    <div className="modal-actions">
      <Button type="button" onClick={close}>
        إلغاء
      </Button>
      <Button
        type="button"
        data-form-submit
        onClick={onSubmit}
        variant="primary"
        icon={icon}
        disabled={disabled}
      >
        {submit}
      </Button>
    </div>
  );
}
export function DemoNote() {
  return (
    <div className="modal-demo-note">
      <Info size={14} /> إجراء توضيحي داخل الواجهة فقط؛ لا يُرسل إلى خادم أو جهاز.
    </div>
  );
}
export function MacField({
  value,
  onChange,
  attempted,
  onAttempt,
  label = 'عنوان MAC للواجهة الرئيسية',
}) {
  const id = useId(),
    hint = `${id}-hint`,
    error = `${id}-error`;
  const invalid = attempted && normalizeMac(value) === null;
  const blur = () => {
    onAttempt();
    const normalized = normalizeMac(value);
    if (normalized !== null && normalized !== value) onChange(normalized);
  };
  return (
    <label className="form-field mac-field">
      <span>
        {label} <small>· اختياري</small>
      </span>
      <TextInput
        name="mac"
        aria-label="عنوان MAC"
        aria-describedby={invalid ? `${hint} ${error}` : hint}
        aria-invalid={invalid || undefined}
        dir="ltr"
        autoComplete="off"
        spellCheck={false}
        maxLength={32}
        placeholder="02:20:00:01:00:01"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        onBlur={blur}
      />
      <small id={hint}>
        عنوان واجهة واحدة فقط. يقبل : أو - أو النقاط أو دون فواصل؛ لا تُجرى أي عملية اكتشاف.
      </small>
      {invalid && (
        <small className="mac-error" id={error} role="alert">
          أدخل عنوانًا سداسيًا أحادي البث وغير صفري، مثل <bdi dir="ltr">02:20:00:01:00:01</bdi>، أو
          اترك الحقل فارغًا.
        </small>
      )}
    </label>
  );
}
