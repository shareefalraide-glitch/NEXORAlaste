import { normalizeMac } from '../../shared/lib/mac.js';

// Local UI fixture model: MAC is never used as an asset identity.
export function interfacesOf(asset) {
  if (Array.isArray(asset?.interfaces)) return asset.interfaces;
  if (asset?.ip || asset?.mac)
    return [
      { id: `${asset.id}-IF-1`, name: 'eth0', ip: asset.ip || '', mac: asset.mac || '', vlan: '' },
    ];
  return [];
}
export function primaryInterface(asset) {
  const items = interfacesOf(asset);
  return items.find(x => x.id === asset?.primaryInterfaceId) || items[0] || null;
}
export function interfacePatch(asset, items, primaryId) {
  const normalized = items.map(x => ({
    id: x.id,
    name: String(x.name || '').trim(),
    ip: String(x.ip || '').trim(),
    mac: normalizeMac(x.mac) || '',
    vlan: String(x.vlan || '').trim(),
  }));
  const primary = normalized.find(x => x.id === primaryId) || normalized[0] || null;
  return {
    interfaces: normalized,
    primaryInterfaceId: primary?.id || '',
    ip: primary?.ip || '',
    mac: primary?.mac || '',
  };
}
export function primaryMacPatch(asset, mac) {
  let items = interfacesOf(asset);
  const existing = primaryInterface(asset);
  if (!existing && !mac && !asset.ip) return interfacePatch(asset, items, '');
  if (!existing) {
    items = [{ id: `${asset.id}-IF-1`, name: 'eth0', ip: asset.ip || '', mac, vlan: '' }];
    return interfacePatch(asset, items, items[0].id);
  }
  return interfacePatch(
    asset,
    items.map(x => (x.id === existing.id ? { ...x, mac } : x)),
    existing.id,
  );
}
export function validIp(value) {
  const text = String(value ?? '').trim();
  if (!text) return true;
  if (text.includes(':')) {
    if (!/^[0-9a-f:.]+$/i.test(text)) return false;
    try {
      return new URL(`http://[${text}]/`).hostname.startsWith('[');
    } catch {
      return false;
    }
  }
  const parts = text.split('.');
  return (
    parts.length === 4 &&
    parts.every(part => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)
  );
}
export const asciiDigits = value =>
  String(value ?? '')
    .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x6f0));
export function validVlan(value) {
  const text = asciiDigits(value).trim();
  return text === '' || (/^[0-9]{1,4}$/.test(text) && Number(text) >= 1 && Number(text) <= 4094);
}
export function newAssetRecord(values, id, origin = 'إضافة أصل') {
  const first = {
    id: `${id}-IF-1`,
    name: String(values.interfaceName || 'eth0').trim() || 'eth0',
    ip: String(values.ip || '').trim(),
    mac: normalizeMac(values.mac) || '',
    vlan: asciiDigits(values.vlan || '').trim(),
  };
  return {
    ...values,
    id,
    interfaces: [first],
    primaryInterfaceId: first.id,
    ip: first.ip,
    mac: first.mac,
    manufacturer: values.manufacturer || '',
    deviceModel: values.deviceModel || '',
    operatingSystem: values.operatingSystem || '',
    location: values.location || '',
    baseline: 'قيد التأسيس',
    events: '٠',
    alerts: 0,
    status: 'نشط',
    history: [
      {
        id: `${id}-H-1`,
        time: 'الآن · تجريبي',
        actor: 'أحمد علي',
        action: origin,
        detail: 'أُضيف السجل إلى بيانات العينة المؤقتة.',
      },
    ],
  };
}
export function assetChangeHistory(previous, patch, action, time) {
  const labels = {
    owner: 'المالك',
    criticality: 'الأهمية',
    group: 'المجموعة',
    manufacturer: 'الشركة المصنّعة',
    deviceModel: 'الطراز',
    operatingSystem: 'نظام التشغيل',
    location: 'الموقع',
    interfaces: 'واجهات الشبكة',
    primaryInterfaceId: 'الواجهة الرئيسية',
  };
  const changed = Object.keys(labels).filter(
    key =>
      Object.hasOwn(patch, key) &&
      JSON.stringify(previous[key] ?? '') !== JSON.stringify(patch[key] ?? ''),
  );
  if (!changed.length) return previous.history || [];
  return [
    {
      id: `H-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: `${time} · تجريبي`,
      actor: 'أحمد علي',
      action,
      detail: `الحقول المتأثرة: ${changed.map(k => labels[k]).join('، ')}.`,
      fields: changed,
    },
    ...(previous.history || []),
  ];
}
