import assert from 'node:assert/strict';
import { networkContext, intervalRelation } from '../../src/features/network/network-context.js';
import {
  buildNotebookExport,
  NOTEBOOK_FOOTER,
  NOTEBOOK_REFERENCES,
  notebookImageAlt,
} from '../../src/features/investigations/notebook/notebook-model.js';

const start = Date.parse('2026-10-29T06:35:00Z'),
  seconds = 300,
  end = start + seconds * 1000;
for (const [time, expected] of [
  [null, 'undated'],
  [NaN, 'undated'],
  [start - 1, 'before'],
  [start, 'inside'],
  [end - 1, 'inside'],
  [end, 'after'],
  [end + 1, 'after'],
])
  assert.equal(intervalRelation(time, start, end), expected);
const assets = [
  { id: 'A', name: 'unique-a' },
  { id: 'B', name: 'unique-b' },
  { id: 'D1', name: 'duplicate' },
  { id: 'D2', name: 'duplicate' },
];
const event = (id, attrs, time) => ({
  id,
  category: 'سجل عينة',
  ...attrs,
  ...(time === null ? {} : { utc: new Date(time).toISOString() }),
});
const events = [
  event('FIRST', { assetId: 'A' }, start),
  event('LAST', { assetId: 'A' }, end - 1),
  event('END', { assetId: 'A' }, end),
  event('BEFORE', { assetId: 'A' }, start - 1),
  event('MISSING', { assetId: 'A' }, null),
  event('UNIQUE', { asset: 'unique-a' }, start),
  event('ID-WINS', { assetId: 'A', asset: 'unique-b' }, start),
  event('BAD-ID', { assetId: 'B', asset: 'unique-a' }, start),
  event('UNKNOWN-ID', { assetId: 'Z', asset: 'unique-a' }, start),
  event('AMBIGUOUS', { asset: 'duplicate' }, start),
  event('DUP-ID', { assetId: 'D1', asset: 'duplicate' }, start),
];
const incidents = [
  {
    id: 'I-ONE',
    asset: 'unique-a',
    title: 'حادثة اسم فريد',
    sampleTime: new Date(start).toISOString(),
  },
  {
    id: 'INC-DEMO-1',
    assetId: 'A',
    title: 'حادثة جلسة',
    sampleTime: new Date(start).toISOString(),
  },
];
const context = networkContext({
  asset: assets[0],
  assets,
  events,
  alerts: [],
  incidents,
  start,
  seconds,
  investigations: { 'I-ONE': { notes: [{ id: 'note', text: 'ملاحظة جلسة' }] } },
});
const byId = id => [...context.inside, ...context.outside].find(row => row.item.id === id);
assert.equal(byId('FIRST').timeRelation, 'inside');
assert.equal(byId('LAST').timeRelation, 'inside');
assert.equal(byId('END').timeRelation, 'after');
assert.equal(byId('BEFORE').timeRelation, 'before');
assert.equal(byId('MISSING').timeRelation, 'undated');
assert.equal(
  byId('INC-DEMO-1').timeRelation,
  'undated',
  'a session-created incident is not assigned fixture time',
);
assert.equal(byId('UNIQUE').assetMatch, 'unique-name');
assert.equal(byId('I-ONE').assetMatch, 'unique-name');
assert.equal(byId('ID-WINS').assetMatch, 'id');
assert.equal(byId('BAD-ID'), undefined);
assert.equal(byId('UNKNOWN-ID'), undefined);
assert.equal(byId('AMBIGUOUS'), undefined);
assert.equal(byId('DUP-ID'), undefined);
assert.equal(context.notes.length, 1);
assert.equal(context.notes[0].assetMatch, 'unique-name');
const duplicate = networkContext({ asset: assets[2], assets, events, start, seconds });
assert.deepEqual(
  duplicate.inside.map(row => row.item.id),
  ['DUP-ID'],
  'an ambiguous name never becomes a match but its correct stable ID can',
);
assert.deepEqual(networkContext({ asset: assets[0], assets, events, start, seconds: 0 }), {
  inside: [],
  outside: [],
  notes: [],
});

const image = { name: 'image <1>.png', dataUrl: 'data:image/png;base64,aGVsbG8=' };
const incident = { id: 'CASE', title: '<script> title' },
  workspace = {
    summary: 'ملخص <b>',
    tasks: [{ id: 't', text: 'مهمة &', done: true }],
    notes: [
      {
        id: 'a',
        type: 'observation',
        section: 'analysis',
        text: '# عنوان\n- بند\n<script>x</script>',
        links: [{ kind: 'event', id: 'E', label: 'مرجع <E>' }],
        image,
      },
      { id: 'f', type: 'question', section: 'followup', text: 'قسم آخر' },
    ],
  };
const base = { summary: true, tasks: true, notes: true, images: false, sections: ['analysis'] };
let result = buildNotebookExport(incident, workspace, base);
assert.equal(result.selected.notes.length, 1);
assert.match(result.html, /&lt;script&gt;x&lt;\/script&gt;/);
assert.doesNotMatch(result.html, /<script>/i);
assert.doesNotMatch(result.html, /data:image/);
assert.ok(result.html.includes(NOTEBOOK_FOOTER));
assert.ok(result.html.includes(NOTEBOOK_REFERENCES));
assert.ok(!result.html.includes('قسم آخر'));
result = buildNotebookExport(incident, workspace, { ...base, images: true });
assert.match(result.html, /data:image\/png;base64/);
assert.ok(
  result.html.includes(
    `alt="${notebookImageAlt(image).replace('<', '&lt;').replace('>', '&gt;')}"`,
  ),
);
result = buildNotebookExport(incident, workspace, {
  ...base,
  summary: false,
  tasks: false,
  notes: false,
  images: true,
});
assert.equal(result.selected.notes.length, 0);
assert.doesNotMatch(result.html, /data:image|ملخص &lt;b&gt;|مهمة &amp;/);
console.log(
  'PASS 1.6.1 model: stable-ID/unique-name provenance, half-open boundaries and undated notes, selective safe export',
);
