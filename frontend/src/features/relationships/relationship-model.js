import { assetForRecord } from '../assets/asset-relations.js';
import { interfacesOf } from '../assets/asset-model.js';

// Sample-data relationships are not physical topology or network observations.
export function relationshipGraph(data, events) {
  const nodes = [
    ...data.sources.map(x => ({
      key: `source:${x.id}`,
      kind: 'source',
      id: x.id,
      title: x.name,
      subtitle: x.kind,
      record: x,
      search: [x.id, x.name, x.kind, x.location, x.mac],
    })),
    ...data.assets.map(x => ({
      key: `asset:${x.id}`,
      kind: 'asset',
      id: x.id,
      title: x.name,
      subtitle: x.type,
      record: x,
      search: [
        x.id,
        x.name,
        x.type,
        x.owner,
        x.location,
        ...interfacesOf(x).flatMap(i => [i.name, i.ip, i.mac, i.vlan]),
      ],
    })),
    ...data.incidents.map(x => ({
      key: `incident:${x.id}`,
      kind: 'incident',
      id: x.id,
      title: x.title,
      subtitle: x.status,
      record: x,
      search: [x.id, x.title, x.status, x.asset],
    })),
  ];
  const keys = new Set(nodes.map(n => n.key)),
    edges = new Map();
  const add = (a, b, relation, evidence) => {
    if (!keys.has(a) || !keys.has(b)) return;
    const key = `${a}|${b}`;
    if (!edges.has(key)) edges.set(key, { key, a, b, relation, evidence: [] });
    if (evidence) edges.get(key).evidence.push(evidence);
  };
  for (const event of events) {
    const asset = assetForRecord(data.assets, event);
    if (asset && event.sourceId)
      add(`source:${event.sourceId}`, `asset:${asset.id}`, 'source-asset', event.id);
  }
  for (const alert of data.alerts) {
    const asset = assetForRecord(data.assets, alert);
    if (asset && alert.sourceId)
      add(`source:${alert.sourceId}`, `asset:${asset.id}`, 'source-asset', alert.id);
  }
  for (const incident of data.incidents) {
    const asset = assetForRecord(data.assets, incident);
    if (asset) add(`asset:${asset.id}`, `incident:${incident.id}`, 'asset-incident', incident.id);
  }
  return { nodes, edges: [...edges.values()] };
}
