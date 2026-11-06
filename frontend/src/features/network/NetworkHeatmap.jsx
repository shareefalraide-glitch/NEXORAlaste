import React, { useMemo, useRef, useState } from 'react';
import { Activity, ArrowLeft, Grid3X3 } from 'lucide-react';
import { networkHeatmap, bucketLabel, netInteger } from './network-data';
import { events } from '../../data/fixtures/demo-records';
import { localSampleTime } from '../../shared/lib/time-scope';
import { networkContext } from './network-context';
import { NOTE_TYPES } from '../investigations/notebook/notebook-model';
import { Button, Panel, Tag } from '../../shared/ui/index';

export default function NetworkHeatmap({ view, data, openDetail, investigations = {} }) {
  const rows = useMemo(() => networkHeatmap(view), [view]),
    [selected, setSelected] = useState(null),
    refs = useRef(new Map());
  const row = rows.find(item => item.id === selected?.id) || rows[0],
    index = Math.max(0, Math.min(row?.cells.length - 1 || 0, selected?.index ?? 0)),
    cell = row?.cells[index];
  const maximum = Math.max(1, ...rows.flatMap(item => item.cells.map(x => x.count))),
    asset = data.assets.find(item => item.id === row?.id);
  const context = useMemo(
    () =>
      networkContext({
        asset,
        assets: data.assets,
        alerts: data.alerts,
        incidents: data.incidents,
        events,
        start: cell?.start,
        seconds: cell?.seconds,
        investigations,
      }),
    [asset, data.assets, data.alerts, data.incidents, cell?.start, cell?.seconds, investigations],
  );
  const names = { incident: 'حادثة', alert: 'تنبيه', event: 'حدث' };
  const timeReasons = {
    inside: 'وقت السجل داخل الفاصل',
    before: 'وقت السجل قبل الفاصل',
    after: 'وقت السجل عند نهاية الفاصل أو بعدها',
    undated: 'وقت العينة غير متاح',
  };
  const assetReason = method => (method === 'id' ? 'معرّف الأصل' : 'اسم أصل فريد في العينة');
  const renderRecord = record => {
    const source = data.sources.find(item => item.id === record.item.sourceId);
    return (
      <li
        key={`${record.kind}:${record.item.id}`}
        data-asset-match={record.assetMatch}
        data-time-relation={record.timeRelation}
      >
        <div>
          <strong>
            {names[record.kind]} · <bdi dir="ltr">{record.item.id}</bdi>
          </strong>
          <small>
            {record.item.title || record.item.category} ·{' '}
            {record.time === null ? 'وقت عينة غير متاح / جلسة' : localSampleTime(record.time, true)}
          </small>
          <small className="network-match-reason">
            <b>سبب الظهور:</b> تطابق {assetReason(record.assetMatch)}{' '}
            <bdi dir="ltr">{record.assetMatch === 'id' ? asset?.id : asset?.name}</bdi> ·{' '}
            {timeReasons[record.timeRelation]}
          </small>
          {source && <small>مصدر البيانات في السجل: {source.name}</small>}
        </div>
        <div className="network-context-actions">
          <button
            type="button"
            aria-label={`فتح ${names[record.kind]} ${record.item.id} من سياق الشبكة`}
            onClick={() => openDetail(record.kind, record.item.id)}
          >
            فتح السجل <ArrowLeft size={13} />
          </button>
          {source && (
            <button
              type="button"
              aria-label={`فتح مصدر ${source.id} من ${record.item.id}`}
              onClick={() => openDetail('source', source.id)}
            >
              مصدر السجل
            </button>
          )}
        </div>
      </li>
    );
  };
  const choose = (id, i) => setSelected({ id, index: i });
  const move = (event, rowIndex, columnIndex) => {
    const delta = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }[
      event.key
    ];
    let r = rowIndex,
      c = columnIndex;
    if (delta) {
      r = Math.max(0, Math.min(rows.length - 1, r + delta[0]));
      c = Math.max(0, Math.min(row.cells.length - 1, c + delta[1]));
    } else if (event.key === 'Home') c = 0;
    else if (event.key === 'End') c = row.cells.length - 1;
    else return;
    event.preventDefault();
    const id = rows[r]?.id;
    if (!id) return;
    choose(id, c);
    requestAnimationFrame(() => refs.current.get(`${id}:${c}`)?.focus());
  };
  if (!row || !cell) return null;
  const describe = (id, i, value) => {
    const name = data.assets.find(x => x.id === id)?.name || id;
    return `${name}، ${bucketLabel(value.start, view.period)}، ${netInteger(value.count)} محاولة TCP تجريبية`;
  };
  return (
    <Panel className="network-heatmap-panel" aria-label="خريطة محاولات الشبكة الحرارية">
      <div className="network-panel-heading">
        <div>
          <span className="network-section-kicker">ASSET ACTIVITY / SYNTHETIC</span>
          <h2>الخريطة الحرارية للأصول والفترات</h2>
          <p>محاولات TCP تجريبية لكل أصل وفاصل؛ اختر خلية لاستكشافها.</p>
        </div>
        <span className="network-heading-icon">
          <Grid3X3 size={19} />
        </span>
      </div>
      <div className="heatmap-body">
        <div className="heatmap-legend">
          <span>
            <Activity size={15} /> كثافة المحاولات
          </span>
          <span>
            أقل <i />
            <i />
            <i />
            <i /> أعلى
          </span>
          <Tag>عينة مصطنعة</Tag>
        </div>
        <div
          className="heatmap-table"
          role="group"
          aria-label="مصفوفة الأصول والفترات"
          style={{ '--heat-columns': row.cells.length }}
        >
          <div className="heatmap-corner">الأصل</div>
          {row.cells.map((item, i) => (
            <div
              className="heatmap-time"
              key={item.start}
              title={bucketLabel(item.start, view.period)}
            >
              {i % Math.ceil(row.cells.length / 6) === 0
                ? bucketLabel(item.start, view.period)
                : ''}
            </div>
          ))}
          {rows.map((item, r) => (
            <React.Fragment key={item.id}>
              <div className="heatmap-row-name" dir="ltr">
                {data.assets.find(x => x.id === item.id)?.name || item.id}
              </div>
              {item.cells.map((value, i) => {
                const active = row.id === item.id && index === i,
                  level = Math.max(0.12, 0.12 + (value.count / maximum) * 0.72);
                return (
                  <button
                    type="button"
                    key={`${item.id}:${value.start}`}
                    ref={el => {
                      const key = `${item.id}:${i}`;
                      if (el) refs.current.set(key, el);
                      else refs.current.delete(key);
                    }}
                    className={`heatmap-cell ${active ? 'selected' : ''}`}
                    aria-label={describe(item.id, i, value)}
                    aria-pressed={active}
                    tabIndex={active ? 0 : -1}
                    style={{ '--heat-opacity': level }}
                    onClick={() => choose(item.id, i)}
                    onFocus={() => choose(item.id, i)}
                    onKeyDown={event => move(event, r, i)}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="heatmap-mobile">
          <label>
            الأصل
            <select
              aria-label="أصل الخريطة الحرارية"
              value={row.id}
              onChange={event => choose(event.target.value, 0)}
            >
              {rows.map(item => (
                <option key={item.id} value={item.id}>
                  {data.assets.find(x => x.id === item.id)?.name || item.id}
                </option>
              ))}
            </select>
          </label>
          <div className="heatmap-mobile-cells" role="group" aria-label="فواصل الأصل المختار">
            {row.cells.map((value, i) => (
              <button
                type="button"
                key={value.start}
                aria-label={describe(row.id, i, value)}
                aria-pressed={index === i}
                onClick={() => choose(row.id, i)}
              >
                <small dir="ltr">{bucketLabel(value.start, view.period)}</small>
                <strong>{netInteger(value.count)}</strong>
              </button>
            ))}
          </div>
        </div>
        <div className="heatmap-selection" aria-live="polite">
          <div>
            <span>
              الفاصل المحدد · <bdi dir="ltr">{bucketLabel(cell.start, view.period)}</bdi>
            </span>
            <strong>
              {asset?.name || row.id} · {netInteger(cell.count)} محاولة
            </strong>
            <small>عينة مستقلة حسب الفترة والاتجاه؛ ليس عدد الاتصالات النشطة.</small>
          </div>
          <Button
            type="button"
            icon={ArrowLeft}
            disabled={!asset}
            onClick={() => asset && openDetail('asset', asset.id)}
          >
            فتح الأصل
          </Button>
        </div>
        <section className="network-context" aria-label="سياق الأصل والفاصل">
          <div className="network-context-heading">
            <div>
              <strong>سياق الأصل والفاصل المحدد</strong>
              <small>
                <bdi dir="ltr">{localSampleTime(cell.start, true)}</bdi> إلى أقل من{' '}
                <bdi dir="ltr">{localSampleTime(cell.start + cell.seconds * 1000, true)}</bdi>
              </small>
            </div>
            <Tag color="blue">مطابقة حقول فقط</Tag>
          </div>
          <p>
            سجلات مستقلة تطابق الأصل ووقت الفاصل. هذا الترشيح لا يثبت أن السجل جزء من محاولات الخلية
            أو سبب لها.
          </p>
          <div className="network-context-subhead">
            <strong>سجلات ضمن الفاصل</strong>
            <Tag>{netInteger(context.inside.length)}</Tag>
          </div>
          {context.inside.length ? (
            <ul>{context.inside.map(renderRecord)}</ul>
          ) : (
            <p className="network-context-empty">
              لا توجد سجلات مفصّلة تطابق الأصل والفاصل في العينة.
            </p>
          )}
          {context.outside.length > 0 && (
            <details>
              <summary>
                سجلات الأصل خارج الفاصل أو بلا وقت عينة ({netInteger(context.outside.length)})
              </summary>
              <ul>{context.outside.map(renderRecord)}</ul>
            </details>
          )}
          <details className="network-session-notes">
            <summary>ملاحظات الجلسة لحوادث الأصل ({netInteger(context.notes.length)})</summary>
            <p>ملاحظات كتبها المحلل؛ لا تُرشّح بوقت الفاصل ولا تثبت ارتباطًا بمحاولات الشبكة.</p>
            {context.notes.length ? (
              <ul>
                {context.notes.map(({ incident, note, assetMatch }) => (
                  <li key={`${incident.id}:${note.id}`}>
                    <div>
                      <strong>
                        {NOTE_TYPES[note.type] || 'ملاحظة'} · <bdi dir="ltr">{incident.id}</bdi>
                      </strong>
                      <small>{note.text}</small>
                      <small className="network-match-reason">
                        <b>سبب الظهور:</b> ملاحظة جلسة لحادثة تطابق {assetReason(assetMatch)}؛ لا
                        تُرشّح بوقت الفاصل.
                      </small>
                    </div>
                    <button
                      type="button"
                      aria-label={`فتح حادثة الملاحظة ${incident.id}`}
                      onClick={() => openDetail('incident', incident.id)}
                    >
                      فتح الحادثة <ArrowLeft size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="network-context-empty">لا توجد ملاحظات جلسة لحوادث هذا الأصل.</p>
            )}
          </details>
        </section>
        <p className="network-footnote">
          بيانات أصل×وقت مصطنعة ومستقلة عن إجماليات الشبكة؛ لا تُستنتج منها ولا تمثل شبكة فعلية. لا
          تكتشف أجهزة أو هجومًا، ولا تتغير مع محاكاة زيادة النقل.
        </p>
      </div>
    </Panel>
  );
}
