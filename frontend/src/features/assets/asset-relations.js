// Resolve local mock relationships by stable fixture ID when present.
// A legacy name-only reference must be unique; never guess between duplicates.
export function assetForRecord(assets, record) {
  if (record?.assetId) return assets.find(asset => asset.id === record.assetId);
  const candidates = assets.filter(asset => asset.name === record?.asset);
  return candidates.length === 1 ? candidates[0] : undefined;
}
export function recordBelongsToAsset(assets, record, asset) {
  return assetForRecord(assets, record)?.id === asset.id;
}
