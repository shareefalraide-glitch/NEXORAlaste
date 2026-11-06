import { assetForRecord } from '../../assets/asset-relations.js';
import { inPeriod, recordTime } from '../../../shared/lib/time-scope.js';

// A typed, provenance-carrying graph built only from fixture fields. These
// associations are not traffic observations, identity verification, or proof
// of attacker movement. The original summary graph remains independent.
export function buildAnalystGraph(data, events, timeRange = '24h') {
  const nodes = new Map(),
    links = new Map();
  const addNode = node => {
    if (!nodes.has(node.key)) nodes.set(node.key, node);
  };
  const addEdge = (a, b, relation, kind, id) => {
    if (!nodes.has(a) || !nodes.has(b) || a === b) return;
    const key = `${a}|${b}|${relation}`;
    if (!links.has(key)) links.set(key, { key, a, b, relation, evidence: [] });
    const evidence = links.get(key).evidence;
    if (!evidence.some(x => x.kind === kind && x.id === id)) evidence.push({ kind, id });
  };
  const recordNode = (kind, item, title, subtitle) => ({
    key: `${kind}:${item.id}`,
    kind,
    id: item.id,
    title,
    subtitle,
    openKind: kind,
    openId: item.id,
    outside:
      (kind === 'incident' || kind === 'alert' || kind === 'event') &&
      !inPeriod(item, kind, timeRange),
    time: recordTime(item, kind),
  });
  for (const item of data.incidents || [])
    addNode(recordNode('incident', item, item.title, item.status));
  for (const item of data.alerts || [])
    addNode(recordNode('alert', item, item.title, item.severity));
  for (const item of events || [])
    addNode(
      recordNode('event', item, item.category, `${item.outcome} · ${item.time || 'وقت غير متاح'}`),
    );
  for (const item of data.assets || [])
    addNode({
      key: `asset:${item.id}`,
      kind: 'asset',
      id: item.id,
      title: item.name,
      subtitle: item.type,
      openKind: 'asset',
      openId: item.id,
    });
  for (const item of data.sources || [])
    addNode({
      key: `source:${item.id}`,
      kind: 'source',
      id: item.id,
      title: item.name,
      subtitle: item.kind,
      openKind: 'source',
      openId: item.id,
    });
  for (const event of events || []) {
    for (const [field, kind] of [
      ['src', 'ip'],
      ['dst', 'ip'],
      ['user', 'user'],
    ]) {
      const value = String(event[field] || '').trim();
      if (!value || value === '—' || value === '-') continue;
      addNode({
        key: `${kind}:${value}`,
        kind,
        id: value,
        title: value,
        subtitle: kind === 'ip' ? 'عنوان في حقل حدث' : 'اسم وارد في حقل حدث',
        openKind: 'entity',
        openId: `${kind}|${value}`,
      });
    }
  }
  for (const incident of data.incidents || []) {
    const asset = assetForRecord(data.assets || [], incident);
    if (asset)
      addEdge(
        `incident:${incident.id}`,
        `asset:${asset.id}`,
        'الأصل المرتبط بسجل الحادثة',
        'incident',
        incident.id,
      );
  }
  for (const alert of data.alerts || []) {
    const asset = assetForRecord(data.assets || [], alert);
    if (alert.incident)
      addEdge(
        `incident:${alert.incident}`,
        `alert:${alert.id}`,
        'الحادثة المرتبطة في سجل التنبيه',
        'alert',
        alert.id,
      );
    if (asset)
      addEdge(
        `alert:${alert.id}`,
        `asset:${asset.id}`,
        'الأصل المرتبط بسجل التنبيه',
        'alert',
        alert.id,
      );
    if (alert.sourceId)
      addEdge(
        `alert:${alert.id}`,
        `source:${alert.sourceId}`,
        'مصدر البيانات المذكور في التنبيه',
        'alert',
        alert.id,
      );
  }
  for (const event of events || []) {
    const asset = assetForRecord(data.assets || [], event),
      eventKey = `event:${event.id}`;
    if (event.alert)
      addEdge(`alert:${event.alert}`, eventKey, 'تنبيه محدد في سجل الحدث', 'event', event.id);
    if (asset)
      addEdge(eventKey, `asset:${asset.id}`, 'الأصل المرتبط بسجل الحدث', 'event', event.id);
    if (event.sourceId)
      addEdge(
        eventKey,
        `source:${event.sourceId}`,
        'مصدر البيانات المذكور في الحدث',
        'event',
        event.id,
      );
    if (event.src && event.src !== '—')
      addEdge(eventKey, `ip:${event.src}`, 'عنوان المصدر في حقل الحدث', 'event', event.id);
    if (event.dst && event.dst !== '—')
      addEdge(eventKey, `ip:${event.dst}`, 'عنوان الوجهة في حقل الحدث', 'event', event.id);
    if (event.user && event.user !== '—' && event.user !== '-')
      addEdge(eventKey, `user:${event.user}`, 'اسم المستخدم في حقل الحدث', 'event', event.id);
  }
  return { nodes: [...nodes.values()], edges: [...links.values()] };
}

export function graphNeighbors(graph, key) {
  return graph.edges
    .filter(edge => edge.a === key || edge.b === key)
    .map(edge => ({
      edge,
      node: graph.nodes.find(node => node.key === (edge.a === key ? edge.b : edge.a)),
    }))
    .filter(item => item.node);
}

// Deterministic horizontal layers keep a small expanded graph legible without a
// physics engine or network calls. Textual selection is always available.
export function graphLayers(root, visibleKeys, edges) {
  const visible = new Set(visibleKeys),
    distance = new Map([[root, 0]]),
    queue = [root];
  while (queue.length) {
    const here = queue.shift();
    for (const edge of edges) {
      const other = edge.a === here ? edge.b : edge.b === here ? edge.a : null;
      if (other && visible.has(other) && !distance.has(other)) {
        distance.set(other, distance.get(here) + 1);
        queue.push(other);
      }
    }
  }
  const layers = new Map();
  for (const key of visible) {
    const depth = Math.min(distance.get(key) ?? 4, 4);
    if (!layers.has(depth)) layers.set(depth, []);
    layers.get(depth).push(key);
  }
  return [...layers.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([depth, keys]) => ({ depth, keys }));
}
