import React, { useState } from 'react';
import { Columns2, FolderOpen, Layers3, Pin, PinOff, Plus, X } from 'lucide-react';
import { ar } from '../../../shared/ui/index';
import { MAX_INVESTIGATION_TABS } from './investigation-tabs';

// A contextual control within the existing drawer/incident page, not a
// second navigation menu. Switching restores the whole case breadcrumb.
export default function InvestigationTabs({
  workspace,
  incidents,
  onOpen,
  onSwitch,
  onPin,
  onRemove,
  onSplit,
  shelf = false,
}) {
  const [selected, setSelected] = useState(''),
    [compare, setCompare] = useState('');
  const { tabs, activeId } = workspace;
  if (!tabs.length) return null;
  const candidates = incidents.filter(incident => !tabs.some(tab => tab.id === incident.id));
  const chosen = candidates.some(item => item.id === selected) ? selected : candidates[0]?.id || '';
  return (
    <section
      className={`investigation-tabs ${shelf ? 'investigation-shelf' : ''}`}
      aria-label={shelf ? 'استعادة تحقيقات الجلسة' : 'تحقيقات الجلسة المفتوحة'}
    >
      <div className="investigation-tabs-heading">
        <div>
          <span>
            <Layers3 size={15} />
            {shelf ? 'تحقيقات هذه الجلسة' : 'مساحة التحقيقات'}
          </span>
          <small>
            {shelf
              ? 'استعد مسار الحادثة والمسوّدات من حيث توقفت.'
              : 'الجلسة فقط · اسحب أو استخدم لوحة المفاتيح للتبديل.'}
          </small>
        </div>
        <b>
          {ar(tabs.length)} / {ar(MAX_INVESTIGATION_TABS)}
        </b>
      </div>
      <div
        className="investigation-tab-list"
        role="group"
        aria-label="التحقيقات المحفوظة في الجلسة"
      >
        {tabs.map(tab => {
          const item = incidents.find(incident => incident.id === tab.id),
            active = activeId === tab.id;
          return (
            <div
              key={tab.id}
              className={`investigation-tab ${active ? 'is-active' : ''} ${tab.pinned ? 'is-pinned' : ''}`}
            >
              <button
                type="button"
                className="investigation-tab-select"
                aria-pressed={active}
                aria-label={`استعادة تحقيق ${tab.id}`}
                title={item?.title || tab.id}
                onClick={() => onSwitch(tab.id)}
              >
                <FolderOpen size={14} />
                <bdi dir="ltr">{tab.id}</bdi>
              </button>
              <button
                type="button"
                className="investigation-tab-icon"
                aria-pressed={tab.pinned}
                aria-label={`${tab.pinned ? 'إلغاء تثبيت' : 'تثبيت'} تحقيق ${tab.id}`}
                title={tab.pinned ? 'إلغاء التثبيت' : 'تثبيت التحقيق'}
                onClick={() => onPin(tab.id)}
              >
                {tab.pinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
              <button
                type="button"
                className="investigation-tab-icon"
                aria-label={`إزالة تبويب تحقيق ${tab.id}`}
                title="إزالة التبويب"
                onClick={() => onRemove(tab.id)}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
      {!shelf && tabs.length >= 2 && activeId && onSplit && (
        <div className="investigation-split-launch">
          <label>
            المقارنة مع{' '}
            <select
              aria-label="اختيار التحقيق الثاني للعرض المنقسم"
              value={
                tabs.some(tab => tab.id === compare && tab.id !== activeId)
                  ? compare
                  : tabs.find(tab => tab.id !== activeId)?.id || ''
              }
              onChange={event => setCompare(event.target.value)}
            >
              {tabs
                .filter(tab => tab.id !== activeId)
                .map(tab => (
                  <option value={tab.id} key={tab.id}>
                    {tab.id} · {incidents.find(item => item.id === tab.id)?.title || 'حادثة'}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            className="investigation-add-button"
            onClick={() =>
              onSplit(
                activeId,
                tabs.some(tab => tab.id === compare && tab.id !== activeId)
                  ? compare
                  : tabs.find(tab => tab.id !== activeId)?.id,
              )
            }
          >
            <Columns2 size={15} /> عرض تحقيقين
          </button>
        </div>
      )}
      {!shelf && (
        <details className="investigation-tab-add">
          <summary>
            <Plus size={14} /> فتح تحقيق آخر
          </summary>
          <div>
            <label>
              الحادثة المتاحة{' '}
              <select
                aria-label="اختيار حادثة لفتح تحقيق آخر"
                value={chosen}
                onChange={event => setSelected(event.target.value)}
                disabled={!candidates.length || tabs.length >= MAX_INVESTIGATION_TABS}
              >
                {!candidates.length ? (
                  <option value="">لا توجد حوادث إضافية</option>
                ) : (
                  candidates.map(item => (
                    <option value={item.id} key={item.id}>
                      {item.id} · {item.title}
                    </option>
                  ))
                )}
              </select>
            </label>
            <button
              type="button"
              className="investigation-add-button"
              disabled={!chosen || tabs.length >= MAX_INVESTIGATION_TABS}
              onClick={() => onOpen('incident', chosen)}
            >
              فتح التحقيق
            </button>
          </div>
          {tabs.length >= MAX_INVESTIGATION_TABS && <small>أزل تبويبًا قبل فتح آخر.</small>}
        </details>
      )}
      {shelf && (
        <p className="investigation-tabs-foot">
          تبويبات ومسودات مؤقتة؛ تُمسح عند التحديث أو تسجيل الخروج. إزالة التبويب لا تحذف ملاحظات
          الحادثة من الجلسة.
        </p>
      )}
    </section>
  );
}
