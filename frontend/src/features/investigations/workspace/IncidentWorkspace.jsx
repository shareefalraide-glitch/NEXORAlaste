import { useLandmarkScope } from '../../../shared/hooks/landmark-scope';
import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  CheckCircle2,
  ImagePlus,
  ListChecks,
  MessageSquareText,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { ar, Button, enterToSubmit, InfoBox, Tag } from '../../../shared/ui/index';
import { useSessionValue } from '../../../shared/hooks/session-state';
import NotebookExport from '../notebook/NotebookExport';
import NoteBody from '../notebook/NoteBody';
import {
  NOTE_TYPES as noteTypes,
  NOTE_SECTIONS,
  noteSection,
  sectionId,
} from '../notebook/notebook-model';

export const defaultInvestigation = () => ({
  tasks: [
    { id: 'default-context', text: 'مراجعة سياق التنبيه والأصل', done: false },
    { id: 'default-evidence', text: 'مراجعة السجلات المرتبطة في العينة', done: false },
    { id: 'default-decision', text: 'توثيق القرار والخطوة التالية', done: false },
  ],
  notes: [],
});
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const MAX_IMAGE_BYTES = 1024 * 1024,
  MAX_IMAGES = 3,
  MAX_NOTES = 50,
  MAX_TASKS = 100,
  MAX_LINKS = 6;
const referenceKey = item => `${item.kind}|${item.id}`;
const referencesFor = note =>
  Array.isArray(note.links) ? note.links : note.link ? [note.link] : [];

export default function IncidentWorkspace({
  incidentId,
  incident,
  investigations,
  setInvestigations,
  offlineSimulation,
  relatedAlerts = [],
  relatedEvents = [],
  asset,
  openDetail,
  onIncidentContext,
  sessionRef,
}) {
  const landmark = useLandmarkScope();
  // All drafts (including an unprocessed File object) stay only in this page's
  // memory. A FileReader interrupted by tab switching is restarted on return.
  const scope = `notebook-draft:${incidentId}`;
  const [taskText, setTaskText] = useSessionValue(sessionRef, scope, 'taskText', '');
  const [noteText, setNoteText] = useSessionValue(sessionRef, scope, 'noteText', '');
  const [noteType, setNoteType] = useSessionValue(sessionRef, scope, 'noteType', 'observation');
  const [noteSectionValue, setNoteSection] = useSessionValue(
    sessionRef,
    scope,
    'noteSection',
    'general',
  );
  const [sectionFilter, setSectionFilter] = useSessionValue(
    sessionRef,
    scope,
    'sectionFilter',
    'all',
  );
  const [link, setLink] = useSessionValue(sessionRef, scope, 'link', '');
  const [draftRefs, setDraftRefs] = useSessionValue(sessionRef, scope, 'references', []);
  const [editing, setEditing] = useSessionValue(sessionRef, scope, 'editing', null);
  const [editText, setEditText] = useSessionValue(sessionRef, scope, 'editText', '');
  const [image, setImage] = useSessionValue(sessionRef, scope, 'image', null);
  const [draftFile, setDraftFile] = useSessionValue(sessionRef, scope, 'file', null);
  const [search, setSearch] = useSessionValue(sessionRef, scope, 'search', '');
  const [typeFilter, setTypeFilter] = useSessionValue(sessionRef, scope, 'typeFilter', 'all');
  const [announcement, setAnnouncement] = useState(''),
    [imageError, setImageError] = useState(''),
    [imageLoading, setImageLoading] = useState(false);
  const taskRef = useRef(null),
    noteRef = useRef(null),
    editRef = useRef(null),
    fileRef = useRef(null),
    searchRef = useRef(null),
    moveRefs = useRef({}),
    workspaceRef = useRef(null);
  useEffect(() => {
    if (editing) editRef.current?.focus();
  }, [editing]);
  useEffect(() => {
    if (!draftFile) return;
    let canceled = false;
    const reader = new FileReader();
    setImageLoading(true);
    reader.onload = () => {
      if (canceled) return;
      const value = String(reader.result || '');
      if (!/^data:image\/(png|jpeg|webp);base64,/i.test(value)) {
        setImageError('تعذرت معاينة الصورة.');
        setDraftFile(null);
        setImageLoading(false);
        return;
      }
      setImage({ name: draftFile.name.slice(0, 120), dataUrl: value });
      setDraftFile(null);
      setImageLoading(false);
    };
    reader.onerror = () => {
      if (!canceled) {
        setImageError('تعذرت قراءة الصورة محليًا.');
        setDraftFile(null);
        setImageLoading(false);
      }
    };
    reader.readAsDataURL(draftFile);
    return () => {
      canceled = true;
      if (reader.readyState === 1) reader.abort();
    };
  }, [draftFile]);
  const finishEdit = () => {
    const id = editing;
    setEditing(null);
    setEditText('');
    requestAnimationFrame(() => {
      const target = workspaceRef.current?.querySelector(`[data-note-edit="${id}"]`);
      (target || searchRef.current || noteRef.current)?.focus();
    });
  };
  const workspace = investigations[incidentId] || defaultInvestigation(),
    done = workspace.tasks.filter(x => x.done).length,
    imageCount = workspace.notes.filter(x => x.image).length;
  const links = [
    { kind: 'incident', id: incidentId, label: `حادثة ${incidentId}` },
    ...relatedAlerts.map(x => ({ kind: 'alert', id: x.id, label: `تنبيه ${x.id}` })),
    ...relatedEvents.map(x => ({ kind: 'event', id: x.id, label: `حدث ${x.id}` })),
    ...(asset ? [{ kind: 'asset', id: asset.id, label: `أصل ${asset.name} · ${asset.id}` }] : []),
  ];
  const selected = links.find(item => referenceKey(item) === link),
    alreadySelected =
      selected && draftRefs.some(item => referenceKey(item) === referenceKey(selected));
  const tooManyRefs = !!selected && !alreadySelected && draftRefs.length >= MAX_LINKS;
  const loading = !!draftFile || imageLoading;
  const change = fn => {
    if (offlineSimulation) return;
    setInvestigations(current => ({
      ...current,
      [incidentId]: fn(current[incidentId] || defaultInvestigation()),
    }));
  };
  const addTask = () => {
    const text = taskText.trim();
    if (!text || offlineSimulation || workspace.tasks.length >= MAX_TASKS) return;
    change(current => ({
      ...current,
      tasks: [...current.tasks, { id: uid(), text, done: false }],
    }));
    setTaskText('');
    setAnnouncement('أضيفت المهمة إلى قائمة هذه الحادثة.');
    taskRef.current?.focus();
  };
  const moveTask = (id, delta) => {
    if (offlineSimulation) return;
    const index = workspace.tasks.findIndex(item => item.id === id),
      next = index + delta;
    if (index < 0 || next < 0 || next >= workspace.tasks.length) return;
    change(current => {
      const tasks = [...current.tasks],
        at = tasks.findIndex(item => item.id === id),
        to = at + delta;
      if (at < 0 || to < 0 || to >= tasks.length) return current;
      [tasks[at], tasks[to]] = [tasks[to], tasks[at]];
      return { ...current, tasks };
    });
    setAnnouncement('تغيّر ترتيب المهمة لهذه الحادثة.');
    requestAnimationFrame(() => {
      const refs = moveRefs.current[id];
      const button = refs?.[delta < 0 ? 'up' : 'down'];
      (button && !button.disabled ? button : refs?.[delta < 0 ? 'down' : 'up'])?.focus();
    });
  };
  const clearImage = () => {
    setDraftFile(null);
    setImage(null);
    setImageError('');
    setImageLoading(false);
    if (fileRef.current) fileRef.current.value = '';
  };
  const chooseImage = event => {
    const file = event.target.files?.[0];
    clearImage();
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setImageError('اختر صورة PNG أو JPEG أو WebP فقط.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('الحد الأقصى للصورة الواحدة ١ ميغابايت.');
      return;
    }
    if (imageCount >= MAX_IMAGES) {
      setImageError('يمكن إرفاق ثلاث صور مؤقتة كحد أقصى لكل حادثة.');
      return;
    }
    setDraftFile(file);
  };
  const addReference = () => {
    if (!selected || alreadySelected || draftRefs.length >= MAX_LINKS) return;
    setDraftRefs(prev => [...prev, selected]);
    setLink('');
    setAnnouncement('أُضيف السجل إلى روابط مسودة الملاحظة.');
  };
  const addNote = () => {
    const text = noteText.trim();
    if (!text || offlineSimulation || loading || tooManyRefs || workspace.notes.length >= MAX_NOTES)
      return;
    const refs = [...draftRefs, ...(selected && !alreadySelected ? [selected] : [])];
    change(current => ({
      ...current,
      notes: [
        ...current.notes,
        {
          id: uid(),
          text,
          type: noteTypes[noteType] ? noteType : 'observation',
          section: sectionId(noteSectionValue),
          links: refs,
          link: refs[0] || null,
          pinned: false,
          resolved: false,
          image: imageCount < MAX_IMAGES ? image : null,
        },
      ],
    }));
    setNoteText('');
    setLink('');
    setDraftRefs([]);
    clearImage();
    setAnnouncement('أضيفت الملاحظة إلى دفتر هذه الحادثة في الجلسة.');
    noteRef.current?.focus();
  };
  const saveEdit = () => {
    if (!editText.trim() || offlineSimulation) return;
    change(current => ({
      ...current,
      notes: current.notes.map(note =>
        note.id === editing ? { ...note, text: editText.trim() } : note,
      ),
    }));
    finishEdit();
    setAnnouncement('تم تعديل الملاحظة في الجلسة.');
  };
  const insertMarker = marker => {
    if (offlineSimulation || noteText.length + marker.length > 600) return;
    const area = noteRef.current,
      at = area?.selectionStart ?? noteText.length,
      line = at === 0 ? 0 : noteText.lastIndexOf('\n', at - 1) + 1;
    setNoteText(noteText.slice(0, line) + marker + noteText.slice(line));
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(at + marker.length, at + marker.length);
    });
  };
  const q = search.trim().toLocaleLowerCase();
  const matching = workspace.notes
    .map((note, index) => ({ note, index }))
    .filter(
      ({ note }) =>
        (typeFilter === 'all' || note.type === typeFilter) &&
        (sectionFilter === 'all' || sectionId(note.section) === sectionFilter) &&
        (!q ||
          [
            note.text,
            noteTypes[note.type],
            noteSection(note.section),
            ...referencesFor(note).map(item => `${item.id} ${item.label}`),
          ].some(value =>
            String(value || '')
              .toLocaleLowerCase()
              .includes(q),
          )),
    );
  return (
    <section
      ref={workspaceRef}
      className="incident-workspace"
      aria-label={landmark('قائمة مهام وملاحظات الحادثة')}
    >
      <div className="workspace-heading">
        <div>
          <span>
            <ListChecks size={17} /> دفتر التحقيق والمهام
          </span>
          <p>مساحة مرتبطة بهذه الحادثة ومحلل العرض التجريبي، وليست حسابًا خاصًا محميًا.</p>
        </div>
        <Tag color="blue">الجلسة فقط</Tag>
      </div>
      <InfoBox tone="amber" title="لا تُدخل معلومات حساسة">
        تبقى المهام والملاحظات والصور والمسودات في ذاكرة الصفحة وتُمسح عند إعادة التحميل أو تسجيل
        الخروج؛ لا تُرفع الملفات ولا تُحفظ على خادم. هذه ليست أدلة أو سجل تدقيق.
      </InfoBox>
      {offlineSimulation && (
        <p className="preference-warning" role="status">
          يمكن قراءة المحتوى فقط أثناء محاكاة الانقطاع؛ التعديل متوقف.
        </p>
      )}
      <div className="workspace-section notebook-summary-section">
        <div className="workspace-section-heading">
          <div>
            <strong>
              <MessageSquareText size={16} /> ملخص المحلل
            </strong>
            <small>يكتبه المحلل يدويًا ويظل في هذه الجلسة فقط</small>
          </div>
        </div>
        <label className="analyst-field">
          الملخص التنفيذي <small>اختياري</small>
          <textarea
            aria-label="ملخص المحلل للحادثة"
            maxLength={1500}
            value={workspace.summary || ''}
            disabled={offlineSimulation}
            onChange={event => change(current => ({ ...current, summary: event.target.value }))}
            placeholder="ما الذي تعرفه، وما الذي يحتاج إلى متابعة؟"
          />
        </label>
      </div>
      <div className="workspace-section">
        <div className="workspace-section-heading">
          <div>
            <strong>
              <ListChecks size={16} /> قائمة التحقق
            </strong>
            <small>
              {ar(done)} من {ar(workspace.tasks.length)} مكتملة · الحد {ar(MAX_TASKS)}
            </small>
          </div>
          <progress
            aria-label="تقدم قائمة التحقق"
            value={done}
            max={Math.max(workspace.tasks.length, 1)}
          />
        </div>
        <p className="notebook-hint">رتّب المهام يدويًا حسب أولويتك؛ الترتيب لا ينفّذ إجراءً.</p>
        <ul className="case-checklist">
          {workspace.tasks.map((task, index) => (
            <li key={task.id}>
              <label>
                <input
                  type="checkbox"
                  aria-label={task.text}
                  checked={task.done}
                  disabled={offlineSimulation}
                  onChange={() => {
                    change(current => ({
                      ...current,
                      tasks: current.tasks.map(item =>
                        item.id === task.id ? { ...item, done: !item.done } : item,
                      ),
                    }));
                    setAnnouncement(
                      task.done
                        ? 'أعيدت المهمة إلى غير مكتملة.'
                        : 'وُضعت علامة اكتمال المهمة في العينة.',
                    );
                  }}
                />
                <span className={task.done ? 'completed' : ''}>{task.text}</span>
              </label>
              <div className="notebook-task-actions">
                <button
                  ref={el => {
                    (moveRefs.current[task.id] ||= {}).up = el;
                  }}
                  type="button"
                  aria-label={`نقل المهمة إلى أعلى: ${task.text}`}
                  disabled={offlineSimulation || index === 0}
                  onClick={() => moveTask(task.id, -1)}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  ref={el => {
                    (moveRefs.current[task.id] ||= {}).down = el;
                  }}
                  type="button"
                  aria-label={`نقل المهمة إلى أسفل: ${task.text}`}
                  disabled={offlineSimulation || index === workspace.tasks.length - 1}
                  onClick={() => moveTask(task.id, 1)}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  aria-label={`حذف المهمة: ${task.text}`}
                  disabled={offlineSimulation}
                  onClick={() => {
                    change(current => ({
                      ...current,
                      tasks: current.tasks.filter(item => item.id !== task.id),
                    }));
                    setAnnouncement('حُذفت المهمة من هذه الحادثة.');
                    taskRef.current?.focus();
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {!workspace.tasks.length && (
          <p className="detail-muted">القائمة فارغة؛ أضف مهمة توضيحية.</p>
        )}
        {workspace.tasks.length >= 90 && (
          <p className="notebook-capacity" role="status">
            {workspace.tasks.length >= MAX_TASKS
              ? 'بلغت الحد الأقصى للمهام.'
              : `اقتربت من الحد: تبقّى ${ar(MAX_TASKS - workspace.tasks.length)} مهام.`}
          </p>
        )}
        <div className="workspace-add">
          <input
            ref={taskRef}
            aria-label="مهمة جديدة للحادثة"
            value={taskText}
            disabled={offlineSimulation || workspace.tasks.length >= MAX_TASKS}
            maxLength={120}
            placeholder="أضف مهمة تحقق..."
            onChange={event => setTaskText(event.target.value)}
            onKeyDown={enterToSubmit(addTask)}
          />
          <Button
            type="button"
            icon={Plus}
            disabled={offlineSimulation || !taskText.trim() || workspace.tasks.length >= MAX_TASKS}
            onClick={addTask}
          >
            إضافة مهمة
          </Button>
        </div>
      </div>
      <div className="workspace-section analyst-notebook">
        <div className="workspace-section-heading">
          <div>
            <strong>
              <MessageSquareText size={16} /> دفتر ملاحظات الحادثة
            </strong>
            <small>
              {ar(workspace.notes.length)} من {ar(MAX_NOTES)} ملاحظة ·{' '}
              {ar(workspace.notes.filter(x => x.type === 'question' && !x.resolved).length)} سؤال
              مفتوح
            </small>
          </div>
        </div>
        {workspace.notes.length > 0 && (
          <div className="notebook-search">
            <label>
              <Search size={15} />
              <input
                ref={searchRef}
                aria-label="البحث في ملاحظات الحادثة"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="ابحث بالنص أو مرجع السجل…"
              />
            </label>
            <select
              aria-label="تصفية نوع الملاحظات"
              value={typeFilter}
              onChange={event => setTypeFilter(event.target.value)}
            >
              <option value="all">كل الأنواع</option>
              {Object.entries(noteTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="تصفية قسم الملاحظات"
              value={sectionFilter}
              onChange={event => setSectionFilter(event.target.value)}
            >
              <option value="all">كل الأقسام</option>
              {NOTE_SECTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <small aria-live="polite">
              {ar(matching.length)} من {ar(workspace.notes.length)}
            </small>
          </div>
        )}
        {workspace.notes.length > 0 && !matching.length && (
          <p className="detail-muted">لا توجد ملاحظات تطابق البحث أو التصفية.</p>
        )}
        {matching.length > 0 && (
          <ol className="case-notes">
            {matching.map(({ note, index }) => (
              <li key={note.id}>
                <div className="note-head">
                  <strong>
                    ملاحظة {ar(index + 1)}{' '}
                    {note.pinned && <span className="analyst-pin-label">· مرجعية</span>}
                  </strong>
                  <div>
                    {editing !== note.id && (
                      <button
                        type="button"
                        disabled={offlineSimulation}
                        data-note-edit={note.id}
                        onClick={() => {
                          setEditing(note.id);
                          setEditText(note.text);
                        }}
                        aria-label={`تعديل الملاحظة ${ar(index + 1)}`}
                      >
                        تعديل
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={offlineSimulation}
                      onClick={() => {
                        change(current => ({
                          ...current,
                          notes: current.notes.filter(item => item.id !== note.id),
                        }));
                        if (editing === note.id) {
                          setEditing(null);
                          setEditText('');
                        }
                        setAnnouncement('حُذفت الملاحظة من هذه الحادثة.');
                        noteRef.current?.focus();
                      }}
                      aria-label={`حذف الملاحظة ${ar(index + 1)}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="analyst-note-tags">
                  <Tag
                    color={
                      note.type === 'hypothesis'
                        ? 'purple'
                        : note.type === 'question'
                          ? 'orange'
                          : 'blue'
                    }
                  >
                    {noteTypes[note.type] || noteTypes.observation}
                  </Tag>
                  <Tag>{noteSection(note.section)}</Tag>
                  {note.type === 'question' && (
                    <Tag>{note.resolved ? 'أجاب المحلل' : 'بانتظار الإجابة'}</Tag>
                  )}
                </div>
                {editing === note.id ? (
                  <div className="note-editor">
                    <textarea
                      ref={editRef}
                      aria-label={`تعديل الملاحظة ${ar(index + 1)}`}
                      onKeyDown={event => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          event.stopPropagation();
                          finishEdit();
                        }
                      }}
                      value={editText}
                      maxLength={600}
                      disabled={offlineSimulation}
                      onChange={event => setEditText(event.target.value)}
                    />
                    <div>
                      <Button
                        type="button"
                        icon={Save}
                        disabled={offlineSimulation || !editText.trim()}
                        onClick={saveEdit}
                      >
                        حفظ التعديل
                      </Button>
                      <Button type="button" icon={X} onClick={finishEdit}>
                        إلغاء
                      </Button>
                    </div>
                  </div>
                ) : (
                  <NoteBody text={note.text} />
                )}
                {referencesFor(note).map(ref => (
                  <button
                    type="button"
                    key={referenceKey(ref)}
                    className="analyst-note-link"
                    onClick={() => {
                      if (ref.kind === 'incident' && ref.id === incidentId) onIncidentContext?.();
                      else openDetail?.(ref.kind, ref.id);
                    }}
                  >
                    فتح السجل المرتبط: <bdi dir="auto">{ref.label}</bdi>
                  </button>
                ))}
                {note.image && (
                  <div className="analyst-note-image">
                    <img
                      src={note.image.dataUrl}
                      alt={`معاينة محلية للصورة المرفقة بالملاحظة ${ar(index + 1)}`}
                    />
                    <div>
                      <small>{note.image.name} · معاينة مؤقتة</small>
                      <button
                        type="button"
                        disabled={offlineSimulation}
                        aria-label={`إزالة الصورة من الملاحظة ${ar(index + 1)}`}
                        onClick={() =>
                          change(current => ({
                            ...current,
                            notes: current.notes.map(item =>
                              item.id === note.id ? { ...item, image: null } : item,
                            ),
                          }))
                        }
                      >
                        إزالة الصورة
                      </button>
                    </div>
                  </div>
                )}
                <div className="analyst-note-controls">
                  <button
                    type="button"
                    disabled={offlineSimulation}
                    aria-pressed={!!note.pinned}
                    aria-label={`${note.pinned ? 'إلغاء تثبيت' : 'تثبيت'} الملاحظة ${ar(index + 1)}`}
                    onClick={() =>
                      change(current => ({
                        ...current,
                        notes: current.notes.map(item =>
                          item.id === note.id ? { ...item, pinned: !item.pinned } : item,
                        ),
                      }))
                    }
                  >
                    <Bookmark size={14} />
                    {note.pinned ? 'مثبتة' : 'تثبيت'}
                  </button>
                  {note.type === 'question' && (
                    <button
                      type="button"
                      disabled={offlineSimulation}
                      aria-pressed={!!note.resolved}
                      onClick={() =>
                        change(current => ({
                          ...current,
                          notes: current.notes.map(item =>
                            item.id === note.id ? { ...item, resolved: !item.resolved } : item,
                          ),
                        }))
                      }
                    >
                      <CheckCircle2 size={14} />
                      {note.resolved ? 'إعادة فتح السؤال' : 'تعليم السؤال كمجاب'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
        {workspace.notes.length >= 45 && (
          <p className="notebook-capacity" role="status">
            {workspace.notes.length >= MAX_NOTES
              ? 'بلغت حد ٥٠ ملاحظة لهذه الحادثة؛ احذف ملاحظة قبل إضافة أخرى.'
              : `اقتربت من الحد؛ تبقّى ${ar(MAX_NOTES - workspace.notes.length)} ملاحظات.`}
          </p>
        )}
        <div className="analyst-notebook-fields">
          <label className="analyst-field">
            نوع الملاحظة
            <select
              aria-label="نوع الملاحظة"
              value={noteType}
              disabled={offlineSimulation}
              onChange={event => setNoteType(event.target.value)}
            >
              {Object.entries(noteTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="analyst-field">
            ربط بسجل من الحادثة
            <select
              aria-label="ربط الملاحظة بسجل"
              value={link}
              disabled={offlineSimulation}
              onChange={event => setLink(event.target.value)}
            >
              <option value="">دون ربط</option>
              {links.map(item => (
                <option key={referenceKey(item)} value={referenceKey(item)}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="analyst-field notebook-section-picker">
          قسم الملاحظة
          <select
            aria-label="قسم الملاحظة"
            value={noteSectionValue}
            disabled={offlineSimulation}
            onChange={event => setNoteSection(event.target.value)}
          >
            {NOTE_SECTIONS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="notebook-reference-tools">
          <Button
            type="button"
            icon={Plus}
            disabled={
              offlineSimulation || !selected || alreadySelected || draftRefs.length >= MAX_LINKS
            }
            onClick={addReference}
          >
            إضافة رابط آخر
          </Button>
          <small>حتى {ar(MAX_LINKS)} سجلات؛ السجل المحدد يُضاف عند حفظ الملاحظة.</small>
        </div>
        {draftRefs.length > 0 && (
          <div className="notebook-draft-references" role="group" aria-label="روابط مسودة الملاحظة">
            {draftRefs.map(ref => (
              <span key={referenceKey(ref)}>
                <bdi dir="auto">{ref.label}</bdi>
                <button
                  type="button"
                  disabled={offlineSimulation}
                  aria-label={`إزالة رابط ${ref.label} من المسودة`}
                  onClick={() =>
                    setDraftRefs(prev =>
                      prev.filter(item => referenceKey(item) !== referenceKey(ref)),
                    )
                  }
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
        {tooManyRefs && (
          <p className="notebook-capacity" role="alert">
            بلغت حد الروابط؛ أزل رابطًا من المسودة أو اختر «دون ربط».
          </p>
        )}
        <div className="notebook-format-tools" role="group" aria-label="تنسيق نص الملاحظة">
          <button
            type="button"
            disabled={offlineSimulation || noteText.length > 598}
            onClick={() => insertMarker('# ')}
          >
            إدراج عنوان
          </button>
          <button
            type="button"
            disabled={offlineSimulation || noteText.length > 598}
            onClick={() => insertMarker('- ')}
          >
            إدراج بند قائمة
          </button>
          <small>تنسيق نصي بسيط؛ لا يُنفّذ HTML.</small>
        </div>
        <label className="workspace-note-label">
          ملاحظة جديدة
          <textarea
            ref={noteRef}
            aria-label="ملاحظة جديدة للحادثة"
            value={noteText}
            disabled={offlineSimulation}
            maxLength={600}
            placeholder="ملاحظة توضيحية غير حساسة..."
            onChange={event => setNoteText(event.target.value)}
          />
        </label>
        {noteText.length >= 540 && (
          <p className="notebook-capacity" role="status">
            تبقّى {ar(600 - noteText.length)} حرفًا في المسودة.
          </p>
        )}
        <div className="analyst-image-picker">
          <label>
            <ImagePlus size={15} />
            <span>صورة توضيحية اختيارية</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="اختيار صورة توضيحية للملاحظة"
              disabled={offlineSimulation || imageCount >= MAX_IMAGES}
              onChange={chooseImage}
            />
          </label>
          <small>
            PNG أو JPEG أو WebP · حتى ١ ميغابايت · {ar(imageCount)} من {ar(MAX_IMAGES)} صور مؤقتة
          </small>
          {imageCount >= MAX_IMAGES - 1 && (
            <small className="notebook-capacity">
              {imageCount >= MAX_IMAGES
                ? 'بلغت حد الصور في هذه الحادثة.'
                : 'تبقّى مكان لصورة واحدة في هذه الحادثة.'}
            </small>
          )}
          {loading && <small role="status">جارٍ تجهيز المعاينة محليًا…</small>}
          {imageError && (
            <small role="alert" className="analyst-error">
              {imageError}
            </small>
          )}
          {image && (
            <div className="analyst-pending-image">
              <img src={image.dataUrl} alt="معاينة الصورة المختارة مؤقتًا" />
              <span>{image.name}</span>
              <button type="button" disabled={offlineSimulation} onClick={clearImage}>
                إزالة الصورة المختارة
              </button>
            </div>
          )}
        </div>
        <div className="workspace-note-actions">
          <small>حتى ٦٠٠ حرف و٥٠ ملاحظة · تصدير الدفتر اختياري، والصور مستبعدة افتراضيًا.</small>
          <Button
            type="button"
            icon={Plus}
            disabled={
              offlineSimulation ||
              !noteText.trim() ||
              loading ||
              tooManyRefs ||
              workspace.notes.length >= MAX_NOTES
            }
            onClick={addNote}
          >
            إضافة ملاحظة
          </Button>
        </div>
      </div>
      <NotebookExport
        incident={incident || { id: incidentId, title: 'تحقيق تجريبي' }}
        workspace={workspace}
      />
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </section>
  );
}
