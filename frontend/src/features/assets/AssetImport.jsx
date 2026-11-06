import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { ar, Button, InfoBox, Modal, Table, Textarea } from '../../shared/ui/index';
import { IMPORT_MAX_BYTES, previewAssetCsv } from './asset-import';
import { newAssetRecord } from './asset-model';

const example =
  'اسم الأصل,عنوان IP,عنوان MAC,نوع الأصل,المالك,اسم الواجهة,VLAN,الموقع\nLAB-DEMO-01,192.0.2.70,02:AC:00:00:00:70,محطة عمل,فريق المختبر,eth0,100,المختبر\nAD-SRV-01,10.20.1.12,02:20:00:01:00:01,خادم,فريق البنية,eth0,100,مركز البيانات';
const pageSize = 10;
const fields = [
  ['النوع', 'type'],
  ['المالك', 'owner'],
  ['الأهمية', 'criticality'],
  ['المجموعة', 'group'],
  ['الشركة المصنّعة', 'manufacturer'],
  ['الطراز', 'deviceModel'],
  ['نظام التشغيل', 'operatingSystem'],
  ['الموقع', 'location'],
  ['اسم الواجهة', 'interfaceName'],
  ['VLAN', 'vlan'],
];
export default function AssetImport({ data, add, close }) {
  const [text, setText] = useState(''),
    [error, setError] = useState(''),
    [preview, setPreview] = useState(null),
    [selected, setSelected] = useState([]),
    [page, setPage] = useState(0),
    [confirm, setConfirm] = useState(false),
    [loading, setLoading] = useState(false);
  const dirty = useRef(false),
    readSequence = useRef(0),
    summaryRef = useRef(null);
  dirty.current = !!text.trim();
  const requestClose = useCallback(() => {
    if (dirty.current) {
      setConfirm(true);
      return;
    }
    close();
  }, [close]);
  useEffect(() => {
    const onUnload = e => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);
  const change = value => {
    readSequence.current++;
    setLoading(false);
    setText(value);
    setError('');
    setPreview(null);
    setSelected([]);
    setPage(0);
  };
  const loadFile = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = ++readSequence.current;
    setPreview(null);
    setSelected([]);
    setLoading(true);
    if (file.size > IMPORT_MAX_BYTES) {
      setLoading(false);
      setError('الملف أكبر من ١٠٠٬٠٠٠ بايت. اختر ملفًا أصغر.');
      e.target.value = '';
      return;
    }
    try {
      const value = await file.text();
      if (token === readSequence.current) {
        setText(value);
        setError('');
        setPreview(null);
        setSelected([]);
        setPage(0);
      }
    } catch {
      if (token === readSequence.current)
        setError('تعذّر قراءة الملف محليًا. جرّب نص CSV أو ملفًا آخر.');
    } finally {
      if (token === readSequence.current) setLoading(false);
    }
    e.target.value = '';
  };
  const inspect = () => {
    try {
      const result = previewAssetCsv(text, data.assets);
      setPreview(result);
      setSelected(
        result.records.filter(r => !r.errors.length && !r.warnings.length).map(r => r.index),
      );
      setError('');
      setPage(0);
      requestAnimationFrame(() => summaryRef.current?.focus());
    } catch (e) {
      setPreview(null);
      setSelected([]);
      setError(e.message);
    }
  };
  const toggle = index =>
    setSelected(current =>
      current.includes(index) ? current.filter(x => x !== index) : [...current, index],
    );
  const importSelected = () => {
    if (!preview) return;
    const rows = preview.records.filter(r => selected.includes(r.index) && !r.errors.length);
    if (!rows.length) return;
    const base = Date.now().toString(36),
      suffix = Math.random().toString(36).slice(2, 7);
    add(
      'assets',
      rows.map((r, i) =>
        newAssetRecord(r.values, `AST-IMPORT-${base}-${suffix}-${i + 1}`, 'استيراد أصل من CSV'),
      ),
      'استيراد أصول من CSV',
    );
    dirty.current = false;
    close();
  };
  const pages = preview ? Math.ceil(preview.records.length / pageSize) : 0,
    visible = preview?.records.slice(page * pageSize, (page + 1) * pageSize) || [];
  return (
    <>
      <Modal
        title="استيراد أصول CSV"
        subtitle="معاينة محلية للبيانات التجريبية"
        onClose={requestClose}
        wide
      >
        <div className="modal-content asset-import">
          <div className="import-intro">
            <span>
              <FileSpreadsheet size={19} />
            </span>
            <div>
              <strong>راجع قبل الإضافة</strong>
              <p>
                يُقرأ النص أو الملف محليًا فقط، دون رفع إلى خادم. لا تستخدم بيانات حقيقية في
                النموذج.
              </p>
            </div>
          </div>
          <div className="import-help">
            <p>
              العمود المطلوب: <strong>اسم الأصل</strong>. اختياريًا: عنوان IP وMAC، النوع، المالك،
              اسم الواجهة، VLAN، الموقع وبيانات الجهاز. صيغة CSV بفاصلة تدعم الحقول المقتبسة. الحد
              ١٠٠٬٠٠٠ بايت و١٠٠ صف و٤٠ عمودًا. كل صف ينشئ أصلًا بواجهة واحدة؛ لا يُعاد بناء الواجهات
              الإضافية من التصدير.
            </p>
            <button type="button" onClick={() => change(example)}>
              استخدام مثال تجريبي
            </button>
          </div>
          <label className="form-field import-text">
            <span>نص CSV</span>
            <Textarea
              aria-label="نص CSV للأصول"
              rows="6"
              dir="ltr"
              value={text}
              onChange={e => change(e.target.value)}
              placeholder="اسم الأصل,عنوان IP,عنوان MAC&#10;LAB-01,192.0.2.10,02:AA:00:00:00:10"
            />
          </label>
          <div className="import-input-actions">
            <label className="upload-inline">
              <Upload size={16} /> اختيار ملف CSV محلي
              <input
                aria-label="اختيار ملف CSV للأصول"
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={loadFile}
              />
            </label>
            <Button type="button" onClick={inspect} disabled={!text.trim() || loading}>
              {loading ? 'جارٍ قراءة الملف…' : 'معاينة والتحقق'}
            </Button>
          </div>
          {error && (
            <div className="import-error" role="alert">
              {error}
            </div>
          )}
          {preview && (
            <section className="import-preview" aria-label="معاينة الأصول المستوردة">
              <div className="import-summary" ref={summaryRef} tabIndex="-1" role="status">
                <strong>نتيجة المعاينة</strong>
                <span>
                  {ar(preview.records.length)} صف · {ar(selected.length)} محدد للإضافة
                </span>
              </div>
              <p>
                الصفوف الصالحة غير المكررة محددة تلقائيًا. المكررات غير محددة؛ يمكنك اختيارها يدويًا
                بعد مراجعة التحذير. التكرار يعتمد على القيم الموجودة في العينة أو الملف، وليس تحققًا
                شاملاً للهوية.
              </p>
              {preview.unknown.length > 0 && (
                <p className="import-warning">
                  أعمدة لم تُستخدم: {preview.unknown.map(x => x || 'عمود بلا عنوان').join('، ')}.
                </p>
              )}
              <Table
                label="جدول معاينة الأصول المستوردة"
                head={['اختيار', 'الأصل', 'عنوان IP', 'عنوان MAC', 'النتيجة']}
              >
                {visible.map(row => (
                  <tr key={row.index}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`اختيار الصف ${row.index}: ${row.values.name || 'دون اسم'}`}
                        disabled={!!row.errors.length}
                        checked={selected.includes(row.index)}
                        onChange={() => toggle(row.index)}
                      />
                    </td>
                    <td>
                      <strong>{row.values.name || '—'}</strong>
                      <small className="record-id">صف {ar(row.index)}</small>
                    </td>
                    <td>
                      <bdi className="import-address" dir="ltr">
                        {row.values.ip || '—'}
                      </bdi>
                    </td>
                    <td>
                      <bdi className="import-address" dir="ltr">
                        {row.values.mac || '—'}
                      </bdi>
                    </td>
                    <td>
                      {row.errors.length ? (
                        <span className="import-row-error">{row.errors.join('؛ ')}</span>
                      ) : row.warnings.length ? (
                        <span className="import-row-warning">{row.warnings.join('؛ ')}</span>
                      ) : (
                        <span className="import-row-valid">صالح للإضافة</span>
                      )}
                      <details className="import-row-details">
                        <summary
                          aria-label={`تفاصيل الصف ${row.index}: ${row.values.name || 'دون اسم'}`}
                        >
                          تفاصيل الحقول
                        </summary>
                        <dl>
                          {fields.map(([label, key]) => (
                            <React.Fragment key={key}>
                              <dt>{label}</dt>
                              <dd>
                                <bdi dir="auto">{row.values[key] || '—'}</bdi>
                              </dd>
                            </React.Fragment>
                          ))}
                        </dl>
                      </details>
                    </td>
                  </tr>
                ))}
              </Table>
              {pages > 1 && (
                <div className="import-pagination">
                  <Button type="button" disabled={page === 0} onClick={() => setPage(n => n - 1)}>
                    السابق
                  </Button>
                  <span>
                    صفحة {ar(page + 1)} من {ar(pages)}
                  </span>
                  <Button
                    type="button"
                    disabled={page === pages - 1}
                    onClick={() => setPage(n => n + 1)}
                  >
                    التالي
                  </Button>
                </div>
              )}
            </section>
          )}
          <InfoBox>
            الاستيراد يضيف سجلات مؤقتة للواجهة فقط، ولا يكتشف الأجهزة أو يحفظ البيانات عند إعادة
            التحميل.
          </InfoBox>
          <div className="modal-actions">
            <Button type="button" onClick={requestClose}>
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!preview || !selected.length}
              onClick={importSelected}
            >
              إضافة المحدد للعينة
            </Button>
          </div>
        </div>
      </Modal>
      {confirm && (
        <Modal
          title="تغييرات غير محفوظة"
          subtitle="تأكيد مغادرة الاستيراد"
          onClose={() => setConfirm(false)}
        >
          <div className="modal-content">
            <InfoBox tone="amber">لديك بيانات استيراد لم تُضف. هل تريد تجاهلها؟</InfoBox>
            <div className="modal-actions">
              <Button type="button" onClick={() => setConfirm(false)}>
                متابعة التعديل
              </Button>
              <Button type="button" variant="primary" onClick={close}>
                تجاهل التغييرات
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
