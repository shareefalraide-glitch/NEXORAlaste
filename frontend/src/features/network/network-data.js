/**
 * Synthetic, deterministic network-visibility fixture for the UI prototype.
 * It does not ingest packets, resolve addresses, call Geo-IP or use event logs.
 * A fixed five-minute series makes the displayed averages internally consistent
 * and keeps the demo reproducible offline. The geography fixture is deliberately
 * independent of IP addresses and the traffic/asset counters.
 */
import { SAMPLE_END_UTC } from '../../shared/lib/time-scope.js';
export { SAMPLE_END_UTC };
export const SAMPLE_STEP_SECONDS = 300;
// Local UI illustration only; these numbers are not a detection policy.
export const NETWORK_BASELINE = Object.freeze({
  lookbackSamples: 24,
  alertFactor: 1.25,
  spikeFactor: 1.65,
  spikeSamples: 144,
});
export const NETWORK_PERIODS = {
  '1h': { label: 'ساعة من العينة', samples: 12, bucket: 1 },
  '24h': { label: '٢٤ ساعة من العينة', samples: 288, bucket: 24 },
  '7d': { label: '٧ أيام من العينة', samples: 2016, bucket: 144 },
};
const fields = [
  'bytesIn',
  'bytesOut',
  'packetsIn',
  'packetsOut',
  'attemptsIn',
  'attemptsOut',
  'incompleteIn',
  'incompleteOut',
  'resetsIn',
  'resetsOut',
  'completedIn',
  'completedOut',
  'baselineBytesIn',
  'baselineBytesOut',
];
const pulse = (i, a, b) => (Math.sin(i / a + b) + 1) / 2;
const SAMPLE = Array.from({ length: 2016 }, (_, i) => {
  const daily = pulse(i, 45, 0.2),
    short = pulse(i, 9, 1.2),
    wave = pulse(i, 84, -1.3);
  const packetsIn = Math.round((67000 + 16000 * daily + 7000 * short) * SAMPLE_STEP_SECONDS);
  const packetsOut = Math.round((43000 + 13000 * wave + 6000 * short) * SAMPLE_STEP_SECONDS);
  const bytesIn = packetsIn * Math.round(770 + 95 * wave + 45 * short);
  const bytesOut = packetsOut * Math.round(700 + 100 * daily + 40 * short);
  const attemptsIn = Math.round((7.1 + 2.1 * daily + 0.8 * short) * SAMPLE_STEP_SECONDS);
  const attemptsOut = Math.round((11.2 + 3.1 * wave + 1.1 * short) * SAMPLE_STEP_SECONDS);
  const incompleteIn = Math.round(attemptsIn * (0.018 + 0.009 * wave));
  const incompleteOut = Math.round(attemptsOut * (0.012 + 0.008 * daily));
  return {
    start: SAMPLE_END_UTC - (2016 - i) * SAMPLE_STEP_SECONDS * 1000,
    bytesIn,
    bytesOut,
    packetsIn,
    packetsOut,
    attemptsIn,
    attemptsOut,
    incompleteIn,
    incompleteOut,
    resetsIn: Math.round(incompleteIn * 0.38),
    resetsOut: Math.round(incompleteOut * 0.35),
    completedIn: attemptsIn - incompleteIn,
    completedOut: attemptsOut - incompleteOut,
    // Concurrent established TCP sessions at the end of this sample, not a total.
    activeIn: Math.round(3400 + 900 * daily + 320 * short),
    activeOut: Math.round(7200 + 1600 * wave + 480 * short),
  };
});

// Each reference is the simple mean of up to 24 preceding five-minute normal
// sample values. It is an invented visual comparison, not learned telemetry.
// The first value has no preceding sample and uses itself as a seed. Baseline
// stays unchanged when a user explicitly enables the 12-hour spike scenario.
const REFERENCE = SAMPLE.map((sample, i) => {
  const before = SAMPLE.slice(Math.max(0, i - NETWORK_BASELINE.lookbackSamples), i);
  const prior = before.length ? before : [sample];
  return {
    baselineBytesIn: prior.reduce((n, x) => n + x.bytesIn, 0) / prior.length,
    baselineBytesOut: prior.reduce((n, x) => n + x.bytesOut, 0) / prior.length,
  };
});
const NORMAL_SAMPLE = SAMPLE.map((sample, i) => ({ ...sample, ...REFERENCE[i] }));
const SPIKE_SAMPLE = NORMAL_SAMPLE.map((sample, i) => {
  if (i < SAMPLE.length - NETWORK_BASELINE.spikeSamples) return sample;
  const f = NETWORK_BASELINE.spikeFactor;
  return {
    ...sample,
    bytesIn: Math.round(sample.bytesIn * f),
    bytesOut: Math.round(sample.bytesOut * f),
    packetsIn: Math.round(sample.packetsIn * f),
    packetsOut: Math.round(sample.packetsOut * f),
  };
});

const sum = (samples, key) => samples.reduce((total, s) => total + s[key], 0);
const aggregate = samples => Object.fromEntries(fields.map(key => [key, sum(samples, key)]));
const choose = (obj, stem, direction) =>
  direction === 'in'
    ? obj[`${stem}In`]
    : direction === 'out'
      ? obj[`${stem}Out`]
      : obj[`${stem}In`] + obj[`${stem}Out`];
const combineWeighted = (inValue, outValue, inWeight, outWeight, direction) =>
  direction === 'in'
    ? inValue * inWeight
    : direction === 'out'
      ? outValue * outWeight
      : inValue * inWeight + outValue * outWeight;

// Asset identifiers point to existing demo assets only; weights are fabricated.
const talkerWeights = [
  { id: 'AST-002', in: 0.21, out: 0.3 },
  { id: 'AST-003', in: 0.29, out: 0.19 },
  { id: 'AST-001', in: 0.19, out: 0.15 },
  { id: 'AST-007', in: 0.16, out: 0.17 },
  { id: 'AST-004', in: 0.09, out: 0.11 },
]; // remaining assets: .06 inbound / .08 outbound
const transportMix = [
  { id: 'tcp', label: 'TCP', layer: 'نقل', in: 0.7, out: 0.64, color: 'cyan' },
  { id: 'udp', label: 'UDP', layer: 'نقل', in: 0.25, out: 0.3, color: 'blue' },
  { id: 'icmp', label: 'ICMP', layer: 'شبكة', in: 0.05, out: 0.06, color: 'purple' },
];
const applicationMix = [
  { id: 'https', label: 'HTTPS', in: 0.54, out: 0.59, color: 'cyan' },
  { id: 'dns', label: 'DNS', in: 0.08, out: 0.07, color: 'blue' },
  { id: 'http', label: 'HTTP', in: 0.1, out: 0.09, color: 'purple' },
  { id: 'unknown', label: 'غير مصنّف', in: 0.28, out: 0.25, color: 'muted' },
];
const portExamples = [
  {
    port: 8443,
    protocol: 'TCP',
    assetId: 'AST-007',
    observation: 'جديد في عينة خط الأساس',
    in: 0.006,
    out: 0.003,
  },
  {
    port: 2222,
    protocol: 'TCP',
    assetId: 'AST-002',
    observation: 'أعلى من النمط التجريبي',
    in: 0.002,
    out: 0.005,
  },
  {
    port: 3389,
    protocol: 'TCP',
    assetId: 'AST-004',
    observation: 'غير معتاد لهذا الأصل في المثال',
    in: 0.003,
    out: 0.001,
  },
  {
    port: 5001,
    protocol: 'TCP',
    assetId: 'AST-001',
    observation: 'ظهور محدود في المثال',
    in: 0.0015,
    out: 0.002,
  },
];
// Approximate regional marker positions and independent invented flow counts.
// Coordinates are for visual region markers, never derived from the sample IPs.
const geoExamples = [
  { id: 'north-america', label: 'أمريكا الشمالية', x: 230, y: 144, in: 185, out: 145 },
  { id: 'europe', label: 'أوروبا', x: 535, y: 108, in: 118, out: 126 },
  { id: 'middle-east', label: 'الشرق الأوسط', x: 625, y: 180, in: 96, out: 114 },
  { id: 'east-asia', label: 'شرق آسيا', x: 832, y: 163, in: 70, out: 83 },
];

export function networkView(
  period = '24h',
  direction = 'both',
  scenario = 'normal',
  offsetSamples = 0,
) {
  const config = NETWORK_PERIODS[period] || NETWORK_PERIODS['24h'];
  const safeDirection = ['both', 'in', 'out'].includes(direction) ? direction : 'both';
  const safeScenario = scenario === 'spike' ? 'spike' : 'normal';
  const source = safeScenario === 'spike' ? SPIKE_SAMPLE : NORMAL_SAMPLE;
  const end = source.length - Math.max(0, Math.trunc(offsetSamples)),
    start = end - config.samples;
  if (start < 0 || end <= 0) return null;
  const chosen = source.slice(start, end),
    totals = aggregate(chosen);
  const duration = chosen.length * SAMPLE_STEP_SECONDS,
    last = chosen[chosen.length - 1];
  const bytes = choose(totals, 'bytes', safeDirection),
    packets = choose(totals, 'packets', safeDirection);
  const completed = choose(totals, 'completed', safeDirection),
    attempts = choose(totals, 'attempts', safeDirection);
  const incomplete = choose(totals, 'incomplete', safeDirection),
    resets = choose(totals, 'resets', safeDirection);
  const active = choose(last, 'active', safeDirection);
  const buckets = [];
  for (let i = 0; i < chosen.length; i += config.bucket) {
    const part = chosen.slice(i, i + config.bucket),
      t = aggregate(part),
      seconds = part.length * SAMPLE_STEP_SECONDS;
    const mbpsIn = (t.bytesIn * 8) / seconds / 1e6,
      mbpsOut = (t.bytesOut * 8) / seconds / 1e6;
    const baselineMbpsIn = (t.baselineBytesIn * 8) / seconds / 1e6,
      baselineMbpsOut = (t.baselineBytesOut * 8) / seconds / 1e6;
    buckets.push({
      start: part[0].start,
      seconds,
      mbpsIn,
      mbpsOut,
      baselineMbpsIn,
      baselineMbpsOut,
      alertIn: baselineMbpsIn > 0 && mbpsIn > baselineMbpsIn * NETWORK_BASELINE.alertFactor,
      alertOut: baselineMbpsOut > 0 && mbpsOut > baselineMbpsOut * NETWORK_BASELINE.alertFactor,
      ppsIn: t.packetsIn / seconds,
      ppsOut: t.packetsOut / seconds,
    });
  }
  const talkers = talkerWeights
    .map(row => ({
      ...row,
      bytes: combineWeighted(totals.bytesIn, totals.bytesOut, row.in, row.out, safeDirection),
    }))
    .map(row => ({ ...row, mbps: (row.bytes * 8) / duration / 1e6 }))
    .sort((a, b) => b.bytes - a.bytes);
  const mix = items =>
    items
      .map(row => ({
        ...row,
        bytes: combineWeighted(totals.bytesIn, totals.bytesOut, row.in, row.out, safeDirection),
      }))
      .map(row => ({ ...row, percent: bytes ? (row.bytes / bytes) * 100 : 0 }));
  const ports = portExamples.map(row => ({
    ...row,
    count: Math.round(
      combineWeighted(totals.attemptsIn, totals.attemptsOut, row.in, row.out, safeDirection),
    ),
  }));
  const multiplier = { '1h': 1, '24h': 24, '7d': 168 }[period] || 24;
  const regions = geoExamples.map(row => ({
    ...row,
    count:
      multiplier *
      (safeDirection === 'in' ? row.in : safeDirection === 'out' ? row.out : row.in + row.out),
  }));
  return {
    period,
    direction: safeDirection,
    scenario: safeScenario,
    duration,
    totals,
    bytes,
    packets,
    completed,
    attempts,
    incomplete,
    resets,
    unresolved: incomplete - resets,
    active,
    mbps: (bytes * 8) / duration / 1e6,
    pps: packets / duration,
    meanBytes: packets ? bytes / packets : 0,
    cps: completed / duration,
    incompletePercent: attempts ? (incomplete / attempts) * 100 : 0,
    buckets,
    talkers,
    transport: mix(transportMix),
    applications: mix(applicationMix),
    ports,
    regions,
  };
}

// Independent fabricated five-minute asset/time attempts. These observations
// are NOT derived or inferred from the page's aggregate network counters.
// They exist only as an explicit fixture for testing the heatmap interface.
const HEAT_ASSETS = [
  { id: 'AST-002', incoming: 48, outgoing: 32, phase: 0.2 },
  { id: 'AST-003', incoming: 35, outgoing: 21, phase: 1.4 },
  { id: 'AST-001', incoming: 52, outgoing: 39, phase: 2.7 },
  { id: 'AST-007', incoming: 43, outgoing: 29, phase: 3.9 },
  { id: 'AST-004', incoming: 18, outgoing: 14, phase: 5.2 },
];
export const NETWORK_ASSET_TIME_FIXTURE = HEAT_ASSETS.map(asset => ({
  id: asset.id,
  samples: SAMPLE.map((time, i) => {
    const variation = Math.max(
      0.15,
      0.78 + 0.26 * Math.sin(i / 8 + asset.phase) + 0.17 * Math.cos(i / 29 + asset.phase * 2),
    );
    const reverse = Math.max(
      0.15,
      0.74 + 0.22 * Math.cos(i / 10 + asset.phase) + 0.13 * Math.sin(i / 23 + asset.phase),
    );
    return {
      start: time.start,
      incoming: Math.round(asset.incoming * variation),
      outgoing: Math.round(asset.outgoing * reverse),
    };
  }),
}));
export function networkHeatmap(view) {
  const origin = SAMPLE[0].start;
  return NETWORK_ASSET_TIME_FIXTURE.map(row => ({
    id: row.id,
    cells: view.buckets.map(bucket => {
      const first = Math.round((bucket.start - origin) / (SAMPLE_STEP_SECONDS * 1000)),
        length = Math.round(bucket.seconds / SAMPLE_STEP_SECONDS),
        slice = row.samples.slice(first, first + length);
      return {
        start: bucket.start,
        seconds: bucket.seconds,
        count: slice.reduce(
          (sum, sample) =>
            sum +
            (view.direction === 'in'
              ? sample.incoming
              : view.direction === 'out'
                ? sample.outgoing
                : sample.incoming + sample.outgoing),
          0,
        ),
      };
    }),
  }));
}

// Compare against the immediately preceding same-length window only when the
// full window exists in the seven-day fixture; never fabricate the missing week.
export function previousNetworkView(period = '24h', direction = 'both', scenario = 'normal') {
  const config = NETWORK_PERIODS[period] || NETWORK_PERIODS['24h'];
  return networkView(period, direction, scenario, config.samples);
}

const number = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 1 });
const precise = new Intl.NumberFormat('ar-EG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const integer = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 });
export const netNumber = value => number.format(value);
export const netInteger = value => integer.format(value);
export const netRate = (mbps, unit = 'Mbps') =>
  unit === 'Gbps' ? precise.format(mbps / 1000) : number.format(mbps);
const two = new Intl.NumberFormat('ar-EG', { minimumIntegerDigits: 2, maximumFractionDigits: 0 });
export function bucketLabel(timestamp, period) {
  // Format a fixed UTC+03 sample regardless of the viewer's local timezone.
  const d = new Date(timestamp + 3 * 60 * 60 * 1000),
    time = `${two.format(d.getUTCHours())}:${two.format(d.getUTCMinutes())}`;
  return period === '7d'
    ? `${two.format(d.getUTCDate())}/${two.format(d.getUTCMonth() + 1)} ${time}`
    : time;
}
