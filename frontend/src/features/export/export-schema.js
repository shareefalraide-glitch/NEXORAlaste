import { interfacesOf } from '../assets/asset-model';
// Export definitions mirror the displayed table, not the raw internal object.
const def = (id, label, value) => ({ id, label, value });
export const alertExportSchema = [
  def('title', 'التنبيه', x => `${x.title} · ${x.id}`),
  def('severity', 'الخطورة', x => x.severity),
  def('score', 'الدرجة', x => x.score),
  def('asset', 'الأصل', x => x.asset),
  def('source', 'عنوان المصدر', x => x.source),
  def('status', 'الحالة', x => x.status),
  def('owner', 'المسؤول', x => x.owner || 'غير مسند'),
  def('time', 'الوقت', x => x.age),
];
export const incidentExportSchema = [
  def('title', 'الحادثة', x => `${x.title} · ${x.id}`),
  def('severity', 'الخطورة', x => x.severity),
  def('score', 'الدرجة', x => x.score),
  def('asset', 'الأصل', x => x.asset),
  def('status', 'الحالة', x => x.status),
  def('owner', 'المسؤول', x => x.owner),
  def('alerts', 'التنبيهات', x => x.alerts),
  def('time', 'الوقت', x => x.age),
];
export const eventExportSchema = [
  def('time', 'الوقت المحلي', x => x.time),
  def('source', 'المصدر', x => `${x.sourceLabel} · ${x.collectionMethod}`),
  def('category', 'نوع الحدث', x => `${x.category} · ${x.id}`),
  def('src', 'عنوان المصدر', x => x.src),
  def('dst', 'عنوان الوجهة', x => x.dst),
  def('asset', 'الأصل', x => x.asset),
  def('outcome', 'النتيجة', x => x.outcome),
];
export const assetExportSchema = [
  def('asset', 'الأصل', x => `${x.name} · ${x.id}`),
  def('type', 'النوع', x => x.type),
  def('ip', 'عنوان IP', x => x.ip),
  def('mac', 'عنوان MAC', x => x.mac || '—'),
  def('interfaceCount', 'الواجهات', x => interfacesOf(x).length),
  def('interfaceDetails', 'تفاصيل واجهات الشبكة', x =>
    interfacesOf(x)
      .map(i => `${i.name} | IP ${i.ip || '—'} | MAC ${i.mac || '—'} | VLAN ${i.vlan || '—'}`)
      .join(' ; '),
  ),
  def('criticality', 'الأهمية', x => x.criticality),
  def('owner', 'المالك', x => x.owner),
  def('baseline', 'خط الأساس', x => x.baseline),
  def('alerts', 'التنبيهات', x => x.alerts),
];
export const ruleExportSchema = [
  def('rule', 'القاعدة', x => `${x.name} · ${x.id}`),
  def('source', 'المصدر', x => x.source),
  def('severity', 'الخطورة', x => x.severity),
  def('technique', 'تقنية ATT&CK', x => x.technique),
  def('last', 'آخر تحديث', x => x.last),
  def('status', 'الحالة', x => (x.enabled ? 'مفعّلة' : 'متوقفة')),
];
export const iocExportSchema = [
  def('indicator', 'المؤشر', x => `${x.value} · ${x.id}`),
  def('type', 'النوع', x => x.type),
  def('source', 'المصدر', x => x.source),
  def('severity', 'الخطورة', x => x.severity),
  def('added', 'تاريخ الإضافة', x => x.added),
  def('matches', 'المطابقات', x => x.matches),
];
export const auditExportSchema = [
  def('time', 'الوقت', x => `${x.time} · ${x.date}`),
  def('action', 'العملية', x => x.action),
  def('actor', 'المنفّذ', x => x.actor),
  def('entity', 'الكيان المتأثر', x => x.entity),
  def('ip', 'عنوان المصدر', x => x.ip),
  def('result', 'النتيجة', x => x.result),
  def('hash', 'بصمة توضيحية غير متحققة', x => x.hash),
];
