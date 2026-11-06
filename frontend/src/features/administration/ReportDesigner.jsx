import React, { useState } from 'react';
import { ArrowDown, ArrowUp, FileBarChart2, Download } from 'lucide-react';
import { events } from '../../data/fixtures/demo-records';
import { PERIOD_LABELS, inPeriod } from '../../shared/lib/time-scope';
import { ar, Button, InfoBox, Tag } from '../../shared/ui/index';

const sections = [
  ['summary', 'الملخص'],
  ['incidents', 'الحوادث المفصّلة'],
  ['alerts', 'التنبيهات المفصّلة'],
  ['events', 'الأحداث المفصّلة'],
  ['assets', 'الأصول · لقطة ثابتة'],
];
const columns = [
  { id: 'section', label: 'القسم', value: x => x.section },
  { id: 'id', label: 'المعرّف', value: x => x.id || '—' },
  { id: 'description', label: 'الوصف', value: x => x.description },
  { id: 'status', label: 'الحالة', value: x => x.status || '—' },
];
export default function ReportDesigner({ data, timeRange = '24h', exportData }) {
  const [title, setTitle] = useState('تقرير العمليات الأمنية'),
    [selected, setSelected] = useState(['summary', 'incidents', 'alerts']),
    [order, setOrder] = useState(sections.map(([id]) => id));
  const inc = data.incidents.filter(x =>
      inPeriod(x, 'incident', timeRange, { includeUndated: false }),
    ),
    alerts = data.alerts.filter(x => inPeriod(x, 'alert', timeRange, { includeUndated: false })),
    ev = events.filter(x => inPeriod(x, 'event', timeRange, { includeUndated: false }));
  const toggle = id =>
    setSelected(items => (items.includes(id) ? items.filter(x => x !== id) : [...items, id]));
  const move = (id, delta) =>
    setOrder(items => {
      const list = [...items],
        index = list.indexOf(id),
        to = index + delta;
      if (to < 0 || to >= list.length) return items;
      [list[index], list[to]] = [list[to], list[index]];
      return list;
    });
  const sectionRows = {
    summary: [
      {
        section: 'الملخص',
        description: `${inc.length} حادثة · ${alerts.length} تنبيه · ${ev.length} حدث مفصّل`,
      },
    ],
    incidents: inc.map(x => ({
      section: 'حادثة',
      id: x.id,
      description: x.title,
      status: x.status,
    })),
    alerts: alerts.map(x => ({
      section: 'تنبيه',
      id: x.id,
      description: x.title,
      status: x.status,
    })),
    events: ev.map(x => ({ section: 'حدث', id: x.id, description: x.category, status: x.outcome })),
    assets: data.assets.map(x => ({
      section: 'أصل · لقطة ثابتة',
      id: x.id,
      description: x.name,
      status: x.baseline,
    })),
  };
  const rows = order.filter(id => selected.includes(id)).flatMap(id => sectionRows[id]);
  const preview = {
    summary: (
      <section>
        <strong>الملخص</strong>
        <p>
          {ar(inc.length)} حادثة · {ar(alerts.length)} تنبيه · {ar(ev.length)} حدث مفصّل
        </p>
      </section>
    ),
    incidents: (
      <section>
        <strong>الحوادث المفصّلة · {ar(inc.length)}</strong>
        {inc.slice(0, 3).map(x => (
          <p key={x.id}>
            {x.title} · <bdi dir="ltr">{x.id}</bdi>
          </p>
        ))}
      </section>
    ),
    alerts: (
      <section>
        <strong>التنبيهات المفصّلة · {ar(alerts.length)}</strong>
        {alerts.slice(0, 3).map(x => (
          <p key={x.id}>
            {x.title} · <bdi dir="ltr">{x.id}</bdi>
          </p>
        ))}
      </section>
    ),
    events: (
      <section>
        <strong>الأحداث المفصّلة · {ar(ev.length)}</strong>
        {ev.slice(0, 3).map(x => (
          <p key={x.id}>
            {x.category} · <bdi dir="ltr">{x.id}</bdi>
          </p>
        ))}
      </section>
    ),
    assets: (
      <section>
        <strong>الأصول · {ar(data.assets.length)} أصل</strong>
        <p>لقطة ثابتة لا تتأثر بالفترة.</p>
      </section>
    ),
  };
  return (
    <details className="experience-module report-designer">
      <summary>
        <span>
          <span className="experience-module-icon">
            <FileBarChart2 size={19} />
          </span>
          <span>
            <strong>مصمم تقرير مبسّط</strong>
            <small>اختر الأقسام ورتّبها وعاين عينة مترابطة</small>
          </span>
        </span>
        <Tag color="blue">محلي</Tag>
      </summary>
      <div className="experience-module-body">
        <InfoBox>
          المعاينة والتصدير يعتمدان على السجلات المفصّلة المحدودة في العينة، وليس على إجماليات رسم
          النظرة العامة. الأصول لقطة ثابتة.
        </InfoBox>
        <div className="designer-layout">
          <div>
            <label className="experience-field">
              عنوان التقرير
              <input
                aria-label="عنوان التقرير المخصص"
                value={title}
                maxLength={80}
                onChange={e => setTitle(e.target.value)}
              />
            </label>
            <fieldset className="designer-sections">
              <legend>الأقسام وترتيبها</legend>
              {order.map((id, index) => {
                const label = sections.find(s => s[0] === id)[1];
                return (
                  <div className="designer-section-row" key={id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.includes(id)}
                        onChange={() => toggle(id)}
                      />
                      {label}
                    </label>
                    <span>
                      <button
                        type="button"
                        disabled={index === 0}
                        aria-label={`تقديم قسم ${label}`}
                        onClick={() => move(id, -1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={index === order.length - 1}
                        aria-label={`تأخير قسم ${label}`}
                        onClick={() => move(id, 1)}
                      >
                        <ArrowDown size={14} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </fieldset>
            <Button
              type="button"
              icon={Download}
              disabled={!rows.length}
              onClick={() =>
                exportData(title.trim() || 'تقرير مخصص', rows, {
                  columns,
                  visibleColumns: columns.map(x => x.id),
                })
              }
            >
              تصدير بيانات المعاينة CSV
            </Button>
            <p className="experience-footnote">
              اختيار الأقسام والترتيب والعنوان مؤقت لهذه الصفحة ولا ينشئ تقريرًا على خادم.
            </p>
          </div>
          <div className="designer-preview" role="group" aria-label="معاينة التقرير المخصص">
            <div>
              <span>NEXORA / UI DEMO</span>
              <h2>{title || 'تقرير دون عنوان'}</h2>
              <small>{PERIOD_LABELS[timeRange]} · حتى 29 OCT 2026 10:00 UTC+03</small>
            </div>
            {order
              .filter(id => selected.includes(id))
              .map(id => (
                <React.Fragment key={id}>{preview[id]}</React.Fragment>
              ))}
            {!selected.length && <p>اختر قسمًا لعرض المعاينة.</p>}
            <small>
              للعرض التجريبي فقط · قد تعرض المعاينة أول ثلاثة سجلات من كل قسم، بينما يتضمن CSV كل
              السجلات المختارة بالترتيب نفسه.
            </small>
          </div>
        </div>
      </div>
    </details>
  );
}
