// All timestamps and filters in this file belong to a fixed, fictional UI sample.
// A source/asset inventory or a current status without a timestamp is a snapshot,
// not an empty time series. Never turn an unknown timestamp into a real one.
export const SAMPLE_END_UTC = Date.parse('2026-10-29T07:00:00Z'); // 10:00 UTC+03
export const PERIOD_HOURS = Object.freeze({ '1h': 1, '24h': 24, '7d': 168 });
export const PERIOD_LABELS = Object.freeze({
  '1h': 'آخر ساعة',
  '24h': 'آخر ٢٤ ساعة',
  '7d': 'آخر ٧ أيام',
});

// The original incident fixture carries an Arabic date and a clock time; alerts
// in this fixture are explicitly from 29 October. These rules do not apply to
// imported or unknown records. Session-created records provide sampleTime.
export function recordTime(record, kind) {
  if (!record) return null;
  const explicit = record.utc || record.sampleTime;
  if (explicit) {
    const t = typeof explicit === 'number' ? explicit : Date.parse(explicit);
    return Number.isFinite(t) ? t : null;
  }
  const clock = /^([0-2]\d):([0-5]\d)$/.exec(String(record.time || ''));
  if (!clock || Number(clock[1]) > 23) return null;
  let day;
  if (kind === 'alert' && /^ALT-\d+$/.test(record.id || '')) day = '2026-10-29';
  if (kind === 'incident' && String(record.date || '').includes('٢٨ أكتوبر ٢٠٢٦'))
    day = '2026-10-28';
  if (kind === 'incident' && String(record.date || '').includes('٢٩ أكتوبر ٢٠٢٦'))
    day = '2026-10-29';
  if (!day) return null;
  const value = Date.parse(`${day}T${clock[1]}:${clock[2]}:00+03:00`);
  return Number.isFinite(value) ? value : null;
}
export function inPeriod(record, kind, period = '24h', { includeUndated = true } = {}) {
  const t = recordTime(record, kind);
  if (t === null) return includeUndated;
  const hours = PERIOD_HOURS[period] ?? 24;
  return t >= SAMPLE_END_UTC - hours * 3600000 && t <= SAMPLE_END_UTC;
}
export function inHours(record, kind, hours, { includeUndated = false } = {}) {
  const t = recordTime(record, kind);
  return t === null ? includeUndated : t >= SAMPLE_END_UTC - hours * 3600000 && t <= SAMPLE_END_UTC;
}
export function sampleAgeHours(record, kind) {
  const t = recordTime(record, kind);
  return t === null ? null : (SAMPLE_END_UTC - t) / 3600000;
}
export function localSampleTime(timestamp, withDate = false) {
  if (!Number.isFinite(timestamp)) return 'وقت غير متاح';
  const d = new Date(timestamp + 3 * 3600000),
    pad = n => String(n).padStart(2, '0');
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return withDate
    ? `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${time} UTC+03`
    : time;
}
// Human-readable age is measured from the same fixed sample endpoint, never
// the viewer's real clock. It avoids the stale relative strings in older fixtures.
export function relativeSampleTime(record, kind) {
  const t = recordTime(record, kind);
  if (t === null) return 'وقت غير متاح';
  const minutes = Math.max(0, Math.floor((SAMPLE_END_UTC - t) / 60000));
  if (minutes === 0) return 'الآن · عينة';
  const n = new Intl.NumberFormat('ar-EG');
  if (minutes < 60)
    return minutes === 1 ? 'منذ دقيقة في العينة' : `منذ ${n.format(minutes)} دقيقة في العينة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return hours === 1 ? 'منذ ساعة في العينة' : `منذ ${n.format(hours)} ساعات في العينة`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'منذ يوم في العينة' : `منذ ${n.format(days)} أيام في العينة`;
}
