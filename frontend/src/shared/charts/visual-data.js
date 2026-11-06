// سلسلة توضيحية ثابتة للواجهة فقط، وليست بيانات مراقبة أو قياسات فعلية.
// مجموع الفواصل يطابق ملخص لوحة المعلومات في كل فترة؛ اليوم الأخير في
// عرض الأسبوع يطابق مجموع عرض ٢٤ ساعة. سجل الأحداث المفصّل عينة أصغر.
const hours = [1180, 1310, 1520, 1730, 1860, 2210, 2480, 2690, 2570, 2410, 2550, 2346];
const hourAlerts = [1, 1, 1, 2, 2, 3, 3, 2, 3, 2, 2, 2];
const days = [18420, 21560, 19950, 22310, 24210, 25014, 24856];
const dayAlerts = [7, 10, 8, 12, 9, 13, 24];
const formatHour = n => String((n + 24) % 24).padStart(2, '0') + ':00';
// This independent fictional aggregate nests the final hour within the final
// two-hour bucket; it is not derived from the seven detailed event records.
const lastHourEvents = [165, 190, 183, 212, 195, 228],
  lastHourAlerts = [0, 0, 1, 0, 0, 0];
export const overviewSeries = {
  '1h': {
    periodName: 'فواصل عشر دقائق',
    axisMax: 300,
    severity: [0, 1, 0],
    points: lastHourEvents.map((events, i) => ({
      label: `09:${String(i * 10).padStart(2, '0')}–${i === 5 ? '10:00' : `09:${String((i + 1) * 10).padStart(2, '0')}`}`,
      short: `09:${String(i * 10).padStart(2, '0')}`,
      events,
      alerts: lastHourAlerts[i],
    })),
  },
  '24h': {
    periodName: 'فواصل ساعتين',
    axisMax: 3000,
    severity: [4, 8, 12],
    points: hours.map((events, i) => ({
      label: `${formatHour(10 + i * 2)}–${formatHour(12 + i * 2)}`,
      short: formatHour(10 + i * 2),
      events,
      alerts: hourAlerts[i],
    })),
  },
  '7d': {
    periodName: 'فواصل يومية',
    axisMax: 30000,
    severity: [12, 27, 44],
    points: days.map((events, i) => ({
      label: `اليوم ${i + 1}`,
      short: `${i + 1}`,
      events,
      alerts: dayAlerts[i],
    })),
  },
};
export const seriesTotal = (points, key) => points.reduce((sum, p) => sum + p[key], 0);
