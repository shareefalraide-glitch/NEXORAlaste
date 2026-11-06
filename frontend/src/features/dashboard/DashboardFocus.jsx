import React, { useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BellRing,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  CircleHelp,
  Clock3,
  Database,
  FileBarChart2,
  ListChecks,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import {
  ar,
  Button,
  Empty,
  ltr,
  Panel,
  PanelHeading,
  Select,
  Severity,
  Status,
} from '../../shared/ui/index';

const roleInfo = {
  'مدير النظام': {
    intro: 'متابعة جاهزية المنصة والمصادر والموافقات في العينة.',
    icon: ShieldCheck,
  },
  'محلل أمني': {
    intro: 'ابدأ بالتنبيهات الجديدة ثم راجع الحوادث المسندة إليك في العينة.',
    icon: Activity,
  },
  'مسؤول الاستجابة': {
    intro: 'ركّز على الحوادث قيد المعالجة وطلبات الموافقة البشرية.',
    icon: ShieldAlert,
  },
  'قيادة المؤسسة': {
    intro: 'ملخص تنفيذي لحالات الحوادث والتقارير في العينة.',
    icon: FileBarChart2,
  },
};
const open = x => !['مغلقة', 'إنذار كاذب'].includes(x.status);
export const demoRoleNames = Object.keys(roleInfo);

export function RoleFocus({ data, role, setRole, go }) {
  const info = roleInfo[role],
    persona = data.users.find(u => u.role === role && u.status === 'نشط')?.name;
  const incidents = data.incidents.filter(open),
    pending = incidents.filter(x => x.approval === 'بانتظار الموافقة').length;
  const assigned = persona ? incidents.filter(x => x.owner === persona).length : 0;
  const metrics = {
    'مدير النظام': [
      {
        label: 'مصادر متصلة في العينة',
        value: data.sources.filter(s => s.health === 'متصل').length,
        unit: `من ${ar(data.sources.length)} مصادر`,
        page: 'sources',
        icon: Database,
      },
      {
        label: 'قواعد مفعّلة',
        value: data.rules.filter(r => r.enabled).length,
        unit: `من ${ar(data.rules.length)} قواعد`,
        page: 'rules',
        icon: ShieldCheck,
      },
      {
        label: 'طلبات موافقة معلّقة',
        value: pending,
        unit: 'في العينة',
        page: 'incidents',
        icon: ListChecks,
      },
    ],
    'محلل أمني': [
      {
        label: 'تنبيهات جديدة',
        value: data.alerts.filter(a => a.status === 'جديد').length,
        unit: 'سجلات مفصّلة',
        page: 'alerts',
        icon: BellRing,
      },
      {
        label: 'حوادث مسندة للشخص المعروض',
        value: assigned,
        unit: persona || 'لا يوجد مستخدم نشط',
        page: 'incidents',
        icon: UserRound,
      },
      {
        label: 'أصول قيد التأسيس',
        value: data.assets.filter(a => a.baseline === 'قيد التأسيس').length,
        unit: 'أصول في العينة',
        page: 'assets',
        icon: Boxes,
      },
    ],
    'مسؤول الاستجابة': [
      {
        label: 'طلبات موافقة معلّقة',
        value: pending,
        unit: 'تحتاج مراجعة بشرية',
        page: 'incidents',
        icon: ListChecks,
      },
      {
        label: 'حوادث قيد المعالجة',
        value: incidents.filter(x => x.status === 'قيد المعالجة').length,
        unit: 'حوادث في العينة',
        page: 'incidents',
        icon: ShieldAlert,
      },
      {
        label: 'حوادث مسندة للشخص المعروض',
        value: assigned,
        unit: persona || 'لا يوجد مستخدم نشط',
        page: 'incidents',
        icon: UserRound,
      },
    ],
    'قيادة المؤسسة': [
      {
        label: 'الحوادث المفتوحة',
        value: incidents.length,
        unit: 'حوادث في العينة',
        page: 'incidents',
        icon: ShieldAlert,
      },
      {
        label: 'الحوادث الحرجة المفتوحة',
        value: incidents.filter(x => x.severity === 'حرجة').length,
        unit: 'ضمن المفتوحة',
        page: 'incidents',
        icon: Activity,
      },
      {
        label: 'الحوادث المغلقة',
        value: data.incidents.filter(x => x.status === 'مغلقة').length,
        unit: 'حوادث في العينة',
        page: 'reports',
        icon: CheckCircle2,
      },
    ],
  }[role];
  return (
    <section className="role-focus" aria-label="معاينة لوحة حسب الدور">
      <div className="role-focus-head">
        <div className="role-focus-title">
          <span className="role-focus-icon">
            <info.icon size={19} />
          </span>
          <div>
            <span className="role-focus-overline">عرض مُكيّف للدور · تجريبي</span>
            <h2>{role}</h2>
            <p>{info.intro}</p>
          </div>
        </div>
        <div className="role-focus-picker">
          <label htmlFor="role-preview-select">معاينة الدور</label>
          <Select
            id="role-preview-select"
            value={role}
            onChange={setRole}
            ariaLabel="معاينة لوحة الدور"
          >
            <option value="مدير النظام">مدير النظام</option>
            <option value="محلل أمني">محلل أمني</option>
            <option value="مسؤول الاستجابة">مسؤول الاستجابة</option>
            <option value="قيادة المؤسسة">قيادة المؤسسة</option>
          </Select>
        </div>
      </div>
      <div className="role-focus-metrics">
        {metrics.map(m => (
          <button key={m.label} type="button" onClick={() => go(m.page)}>
            <span>
              <m.icon size={16} />
              {m.label}
            </span>
            <strong>{ar(m.value)}</strong>
            <small>{m.unit}</small>
            <ChevronLeft size={14} className="role-metric-arrow" />
          </button>
        ))}
      </div>
      <div className="role-focus-note">
        <CircleHelp size={14} />
        <span>
          {persona ? `الشخص في المعاينة: ${persona}.` : 'لا يوجد مستخدم نشط لهذا الدور في العينة.'}{' '}
          تغيير العرض لا يغيّر المستخدم أو الصلاحيات.
        </span>
      </div>
    </section>
  );
}

export function NeedsAttention({ data, role, go, openDetail, openModal, offlineSimulation }) {
  const [tab, setTab] = useState('all');
  const persona = data.users.find(u => u.role === role && u.status === 'نشط')?.name;
  const allOpen = data.incidents.filter(open),
    assigned = persona ? allOpen.filter(x => x.owner === persona) : [],
    pending = allOpen.filter(x => x.approval === 'بانتظار الموافقة');
  const union = allOpen.filter(
    x => (persona && x.owner === persona) || x.approval === 'بانتظار الموافقة',
  );
  const list = (tab === 'assigned' ? assigned : tab === 'approval' ? pending : union)
    .slice()
    .sort(
      (a, b) =>
        Number(b.approval === 'بانتظار الموافقة') - Number(a.approval === 'بانتظار الموافقة') ||
        b.score - a.score,
    );
  const tabs = [
    ['all', 'الكل', union.length],
    ['assigned', 'مسندة للشخص المعروض', assigned.length],
    ['approval', 'بانتظار الموافقة', pending.length],
  ];
  return (
    <Panel className="attention-panel">
      <PanelHeading
        title="يحتاج انتباهك"
        subtitle="حوادث الشخص المعروض وطلبات موافقة الفريق في العينة"
        icon={Clock3}
        aside={
          <button type="button" className="text-link" onClick={() => go('incidents')}>
            جميع الحوادث <ArrowLeft size={14} />
          </button>
        }
      />
      <div className="attention-tabs" role="group" aria-label="تصفية قائمة الانتباه">
        {tabs.map(([id, label, n]) => (
          <button
            type="button"
            key={id}
            className={tab === id ? 'active' : ''}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
            <b>{ar(n)}</b>
          </button>
        ))}
      </div>
      {list.length ? (
        <div className="attention-list">
          {list.slice(0, 5).map(item => (
            <div className="attention-row" key={item.id}>
              <button
                type="button"
                className="attention-main"
                onClick={() => openDetail('incident', item.id)}
              >
                <span
                  className={`attention-icon ${item.approval === 'بانتظار الموافقة' ? 'approval' : ''}`}
                >
                  {item.approval === 'بانتظار الموافقة' ? (
                    <ListChecks size={17} />
                  ) : (
                    <ShieldAlert size={17} />
                  )}
                </span>
                <span className="attention-copy">
                  <strong>{item.title}</strong>
                  <small>
                    <bdi dir="ltr">{item.id}</bdi> · <bdi dir="ltr">{item.asset}</bdi> ·{' '}
                    {item.owner}
                  </small>
                </span>
                <Severity value={item.severity} />
                <Status value={item.status} />
                <ChevronLeft size={16} />
              </button>
              {item.approval === 'بانتظار الموافقة' && (
                <div className="attention-approval">
                  <span>موافقة بشرية معلّقة · إجراء تجريبي</span>
                  <button
                    type="button"
                    onClick={() => openModal('approval', { id: item.id, mode: 'approve' })}
                    disabled={offlineSimulation}
                    title={
                      offlineSimulation
                        ? 'القراءة فقط أثناء محاكاة الانقطاع'
                        : 'مراجعة الطلب التجريبي'
                    }
                  >
                    مراجعة الطلب <ArrowLeft size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="لا توجد عناصر في هذا العرض"
          text={
            tab === 'assigned' && !persona
              ? 'لا يوجد مستخدم نشط لهذا الدور في العينة.'
              : 'لا توجد حوادث مطابقة في بيانات المثال.'
          }
        />
      )}
      <div className="attention-foot">
        {offlineSimulation
          ? 'محاكاة الانقطاع مفعّلة: مراجعة الموافقات للقراءة فقط.'
          : 'القائمة توضيحية؛ لا تحدد صلاحيات أو مهامًا فعلية.'}
      </div>
    </Panel>
  );
}
