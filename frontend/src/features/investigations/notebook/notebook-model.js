// A small text-only format; user input is never treated as HTML.
export const NOTE_TYPES = {
  observation: 'ملاحظة',
  hypothesis: 'فرضية غير مثبتة',
  question: 'سؤال يحتاج إجابة',
  conclusion: 'استنتاج المحلل',
};
export const NOTE_SECTIONS = [
  ['general', 'السياق والملاحظات'],
  ['analysis', 'التحليل والفرضيات'],
  ['followup', 'المتابعة والأسئلة'],
];
// Shared wording and image alternative keep the preview, print, and HTML
// consistent without ever interpreting analyst text as markup.
export const NOTEBOOK_BRAND = 'NEXORA / INVESTIGATION NOTEBOOK · DEMO';
export const NOTEBOOK_FOOTER =
  'عينة توضيحية وملاحظات كتبها المحلل خلال الجلسة. ليست أدلة أو سجل تدقيق أو إثبات اتصال. لا يوجد إرسال إلى خادم.';
export const NOTEBOOK_REFERENCES = 'مراجع مختارة';
export const notebookImageAlt = image => `صورة محلية: ${image?.name || 'مرفق'}`;
export const sectionId = value => (NOTE_SECTIONS.some(([id]) => id === value) ? value : 'general');
export const noteSection = value => NOTE_SECTIONS.find(([id]) => id === sectionId(value))[1];
export const noteReferences = note =>
  Array.isArray(note.links) ? note.links : note.link ? [note.link] : [];
export const validImage = img =>
  !!img &&
  typeof img.dataUrl === 'string' &&
  img.dataUrl.length <= 1500000 &&
  /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(img.dataUrl);
export const escapeHtml = value =>
  String(value ?? '').replace(
    /[&<>"']/g,
    char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
export function parseNote(text) {
  const groups = [];
  for (const line of String(text || '').split('\n')) {
    const heading = /^#\s+(.+)$/.exec(line),
      bullet = /^-\s+(.+)$/.exec(line);
    if (heading) groups.push({ type: 'heading', text: heading[1] });
    else if (bullet) {
      const last = groups.at(-1);
      if (last?.type === 'list') last.items.push(bullet[1]);
      else groups.push({ type: 'list', items: [bullet[1]] });
    } else groups.push({ type: 'line', text: line });
  }
  return groups;
}
function noteHtml(text) {
  return parseNote(text)
    .map(group =>
      group.type === 'heading'
        ? `<strong class="line-heading">${escapeHtml(group.text)}</strong>`
        : group.type === 'list'
          ? `<ul>${group.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
          : `<p>${group.text ? escapeHtml(group.text) : '&nbsp;'}</p>`,
    )
    .join('');
}
export function notebookSelection(workspace, options) {
  const sections = Array.isArray(options.sections)
    ? options.sections
    : NOTE_SECTIONS.map(x => x[0]);
  return {
    summary: options.summary ? String(workspace.summary || '').trim() : '',
    tasks: options.tasks ? workspace.tasks || [] : [],
    notes: options.notes
      ? (workspace.notes || []).filter(note => sections.includes(sectionId(note.section)))
      : [],
  };
}
export function buildNotebookExport(incident, workspace, options) {
  const selected = notebookSelection(workspace, options),
    name = String(incident?.title || 'تحقيق تجريبي'),
    id = String(incident?.id || '');
  const parts = [
    `NEXORA · دفتر التحقيق`,
    `${id} · ${name}`,
    'بيانات تجريبية وملاحظات جلسة، وليست أدلة أو سجل تدقيق.',
  ];
  if (options.summary)
    parts.push(`\nالملخص الذي كتبه المحلل\n${selected.summary || 'لم يُكتب ملخص.'}`);
  if (options.tasks)
    parts.push(
      `\nقائمة التحقق\n${selected.tasks.length ? selected.tasks.map(task => `${task.done ? '[✓]' : '[ ]'} ${task.text}`).join('\n') : 'لا توجد مهام.'}`,
    );
  if (options.notes)
    for (const [section, label] of NOTE_SECTIONS) {
      const group = selected.notes.filter(note => sectionId(note.section) === section);
      if (group.length)
        parts.push(
          `\n${label}\n` +
            group
              .map(
                note =>
                  `${NOTE_TYPES[note.type] || NOTE_TYPES.observation}: ${note.text}${
                    noteReferences(note).length
                      ? '\nمراجع مختارة: ' +
                        noteReferences(note)
                          .map(ref => ref.label || ref.id)
                          .join('، ')
                      : ''
                  }${options.images && validImage(note.image) ? `\n[صورة محلية مرفقة: ${note.image.name || 'صورة'}]` : ''}`,
              )
              .join('\n\n'),
        );
    }
  const refs = note =>
    noteReferences(note)
      .map(ref => escapeHtml(ref.label || ref.id))
      .join('، ');
  const notes = NOTE_SECTIONS.map(([section, label]) => {
    const group = selected.notes.filter(note => sectionId(note.section) === section);
    if (!group.length) return '';
    return `<section><h2>${escapeHtml(label)}</h2>${group.map(note => `<article><small>${escapeHtml(NOTE_TYPES[note.type] || NOTE_TYPES.observation)}</small><div class="formatted">${noteHtml(note.text)}</div>${refs(note) ? `<p class="refs">${NOTEBOOK_REFERENCES}: ${refs(note)}</p>` : ''}${options.images && validImage(note.image) ? `<img src="${escapeHtml(note.image.dataUrl)}" alt="${escapeHtml(notebookImageAlt(note.image))}">` : ''}</article>`).join('')}</section>`;
  }).join('');
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>دفتر التحقيق ${escapeHtml(id)}</title><style>body{font-family:Arial,sans-serif;color:#17202d;background:#f3f6f8;margin:0;padding:32px;line-height:1.8}main{max-width:880px;margin:auto;background:#fff;border:1px solid #d9e3e8;border-radius:12px;padding:34px}header{border-bottom:2px solid #087f8c;padding-bottom:16px}header small{color:#087f8c;font-weight:700}h1{margin:5px 0;font-size:24px}h2{font-size:18px;color:#075e69;margin:22px 0 8px}p{margin:5px 0;white-space:pre-wrap;overflow-wrap:anywhere}article{border:1px solid #d9e3e8;border-radius:8px;padding:14px;margin:8px 0;break-inside:avoid}article small{color:#075e69;font-weight:bold}.line-heading{display:block;margin:8px 0}.formatted ul{margin:4px 0;padding-right:22px}.refs,footer{color:#4c5e67;font-size:12px}img{max-width:100%;max-height:330px;object-fit:contain}footer{margin-top:22px;border-top:1px solid #d9e3e8;padding-top:12px}@media print{@page{margin:14mm;background:#fff}:root{color-scheme:light}body{background:#fff;padding:0}main{max-width:none;border:0;padding:0}}</style></head><body><main><header><small>${escapeHtml(NOTEBOOK_BRAND)}</small><h1>دفتر التحقيق</h1><p>${escapeHtml(name)} · <bdi dir="ltr">${escapeHtml(id)}</bdi></p></header>${options.summary ? `<section><h2>الملخص الذي كتبه المحلل</h2><p>${escapeHtml(selected.summary || 'لم يُكتب ملخص.')}</p></section>` : ''}${options.tasks ? `<section><h2>قائمة التحقق</h2>${selected.tasks.length ? `<ul>${selected.tasks.map(task => `<li>${task.done ? '✓' : '□'} ${escapeHtml(task.text)}</li>`).join('')}</ul>` : '<p>لا توجد مهام.</p>'}</section>` : ''}${options.notes ? notes : ''}<footer>${escapeHtml(NOTEBOOK_FOOTER)}</footer></main></body></html>`;
  return { html, text: parts.join('\n'), selected };
}
