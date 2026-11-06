import { interfacesOf, primaryInterface } from '../../features/assets/asset-model.js';

export const FORM_TYPES = [
  'transition',
  'falsePositive',
  'approval',
  'newAsset',
  'editAsset',
  'assetInterface',
  'deleteInterface',
  'newUser',
  'editUser',
  'newRule',
  'importIoc',
  'addSource',
  'editSource',
  'createFromAlert',
  'newIncident',
  'bulkReview',
  'bulkAssign',
];
export function initialDialogValues(modal, data, timeRange) {
  const p = modal?.payload || {};
  switch (modal?.type) {
    case 'transition':
      return {
        owner: 'أحمد علي',
        reason: '',
        rootCause: data.incidents.find(x => x.id === p.id)?.rootCause || '',
      };
    case 'falsePositive':
      return { reason: '' };
    case 'approval': {
      const incident = data.incidents.find(x => x.id === p.id);
      return {
        reason: '',
        confirm: false,
        decision: 'approve',
        action:
          incident?.containmentAction ||
          (incident?.category === 'نقل بيانات مشبوه' ? 'حجب عنوان الوجهة' : 'حجب عنوان المصدر'),
      };
    }
    case 'newAsset':
      return {
        name: '',
        ip: '',
        mac: '',
        type: 'خادم',
        criticality: 'متوسطة',
        owner: '',
        group: 'الخوادم',
        manufacturer: '',
        deviceModel: '',
        operatingSystem: '',
        location: '',
      };
    case 'editAsset':
      return {
        ...p,
        mac: p.mac || '',
        manufacturer: p.manufacturer || '',
        deviceModel: p.deviceModel || '',
        operatingSystem: p.operatingSystem || '',
        location: p.location || '',
      };
    case 'assetInterface': {
      const asset = data.assets.find(a => a.id === p.assetId),
        item = interfacesOf(asset).find(x => x.id === p.interfaceId);
      return {
        name: item?.name || '',
        ip: item?.ip || '',
        mac: item?.mac || '',
        vlan: item?.vlan || '',
        makePrimary: !primaryInterface(asset) || item?.id === primaryInterface(asset)?.id,
      };
    }
    case 'deleteInterface':
      return { confirm: false };
    case 'newUser':
      return { name: '', email: '', role: 'محلل أمني' };
    case 'editUser':
      return { ...p };
    case 'newRule':
      return { name: '', source: 'Sigma', severity: 'متوسطة', technique: '', desc: '' };
    case 'importIoc':
      return { text: '', type: 'عنوان IP', severity: 'متوسطة' };
    case 'addSource':
      return {
        name: '',
        mac: '',
        kind: 'مستشعر شبكة',
        location: '',
        method: 'Zeek',
        color: 'blue',
      };
    case 'editSource':
      return { mac: p.mac || '' };
    case 'createFromAlert':
      return { id: p.id, reason: '' };
    case 'newIncident':
      return { id: data.alerts.find(x => !x.incident)?.id || '', reason: '' };
    case 'bulkReview':
      return { confirm: false };
    case 'bulkAssign':
      return { owner: data.users.find(u => u.status === 'نشط')?.name || '', confirm: false };
    case 'report':
      return {
        period: timeRange === '1h' ? 'آخر ساعة' : timeRange === '7d' ? 'آخر ٧ أيام' : 'آخر ٢٤ ساعة',
      };
    default:
      return { search: '' };
  }
}
export function dialogTitle(modal) {
  const p = modal.payload || {};
  const titles = {
    bulkReview: 'مراجعة تنبيهات محددة',
    bulkAssign: 'إسناد تنبيهات محددة',
    transition: 'تحديث حالة الحادثة',
    falsePositive: 'تصنيف إنذار كاذب',
    approval: p.mode === 'approve' ? 'مراجعة طلب الاحتواء' : 'طلب إجراء احتواء',
    newAsset: 'إضافة أصل',
    editAsset: 'تعديل الأصل',
    assetInterface: p.interfaceId ? 'تعديل واجهة الشبكة' : 'إضافة واجهة شبكة',
    deleteInterface: 'حذف واجهة الشبكة',
    newUser: 'إضافة مستخدم',
    editUser: 'تعديل المستخدم',
    newRule: 'إضافة قاعدة كشف',
    testRule: 'اختبار قاعدة كشف',
    importIoc: 'استيراد مؤشرات التهديد',
    addSource: 'إضافة مصدر بيانات',
    editSource: 'تعديل عنوان MAC للمصدر',
    createFromAlert: 'إنشاء حادثة من تنبيه',
    newIncident: 'إنشاء حادثة يدوية',
    modelAction: p.action,
    baselineInfo: 'فترة تأسيس خط الأساس',
    sourceDetail: 'تفاصيل مصدر البيانات',
    mitreDetail: 'تفاصيل التقنية',
    mitreExport: 'تصدير خريطة التغطية',
    verifyAudit: 'فحص سلامة سجل التدقيق',
    report: 'معاينة التقرير',
    copilot: 'المساعد التجريبي',
    search: 'البحث في المنصة',
    help: 'مساعدة حول النموذج',
    about: 'عن NEXORA',
    workspace: 'مساحة العمل',
  };
  return titles[modal.type] || 'تفاصيل';
}
