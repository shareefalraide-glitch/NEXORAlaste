// Pure state-machine checks; the UI never saves case tabs outside the session.
import { strict as assert } from 'node:assert';
import {
  MAX_INVESTIGATION_TABS,
  initialInvestigationTabs,
  investigationTabsReducer as reduce,
} from '../../src/features/investigations/workspace/investigation-tabs.js';
let s = initialInvestigationTabs(),
  i = 0;
const open = (kind, id) => {
  s = reduce(s, { type: 'open', selection: { kind, id, key: `k${++i}` } });
};
open('alert', 'ALT-1');
open('incident', 'INC-1');
assert.deepEqual(
  s.stack.map(x => x.id),
  ['ALT-1', 'INC-1'],
);
open('event', 'EVT-1');
open('asset', 'AST-1');
open('event', 'EVT-1');
assert.deepEqual(
  s.stack.map(x => x.id),
  ['ALT-1', 'INC-1', 'EVT-1'],
  'revisiting a record within a case returns to its earlier breadcrumb',
);
const firstStack = s.stack;
open('incident', 'INC-2');
assert.deepEqual(
  s.stack.map(x => x.id),
  ['INC-2'],
);
s = reduce(s, { type: 'switch', id: 'INC-1' });
assert.deepEqual(s.stack, firstStack, 'each workspace restores its breadcrumb');
open('incident', 'INC-1');
assert.deepEqual(
  s.stack.map(x => x.id),
  ['ALT-1', 'INC-1'],
  'reopening the case returns to it without duplicates',
);
s = reduce(s, { type: 'set-stack', value: stack => stack.slice(0, 1) });
assert.equal(s.activeId, null, 'back past the case leaves its workspace');
assert.deepEqual(
  s.tabs.find(t => t.id === 'INC-1').stack.map(x => x.id),
  ['ALT-1', 'INC-1'],
);
s = reduce(s, { type: 'switch', id: 'INC-1' });
s = reduce(s, { type: 'pin', id: 'INC-1' });
s = reduce(s, { type: 'remove', id: 'INC-1' });
assert.equal(s.confirmation, 'INC-1');
assert.equal(s.tabs.length, 2);
s = reduce(s, { type: 'cancel-remove' });
assert.equal(s.confirmation, null);
s = reduce(s, { type: 'set-stack', value: [] });
assert.equal(s.activeId, null);
assert.equal(s.tabs.length, 2);
s = reduce(s, { type: 'switch', id: 'INC-1' });
assert.equal(s.activeId, 'INC-1');
s = reduce(s, { type: 'remove', id: 'INC-1', confirmed: true });
assert.equal(s.activeId, 'INC-2');
for (let n = 3; n <= MAX_INVESTIGATION_TABS + 1; n++) open('incident', `INC-${n}`);
assert.equal(s.tabs.length, MAX_INVESTIGATION_TABS);
open('incident', 'INC-OVER');
assert.equal(s.tabs.length, MAX_INVESTIGATION_TABS);
assert.match(s.error, /حد/);
s = reduce(s, { type: 'reset' });
assert.deepEqual(s, initialInvestigationTabs());
console.log(
  'PASS in-memory investigation tab state, trail isolation, pin confirmation, limit, hide/restore and reset',
);
