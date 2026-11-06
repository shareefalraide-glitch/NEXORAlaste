import {
  Activity,
  BellRing,
  Boxes,
  BrainCircuit,
  Database,
  FileBarChart2,
  FileClock,
  FileCode2,
  Fingerprint,
  LayoutDashboard,
  ListFilter,
  Network,
  Settings2,
  ShieldAlert,
  Users,
  Waypoints,
} from 'lucide-react';

export const groups = [
  { title: 'مساحة العمل', items: [{ id: 'overview', label: 'نظرة عامة', icon: LayoutDashboard }] },
  {
    title: 'العمليات الأمنية',
    items: [
      { id: 'alerts', label: 'التنبيهات', icon: BellRing },
      { id: 'incidents', label: 'الحوادث', icon: ShieldAlert },
      { id: 'events', label: 'مستكشف الأحداث', icon: ListFilter },
      { id: 'network', label: 'تحليل الشبكة', icon: Activity },
      { id: 'assets', label: 'الأصول', icon: Boxes },
      { id: 'relationships', label: 'خريطة العلاقات', icon: Waypoints },
    ],
  },
  {
    title: 'الكشف والتحليل',
    items: [
      { id: 'rules', label: 'قواعد الكشف', icon: FileCode2 },
      { id: 'model', label: 'نموذج الشذوذ', icon: BrainCircuit },
      { id: 'threats', label: 'مؤشرات التهديد', icon: Fingerprint },
      { id: 'mitre', label: 'تغطية MITRE', icon: Network },
    ],
  },
  {
    title: 'إدارة المنصة',
    items: [
      { id: 'sources', label: 'مصادر البيانات', icon: Database },
      { id: 'reports', label: 'التقارير', icon: FileBarChart2 },
      { id: 'audit', label: 'سجل التدقيق', icon: FileClock },
      { id: 'users', label: 'المستخدمون والأدوار', icon: Users },
      { id: 'settings', label: 'الإعدادات', icon: Settings2 },
    ],
  },
];
export const pages = Object.fromEntries(groups.flatMap(g => g.items.map(i => [i.id, i.label])));
export const commandPages = groups.flatMap(group =>
  group.items.map(item => ({ id: item.id, label: item.label, group: group.title })),
);
