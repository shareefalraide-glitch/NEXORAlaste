import React, { useRef, useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import { ar, Button, Tag } from '../../../shared/ui/index';
import NoteBody from './NoteBody';
import {
  NOTE_SECTIONS,
  NOTE_TYPES,
  NOTEBOOK_BRAND,
  NOTEBOOK_FOOTER,
  NOTEBOOK_REFERENCES,
  buildNotebookExport,
  noteReferences,
  notebookImageAlt,
  sectionId,
  validImage,
} from './notebook-model';

function NotebookDocument({ incident, selected, options, previewRef }) {
  return (
    <article className="notebook-export-document" aria-label="معاينة دفتر التحقيق" ref={previewRef}>
      <header>
        <small>{NOTEBOOK_BRAND}</small>
        <h3>دفتر التحقيق</h3>
        <p>
          {incident?.title || 'تحقيق تجريبي'} · <bdi dir="ltr">{incident?.id || ''}</bdi>
        </p>
      </header>
      {options.summary && (
        <section>
          <h4>الملخص الذي كتبه المحلل</h4>
          <p className="notebook-summary-output">{selected.summary || 'لم يُكتب ملخص.'}</p>
        </section>
      )}
      {options.tasks && (
        <section>
          <h4>قائمة التحقق</h4>
          {selected.tasks.length ? (
            <ul>
              {selected.tasks.map(task => (
                <li key={task.id}>
                  {task.done ? '✓' : '□'} {task.text}
                </li>
              ))}
            </ul>
          ) : (
            <p>لا توجد مهام.</p>
          )}
        </section>
      )}
      {options.notes &&
        NOTE_SECTIONS.map(([id, label]) => {
          const notes = selected.notes.filter(note => sectionId(note.section) === id);
          return notes.length ? (
            <section key={id}>
              <h4>{label}</h4>
              {notes.map(note => (
                <div className="notebook-export-note" key={note.id}>
                  <strong>{NOTE_TYPES[note.type] || NOTE_TYPES.observation}</strong>
                  <NoteBody text={note.text} />
                  {noteReferences(note).length > 0 && (
                    <small>
                      {NOTEBOOK_REFERENCES}:{' '}
                      {noteReferences(note)
                        .map(ref => ref.label || ref.id)
                        .join('، ')}
                    </small>
                  )}
                  {options.images && validImage(note.image) && (
                    <img src={note.image.dataUrl} alt={notebookImageAlt(note.image)} />
                  )}
                </div>
              ))}
            </section>
          ) : null;
        })}
      <footer>{NOTEBOOK_FOOTER}</footer>
    </article>
  );
}
export default function NotebookExport({ incident, workspace }) {
  const [summary, setSummary] = useState(true),
    [tasks, setTasks] = useState(true),
    [notes, setNotes] = useState(true),
    [images, setImages] = useState(false),
    [sections, setSections] = useState(NOTE_SECTIONS.map(item => item[0])),
    [notice, setNotice] = useState('');
  const previewRef = useRef(null),
    copyRef = useRef(null),
    options = { summary, tasks, notes, images: notes && images, sections };
  const { html, text, selected } = buildNotebookExport(incident, workspace, options);
  const availableImages = selected.notes.filter(note => validImage(note.image)).length;
  const includedImages = options.images ? availableImages : 0;
  const inFrame = () => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  };
  const download = () => {
    if (inFrame()) {
      setNotice(
        'قد يمنع عارض الملفات المعزول التنزيل. افتح ملف العرض في متصفح مستقل، أو حدّد النص القابل للنسخ أدناه.',
      );
      return;
    }
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' })),
      link = document.createElement('a');
    link.href = url;
    link.download = `NEXORA-Notebook-${String(incident.id).replace(/[^a-z0-9_-]/gi, '-')}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    setNotice('أُعدّ ملف HTML محلي بالمحتوى الظاهر في المعاينة فقط.');
  };
  const print = () => {
    if (inFrame()) {
      setNotice(
        'قد يمنع العارض المعزول الطباعة. افتح العرض في متصفح مستقل أو استخدم النسخة النصية أدناه.',
      );
      return;
    }
    const node = previewRef.current?.cloneNode(true);
    if (!node) return;
    node.classList.add('notebook-print-root');
    document.body.appendChild(node);
    document.body.classList.add('nexora-notebook-printing');
    let timer;
    const clean = () => {
      document.body.classList.remove('nexora-notebook-printing');
      node.remove();
      clearTimeout(timer);
      window.removeEventListener('afterprint', clean);
    };
    window.addEventListener('afterprint', clean, { once: true });
    try {
      window.print();
      timer = setTimeout(clean, 10000);
    } catch {
      clean();
      setNotice('تعذرت الطباعة هنا؛ يمكنك تنزيل ملف HTML أو نسخ النص.');
    }
  };
  const selectCopy = () => {
    copyRef.current?.focus();
    copyRef.current?.select();
    setNotice('حُدد النص. انسخه بالطريقة المعتادة؛ النسخة النصية لا تحتوي الصور.');
  };
  return (
    <details className="notebook-export">
      <summary>
        <span>
          <FileText size={17} /> معاينة دفتر التحقيق وتصديره
        </span>
        <Tag color="blue">اختياري</Tag>
      </summary>
      <div className="notebook-export-body">
        <p>
          حدّد المحتوى وراجعه قبل التنزيل أو الطباعة. الملاحظات والصور قد تحتوي معلومات حساسة؛ لا
          تضع بيانات حقيقية في هذه العينة.
        </p>
        <fieldset className="notebook-export-options">
          <legend>المحتوى المراد تضمينه</legend>
          <label>
            <input
              type="checkbox"
              checked={summary}
              onChange={event => setSummary(event.target.checked)}
            />{' '}
            ملخص المحلل
          </label>
          <label>
            <input
              type="checkbox"
              checked={tasks}
              onChange={event => setTasks(event.target.checked)}
            />{' '}
            قائمة التحقق
          </label>
          <label>
            <input
              type="checkbox"
              checked={notes}
              onChange={event => {
                setNotes(event.target.checked);
                if (!event.target.checked) setImages(false);
              }}
            />{' '}
            الملاحظات
          </label>
          <label>
            <input
              type="checkbox"
              checked={images}
              disabled={!notes}
              onChange={event => setImages(event.target.checked)}
            />{' '}
            تضمين الصور المحلية اختياريًا
          </label>
        </fieldset>
        {notes && (
          <fieldset className="notebook-export-options notebook-export-sections">
            <legend>أقسام الملاحظات</legend>
            {NOTE_SECTIONS.map(([id, label]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={sections.includes(id)}
                  onChange={event =>
                    setSections(current =>
                      event.target.checked
                        ? [...current, id]
                        : current.filter(value => value !== id),
                    )
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
        )}
        <div className="notebook-export-manifest" role="group" aria-label="ملخص محتوى التصدير">
          <div>
            <span>الملخص</span>
            <strong>{summary ? 'مضمّن' : 'مستبعد'}</strong>
          </div>
          <div>
            <span>المهام</span>
            <strong>{tasks ? `${ar(selected.tasks.length)} مهمة` : 'مستبعدة'}</strong>
          </div>
          <div>
            <span>الملاحظات</span>
            <strong>{notes ? `${ar(selected.notes.length)} ملاحظة` : 'مستبعدة'}</strong>
          </div>
          <div>
            <span>الصور</span>
            <strong>{options.images ? `${ar(includedImages)} مضمّنة` : 'مستبعدة'}</strong>
          </div>
        </div>
        <div className="notebook-preview-heading">
          <strong>معاينة المحتوى المحدد</strong>
          <small>{options.images ? `${ar(includedImages)} صورة مضمّنة` : 'الصور مستبعدة'}</small>
        </div>
        <p className="notebook-preview-help">
          محتوى المعاينة هو المحتوى المختار للتصدير؛ قد يختلف التنسيق بين HTML والطباعة. الملف
          المنزّل يبقى على جهازك بعد الخروج أو التحديث.
        </p>
        <NotebookDocument
          incident={incident}
          selected={selected}
          options={options}
          previewRef={previewRef}
        />
        <div className="notebook-export-actions">
          <Button type="button" icon={Download} onClick={download}>
            تنزيل دفتر HTML
          </Button>
          <Button type="button" icon={Printer} onClick={print}>
            طباعة / حفظ PDF
          </Button>
          <Button type="button" onClick={selectCopy}>
            تحديد النص للنسخ
          </Button>
        </div>
        <label className="notebook-copy-label">
          نسخة نصية قابلة للنسخ
          <textarea
            ref={copyRef}
            aria-label="النص القابل للنسخ من الدفتر"
            readOnly
            value={text}
            rows={5}
          />
        </label>
        <p className="experience-footnote">
          لا يتضمن النص المنسوخ الصور. قد يمنع العارض المعزول التنزيل والطباعة؛ افتح العرض في متصفح
          مستقل عند الحاجة. التنزيل يحفظ نسخة في جهازك ولا يرفعها إلى خادم.
        </p>
        {notice && (
          <p className="notebook-export-notice" role="status">
            {notice}
          </p>
        )}
      </div>
    </details>
  );
}
