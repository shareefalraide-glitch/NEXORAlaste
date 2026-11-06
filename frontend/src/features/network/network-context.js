import { recordBelongsToAsset } from '../assets/asset-relations.js';
import { recordTime } from '../../shared/lib/time-scope.js';

// The reason is based only on the same stable-ID / unique-name rule used by
// recordBelongsToAsset and on an explicitly half-open sample-time interval.
// It never implies the independent heatmap generated or caused a record.
export const assetMatchMethod = record => (record?.assetId ? 'id' : 'unique-name');
export function intervalRelation(time, start, end) {
  if (time === null || !Number.isFinite(time)) return 'undated';
  if (time < start) return 'before';
  if (time >= end) return 'after';
  return 'inside';
}
export function networkContext({
  asset,
  assets,
  alerts,
  incidents,
  events,
  start,
  seconds,
  investigations = {},
}) {
  if (!asset || !Number.isFinite(start) || !Number.isFinite(seconds) || seconds <= 0)
    return { inside: [], outside: [], notes: [] };
  const end = start + seconds * 1000;
  if (!Number.isFinite(end)) return { inside: [], outside: [], notes: [] };
  const incidentRows = (incidents || []).filter(item => recordBelongsToAsset(assets, item, asset));
  const rows = [
    ...incidentRows.map(item => ({ kind: 'incident', item })),
    ...(alerts || [])
      .filter(item => recordBelongsToAsset(assets, item, asset))
      .map(item => ({ kind: 'alert', item })),
    ...(events || [])
      .filter(item => recordBelongsToAsset(assets, item, asset))
      .map(item => ({ kind: 'event', item })),
  ].map(row => {
    const time =
      row.kind === 'incident' && String(row.item.id).startsWith('INC-DEMO-')
        ? null
        : recordTime(row.item, row.kind);
    return {
      ...row,
      time,
      assetMatch: assetMatchMethod(row.item),
      timeRelation: intervalRelation(time, start, end),
    };
  });
  const inside = rows.filter(row => row.timeRelation === 'inside').sort((a, b) => b.time - a.time);
  const outside = rows
    .filter(row => row.timeRelation !== 'inside')
    .sort((a, b) => (b.time ?? -Infinity) - (a.time ?? -Infinity));
  const notes = incidentRows.flatMap(incident =>
    (investigations[incident.id]?.notes || []).map(note => ({
      incident,
      note,
      assetMatch: assetMatchMethod(incident),
    })),
  );
  return { inside, outside, notes };
}
