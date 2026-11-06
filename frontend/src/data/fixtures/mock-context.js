// Fictional hand-authored examples. These are neither scan results nor a CMDB.
export const BUSINESS_CONTEXT = {
  'AST-001': {
    service: 'خدمة المصادقة التجريبية',
    owner: 'قسم البنية التحتية',
    priority: 'أولوية عالية · تصنيف يدوي',
    effect: 'قد تتأثر عملية تسجيل الدخول في هذا السيناريو الافتراضي.',
    source: 'وصف يدوي في العينة',
  },
  'AST-002': {
    service: 'خدمة بيانات داخلية تجريبية',
    owner: 'فريق قواعد البيانات',
    priority: 'أولوية عالية · تصنيف يدوي',
    effect: 'تحتاج استمرارية الخدمة إلى مراجعة بشرية في هذا السيناريو.',
    source: 'وصف يدوي في العينة',
  },
};
export const VULNERABILITY_SAMPLES = [
  {
    id: 'VULN-DEMO-001',
    assetId: 'AST-001',
    title: 'مراجعة تصحيحات خدمة المصادقة',
    status: 'غير متحقق',
    source: 'وصف يدوي للعينة',
    observedAt: 'غير متاح',
    next: 'تحقق من قائمة التصحيحات ومصدرها قبل اتخاذ قرار.',
  },
  {
    id: 'VULN-DEMO-002',
    assetId: 'AST-007',
    title: 'مراجعة إعداد خدمة ويب',
    status: 'غير متحقق',
    source: 'وصف يدوي للعينة',
    observedAt: 'غير متاح',
    next: 'راجع إعداد الخدمة في بيئة مرخصة، دون استنتاج وجود ثغرة.',
  },
];
