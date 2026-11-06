import assert from 'node:assert/strict';
import {
  FORM_TYPES,
  dialogTitle,
  initialDialogValues,
} from '../../src/app/dialogs/dialog-state.js';
import { submitDialog } from '../../src/app/dialogs/dialog-submit.js';
import { matchesRecord } from '../../src/shared/lib/matching.js';

const incident = {
  id: 'INC-DEMO',
  status: 'جديدة',
  approval: 'لم يُطلب',
  owner: 'غير مسندة',
  category: 'نقل بيانات مشبوه',
  sourceIp: '192.0.2.1',
  destinationIp: '192.0.2.2',
  timeline: [],
};
const data = {
  incidents: [incident],
  alerts: [{ id: 'ALT-DEMO', incident: null }],
  users: [{ id: 'USER-DEMO', name: 'محلل', status: 'نشط' }],
  assets: [
    {
      id: 'AST-DEMO',
      primaryInterfaceId: 'IF-1',
      interfaces: [{ id: 'IF-1', name: 'eth0', ip: '192.0.2.10', mac: '', vlan: '' }],
    },
  ],
};

assert.ok(FORM_TYPES.includes('assetInterface') && FORM_TYPES.includes('approval'));
assert.equal(
  dialogTitle({ type: 'approval', payload: { mode: 'approve' } }),
  'مراجعة طلب الاحتواء',
);
assert.equal(dialogTitle({ type: 'unknown', payload: {} }), 'تفاصيل');
assert.equal(initialDialogValues({ type: 'report' }, data, '7d').period, 'آخر ٧ أيام');
assert.equal(initialDialogValues({ type: 'newIncident' }, data, '24h').id, 'ALT-DEMO');
assert.equal(
  initialDialogValues({ type: 'approval', payload: { id: incident.id } }, data).action,
  'حجب عنوان الوجهة',
);
assert.deepEqual(
  initialDialogValues(
    { type: 'assetInterface', payload: { assetId: 'AST-DEMO', interfaceId: 'IF-1' } },
    data,
  ),
  { name: 'eth0', ip: '192.0.2.10', mac: '', vlan: '', makePrimary: true },
);

function run(type, { p = {}, currentIncident = incident, values = {}, bulkResult = true } = {}) {
  const calls = [];
  const ctx = {
    modal: { type, payload: p },
    p,
    incident: currentIncident,
    values,
    data,
    notify: (...args) => calls.push(['notify', ...args]),
    update: (...args) => calls.push(['update', ...args]),
    add: (...args) => calls.push(['add', ...args]),
    close: () => calls.push(['close']),
    bulkAlerts: (...args) => {
      calls.push(['bulk', ...args]);
      return bulkResult;
    },
    createIncident: (...args) => calls.push(['create', ...args]),
  };
  submitDialog({ preventDefault: () => calls.push(['preventDefault']) }, ctx);
  return calls;
}

const transition = run('transition', {
  p: { next: 'مسندة' },
  values: { owner: 'محلل', reason: '', rootCause: '' },
});
assert.equal(transition[1][0], 'update');
assert.equal(transition[1][1], 'incidents');
assert.equal(transition[1][3].status, 'مسندة');
assert.equal(transition[1][3].owner, 'محلل');
assert.equal(transition[1][3].timeline[0].session, true);
assert.equal(transition.at(-1)[0], 'close');
const invalidTransition = run('transition', {
  p: { next: 'مغلقة' },
  values: { reason: '', rootCause: '' },
});
assert.equal(invalidTransition[1][0], 'notify');
assert.ok(!invalidTransition.some(call => call[0] === 'update' || call[0] === 'close'));

const request = run('approval', {
  p: { mode: 'request' },
  currentIncident: { ...incident, status: 'قيد المعالجة' },
  values: { reason: '  سياق تجريبي  ', action: 'حجب عنوان الوجهة' },
});
assert.equal(request[1][0], 'update');
assert.equal(request[1][3].approval, 'بانتظار الموافقة');
assert.equal(request[1][3].containmentTarget, '192.0.2.2');
assert.equal(request.at(-1)[0], 'close');

let complete = false;
const bulk = run('bulkAssign', {
  p: {
    ids: ['ALT-DEMO'],
    onComplete: () => {
      complete = true;
    },
  },
  values: { confirm: true, owner: 'محلل' },
});
assert.deepEqual(bulk[1], ['bulk', ['ALT-DEMO'], 'assign', 'محلل']);
assert.ok(complete);
assert.equal(bulk.at(-1)[0], 'close');
const unconfirmed = run('bulkReview', { p: { ids: ['ALT-DEMO'] }, values: { confirm: false } });
assert.equal(unconfirmed[1][0], 'notify');
assert.ok(!unconfirmed.some(call => call[0] === 'bulk'));

const source = run('addSource', {
  values: { name: '  مستشعر  ', location: '  المختبر  ', mac: '', method: 'Zeek' },
});
assert.equal(source[1][0], 'add');
assert.equal(source[1][1], 'sources');
assert.equal(source[1][2].name, 'مستشعر');
assert.equal(source[1][2].health, 'غير متصل');
assert.equal(source.at(-1)[0], 'close');
const creation = run('newIncident', { values: { id: 'ALT-DEMO', reason: '  سبب  ' } });
assert.deepEqual(creation[1], ['create', 'ALT-DEMO', 'سبب']);

assert.equal(matchesRecord({ id: 'AST-123', name: 'Server' }, 'server'), true);
assert.equal(matchesRecord({ id: 'AST-123', score: 123 }, '123'), true);
assert.equal(matchesRecord({ id: 'AST-123', score: 123 }, 'missing'), false);
assert.equal(matchesRecord({ id: 'AST-123' }, '   '), true);
console.log('PASS dialog state/submission and shared record matching unit tests');
