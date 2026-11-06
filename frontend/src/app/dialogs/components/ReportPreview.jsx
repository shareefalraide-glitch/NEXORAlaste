import React from 'react';
import { Download, Printer } from 'lucide-react';
import { ar, Button, NativeSelect } from '../../../shared/ui/index';

import { StackedBar } from '../../../shared/charts/Visuals';
import {
  alertExportSchema,
  incidentExportSchema,
  auditExportSchema,
} from '../../../features/export/export-schema';

import { inHours } from '../../../shared/lib/time-scope';

export function ReportPreview({ modal, p, values, set, data, close, exportData }) {
  const reportHours =
    values.period === 'آخر ساعة'
      ? 1
      : values.period === 'آخر ٧ أيام'
        ? 168
        : values.period === 'آخر ٣٠ يومًا'
          ? 720
          : 24;
  const reportIncidents = data.incidents.filter(x => inHours(x, 'incident', reportHours));
  const reportAlerts = data.alerts.filter(x => inHours(x, 'alert', reportHours));
  return (
    <>
      {modal.type === 'report' && (
        <>
          <div className="report-controls">
            <span>الفترة الزمنية</span>
            <NativeSelect value={values.period} onChange={e => set('period', e.target.value)}>
              <option>آخر ساعة</option>
              <option>آخر ٢٤ ساعة</option>
              <option>آخر ٧ أيام</option>
              <option>آخر ٣٠ يومًا</option>
            </NativeSelect>
            <small>تبدأ بفترة العرض العامة ويمكن تخصيصها لهذا التقرير فقط.</small>
          </div>
          <div className="report-preview" id="print-report">
            <div className="report-preview-top">
              <div>
                <span>NEXORA / SECURITY OPERATIONS</span>
                <h3>
                  {p.type === 'حادثة تفصيلية'
                    ? 'تقرير حادثة تفصيلي'
                    : `تقرير ${p.type || 'الحوادث'}`}
                </h3>
                <p>نموذج توضيحي · {values.period}</p>
              </div>
              <div className="report-mark">
                N<span>X</span>
              </div>
            </div>
            <div className="report-summary">
              <strong>ملخص تنفيذي</strong>
              <p>
                {p.type === 'التدقيق'
                  ? 'يعرض هذا النموذج لقطة من سجل التدقيق المحلي، ولا يثبت سلامة السجلات أو تحققها.'
                  : 'تعرض هذه الصفحة عينة توضيحية من بيانات الحوادث والتنبيهات، ولا تمثل نتائج مراقبة أو قياس حقيقي.'}
              </p>
            </div>
            {p.type === 'التدقيق' ? (
              <div className="report-visual">
                <strong>سجل التدقيق · لقطة مستقلة</strong>
                <p>
                  تظهر أول خمسة سجلات من العينة؛ لا تطبق عليها الفترة المختارة لعدم توفر وقت موحّد
                  لكل السجلات.
                </p>
                {data.audit.slice(0, 5).map(entry => (
                  <p key={entry.id}>
                    <bdi dir="ltr">{entry.id}</bdi> · {entry.action} · {entry.actor} ·{' '}
                    {entry.result}
                  </p>
                ))}
                <small>تصدير CSV يضم كامل سجل العينة، ولا يتحقق من تجزئة أو سلامة.</small>
              </div>
            ) : (
              <>
                <div className="report-kpis">
                  <div>
                    <span>الحوادث المفتوحة</span>
                    <strong>
                      {ar(
                        reportIncidents.filter(x => !['مغلقة', 'إنذار كاذب'].includes(x.status))
                          .length,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>تنبيهات في العينة</span>
                    <strong>{ar(reportAlerts.length)}</strong>
                  </div>
                  <div>
                    <span>أصول في العينة</span>
                    <strong>{ar(data.assets.length)}</strong>
                  </div>
                </div>
                <div className="report-visual">
                  <strong>توزيع التنبيهات المفصّلة</strong>
                  <StackedBar
                    label="التنبيهات المفصّلة حسب الخطورة"
                    segments={['حرجة', 'عالية', 'متوسطة'].map((label, i) => ({
                      label,
                      value: reportAlerts.filter(x => x.severity === label).length,
                      color: ['#b82037', '#a64a08', '#875900'][i],
                    }))}
                  />
                  <div className="report-viz-legend">
                    {['حرجة', 'عالية', 'متوسطة'].map((label, i) => (
                      <span key={label}>
                        <i
                          className="viz-dot"
                          style={{ background: ['#b82037', '#a64a08', '#875900'][i] }}
                        />
                        {label} <b>{ar(reportAlerts.filter(x => x.severity === label).length)}</b>
                      </span>
                    ))}
                  </div>
                  <small>
                    السجلات المؤرّخة فقط ضمن فترة التقرير، والوقت المرجعي ١٠:٠٠ UTC+03. الأصول لقطة
                    ثابتة لا تُرشّح بالفترة.
                  </small>
                </div>
              </>
            )}
            {p.incident && (
              <div className="report-incident">
                <strong>الحادثة: {p.incident.title}</strong>
                <p dir="ltr">
                  {p.incident.id} · {p.incident.asset}
                </p>
                <p>
                  الحالة: {p.incident.status} · الخطورة: {p.incident.severity}
                </p>
                <strong>الخط الزمني والإجراءات</strong>
                {p.incident.timeline.map((x, i) => (
                  <p key={i}>
                    {x.time} — {x.title}: {x.detail}
                  </p>
                ))}
              </div>
            )}
            <div className="report-preview-foot">
              بيانات تجريبية فقط · تم إعداد هذا النموذج من واجهة NEXORA
            </div>
          </div>
          <div className="modal-actions">
            <Button onClick={close}>إغلاق</Button>
            <Button
              icon={Download}
              onClick={() =>
                exportData(
                  'التقرير',
                  p.incident
                    ? [p.incident]
                    : p.type === 'التنبيهات'
                      ? reportAlerts
                      : p.type === 'التدقيق'
                        ? data.audit
                        : reportIncidents,
                  {
                    columns: p.incident
                      ? incidentExportSchema
                      : p.type === 'التنبيهات'
                        ? alertExportSchema
                        : p.type === 'التدقيق'
                          ? auditExportSchema
                          : incidentExportSchema,
                  },
                )
              }
            >
              تصدير CSV
            </Button>
            <Button variant="primary" icon={Printer} onClick={() => window.print()}>
              طباعة / حفظ PDF
            </Button>
          </div>
        </>
      )}
    </>
  );
}
