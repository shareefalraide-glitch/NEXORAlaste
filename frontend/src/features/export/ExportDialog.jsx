import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, ListFilter } from 'lucide-react';
import { ar, Button, InfoBox, Modal } from '../../shared/ui/index';

const csvSafe = value => {
  let text = String(value ?? '');
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
};
const rowId = (row, index) => String(row.id ?? row.name ?? row.technique ?? `row-${index + 1}`);
export default function ExportDialog({ request, onClose, notify }) {
  const all = request.allRows ?? request.rows;
  const columns = useMemo(
    () =>
      request.columns ||
      [
        ...new Set(
          all.flatMap(row => Object.keys(row).filter(key => typeof row[key] !== 'object')),
        ),
      ].map(key => ({ id: key, label: key, value: row => row[key] })),
    [request, all],
  );
  const [selectedColumns, setSelectedColumns] = useState(() =>
    request.visibleColumns
      ? columns.filter(c => request.visibleColumns.includes(c.id)).map(c => c.id)
      : columns.map(c => c.id),
  );
  const [scope, setScope] = useState('filtered'),
    [selectedRows, setSelectedRows] = useState(() => request.selectedIds || []);
  const displayed =
    scope === 'all'
      ? all
      : scope === 'manual'
        ? all.filter((row, i) => selectedRows.includes(rowId(row, i)))
        : request.rows;
  const chosenColumns = columns.filter(c => selectedColumns.includes(c.id));
  const toggleColumn = id =>
    setSelectedColumns(v => (v.includes(id) ? v.filter(x => x !== id) : [...v, id]));
  const toggleRow = id =>
    setSelectedRows(v => (v.includes(id) ? v.filter(x => x !== id) : [...v, id]));
  const download = () => {
    if (!displayed.length || !chosenColumns.length) return;
    const values = [
      chosenColumns.map(c => c.label),
      ...displayed.map(row => chosenColumns.map(c => c.value(row))),
    ];
    const csv = '\ufeff' + values.map(row => row.map(csvSafe).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })),
      a = document.createElement('a');
    a.href = url;
    a.download = `NEXORA-${request.name}-demo.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('تم إعداد ملف CSV محلي للبيانات التجريبية.');
    onClose();
  };
  return (
    <Modal
      title="معاينة تصدير CSV"
      subtitle={`${request.name} · بيانات تجريبية فقط`}
      onClose={onClose}
      wide
    >
      <div className="modal-content export-dialog">
        <div className="export-intro">
          <span>
            <FileSpreadsheet size={19} />
          </span>
          <div>
            <strong>حدد ما تريد تضمينه</strong>
            <p>تصدير محلي للعينة؛ لا تُرسل أي بيانات إلى خادم.</p>
          </div>
        </div>
        <fieldset className="export-scope">
          <legend>
            <ListFilter size={15} /> نطاق الصفوف
          </legend>
          {[
            ['filtered', `النتائج المعروضة (${ar(request.rows.length)})`],
            ['all', `${request.allRowsLabel || 'كل سجلات العينة'} (${ar(all.length)})`],
            ['manual', `تحديد يدوي (${ar(selectedRows.length)})`],
          ].map(([id, label]) => (
            <label key={id} className={scope === id ? 'active' : ''}>
              <input
                type="radio"
                name="export-scope"
                value={id}
                checked={scope === id}
                onChange={() => setScope(id)}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
        {scope === 'manual' && (
          <div className="export-row-picker" role="group" aria-label="اختيار صفوف التصدير">
            <div>
              <strong>اختر السجلات</strong>
              <button
                type="button"
                onClick={() =>
                  setSelectedRows(selectedRows.length === all.length ? [] : all.map(rowId))
                }
              >
                {selectedRows.length === all.length ? 'إلغاء التحديد' : 'تحديد الكل'}
              </button>
            </div>
            <div className="export-row-options">
              {all.map((row, i) => {
                const id = rowId(row, i);
                return (
                  <label key={`${id}-${i}`}>
                    <input
                      type="checkbox"
                      checked={selectedRows.includes(id)}
                      onChange={() => toggleRow(id)}
                    />
                    <span>
                      <bdi dir="auto">
                        {row.title || row.name || row.category || row.action || id}
                      </bdi>{' '}
                      <small>
                        <bdi dir="ltr">{id}</bdi>
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
        <div className="export-columns" role="group" aria-label="اختيار أعمدة التصدير">
          <div>
            <strong>الأعمدة في الملف</strong>
            <span>
              {request.visibleColumns
                ? 'تبدأ بالأعمدة الظاهرة في الجدول؛ يمكن تغييرها هنا.'
                : 'يمكن اختيار الحقول قبل التصدير.'}
            </span>
          </div>
          <div>
            {columns.map(c => (
              <label key={c.id} className={selectedColumns.includes(c.id) ? 'checked' : ''}>
                <input
                  type="checkbox"
                  checked={selectedColumns.includes(c.id)}
                  onChange={() => toggleColumn(c.id)}
                />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="export-preview-head">
          <strong>معاينة الملف</strong>
          <span>
            {ar(displayed.length)} صف · {ar(chosenColumns.length)} عمود
          </span>
        </div>
        {displayed.length && chosenColumns.length ? (
          <div
            className="export-preview-scroll"
            role="region"
            aria-label="معاينة بيانات التصدير، تمرير أفقي"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  {chosenColumns.map(c => (
                    <th scope="col" key={c.id}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.slice(0, 3).map((row, i) => (
                  <tr key={`${rowId(row, i)}-${i}`}>
                    {chosenColumns.map(c => (
                      <td key={c.id}>
                        <bdi dir="auto">{String(c.value(row) ?? '—')}</bdi>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="export-empty">
            اختر صفًا وعمودًا واحدًا على الأقل لمعاينة الملف وتنزيله.
          </div>
        )}
        <p className="export-note">
          تظهر أول ثلاثة صفوف في المعاينة فقط. يُصدّر الملف جميع الصفوف المختارة. قد يمنع عارض
          الملفات المعزول التنزيل؛ افتح ملف HTML في المتصفح عند الحاجة.
        </p>
        <div className="modal-actions">
          <Button type="button" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            icon={Download}
            disabled={!displayed.length || !chosenColumns.length}
            onClick={download}
          >
            تنزيل CSV
          </Button>
        </div>
      </div>
    </Modal>
  );
}
