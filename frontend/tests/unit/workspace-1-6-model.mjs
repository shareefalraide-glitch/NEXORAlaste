import assert from 'node:assert/strict';
import {
  initialInvestigationTabs,
  investigationTabsReducer,
} from '../../src/features/investigations/workspace/investigation-tabs.js';
import { validateTriageBatch } from '../../src/features/alerts/triage-model.js';
import {
  buildNotebookExport,
  parseNote,
  validImage,
} from '../../src/features/investigations/notebook/notebook-model.js';
import { networkContext } from '../../src/features/network/network-context.js';
import {
  initialAlerts,
  initialAssets,
  initialIncidents,
  events,
} from '../../src/data/fixtures/demo-records.js';

let state = initialInvestigationTabs();
const selection = (kind, id, key) => ({ kind, id, key });
state = investigationTabsReducer(state, {
  type: 'open',
  selection: selection('incident', 'INC-2026-084', 'a'),
});
state = investigationTabsReducer(state, {
  type: 'open',
  selection: selection('incident', 'INC-2026-083', 'b'),
});
state = investigationTabsReducer(state, { type: 'pin', id: 'INC-2026-084' });
const panes = [
  {
    id: 'INC-2026-084',
    stack: [selection('incident', 'INC-2026-084', 'a'), selection('event', 'EVT-90481', 'event')],
  },
  {
    id: 'INC-2026-083',
    stack: [selection('incident', 'INC-2026-083', 'b'), selection('alert', 'ALT-1283', 'alert')],
  },
];
state = investigationTabsReducer(state, { type: 'merge-panes', panes, activeId: 'INC-2026-084' });
assert.equal(state.stack.at(-1).id, 'EVT-90481');
assert.equal(state.tabs.find(item => item.id === 'INC-2026-083').stack.at(-1).id, 'ALT-1283');
assert.equal(state.tabs.find(item => item.id === 'INC-2026-084').pinned, true);
const old = state.tabs[0].stack;
state = investigationTabsReducer(state, {
  type: 'merge-panes',
  panes: [{ id: 'INC-2026-084', stack: [selection('event', 'EVT-90481', 'no-root')] }],
});
assert.deepEqual(state.tabs[0].stack, old, 'reject a trail with no matching case root');

const first = {
    id: 'ALT-1284',
    decision: 'followup',
    priority: 'p1',
    reason: '  سبب أول  ',
    note: 'ملاحظة',
  },
  second = { id: 'ALT-1283', decision: 'unknown', priority: 'p3', reason: 'سبب ثانٍ', note: '' };
let result = validateTriageBatch([first, second], initialAlerts, {});
assert.equal(result.ok, true);
assert.equal(result.rows[0].reason, 'سبب أول');
assert.equal(result.rows[1].decision, 'unknown');
assert.notEqual(result.rows[0].reason, result.rows[1].reason);
assert.equal(
  validateTriageBatch([first, { ...second, reason: '  ' }], initialAlerts, {}).ok,
  false,
);
assert.equal(validateTriageBatch([first, first], initialAlerts, {}).ok, false);
assert.equal(
  validateTriageBatch([{ ...first, reason: 'x'.repeat(401) }], initialAlerts, {}).ok,
  false,
);
assert.equal(
  validateTriageBatch([first], initialAlerts, {
    'ALT-1284': Array.from({ length: 20 }, () => ({})),
  }).ok,
  false,
);
assert.equal(validateTriageBatch([], initialAlerts, {}).ok, false);
assert.equal(
  validateTriageBatch(
    Array.from({ length: 51 }, (_, i) => ({ ...first, id: `ALT-${i}` })),
    initialAlerts,
    {},
  ).error,
  'اختر من تنبيه واحد إلى ٥٠ تنبيهًا.',
);

const image = { name: 'safe.png', dataUrl: 'data:image/png;base64,aGVsbG8=' },
  unsafe = { name: 'bad.svg', dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' };
assert.equal(validImage(image), true);
assert.equal(validImage(unsafe), false);
assert.equal(parseNote('# عنوان\n- بند')[0].type, 'heading');
assert.equal(parseNote('# عنوان\n- بند')[1].type, 'list');
const incident = { id: 'INC-1', title: 'مثال <script>bad()</script>' };
const workspace = {
  summary: 'ملخص <img src=x onerror=alert(1)>',
  tasks: [{ id: 't1', text: 'مهمة <b>', done: true }],
  notes: [
    {
      id: 'a',
      type: 'hypothesis',
      section: 'analysis',
      text: '# عنوان\n- بند\n<script>alert(1)</script>',
      links: [{ kind: 'event', id: 'E1', label: 'مرجع <E1>' }],
      image,
    },
    { id: 'b', type: 'question', section: 'followup', text: 'سؤال', image: unsafe },
  ],
};
const opts = { summary: true, tasks: true, notes: true, images: false, sections: ['analysis'] };
let exportResult = buildNotebookExport(incident, workspace, opts);
assert.equal(exportResult.selected.notes.length, 1);
assert.match(exportResult.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
assert.doesNotMatch(exportResult.html, /<script>/i);
assert.doesNotMatch(exportResult.html, /data:image/);
assert.match(exportResult.html, /<strong class="line-heading">عنوان/);
assert.match(exportResult.html, /<li>بند<\/li>/);
assert.ok(!exportResult.html.includes('سؤال'));
exportResult = buildNotebookExport(incident, workspace, {
  ...opts,
  images: true,
  sections: ['analysis', 'followup'],
});
assert.match(exportResult.html, /data:image\/png;base64/);
assert.doesNotMatch(exportResult.html, /data:image\/svg/);
assert.match(exportResult.text, /صورة محلية مرفقة/);

const start = Date.parse('2026-10-29T06:35:00Z'),
  end = start + 300000,
  asset = initialAssets.find(x => x.id === 'AST-001');
const boundary = {
  id: 'BOUNDARY',
  assetId: 'AST-001',
  utc: new Date(end).toISOString(),
  category: 'حد الفاصل',
};
const missing = { id: 'MISSING', assetId: 'AST-001', category: 'بلا وقت' };
const note = { id: 'note', text: 'ملاحظة جلسة مستقلة' };
const context = networkContext({
  asset,
  assets: initialAssets,
  alerts: initialAlerts,
  incidents: initialIncidents,
  events: [...events, boundary, missing],
  start,
  seconds: 300,
  investigations: { 'INC-2026-084': { notes: [note] } },
});
assert.ok(context.inside.some(row => row.item.id === 'EVT-90481'));
assert.ok(context.inside.some(row => row.item.id === 'ALT-1284'));
assert.ok(context.inside.some(row => row.item.id === 'INC-2026-084'));
assert.ok(
  !context.inside.some(row => row.item.id === 'BOUNDARY'),
  'half-open interval excludes exact end',
);
assert.ok(context.outside.some(row => row.item.id === 'BOUNDARY'));
assert.ok(context.outside.some(row => row.item.id === 'MISSING' && row.time === null));
assert.deepEqual(
  context.notes.map(row => row.note.id),
  ['note'],
);
assert.ok(context.inside.every(row => row.item.assetId === 'AST-001'));
console.log(
  'PASS 1.6 models: bounded split trails, independent validation, safe selective notebook export and non-causal asset/time filtering',
);
