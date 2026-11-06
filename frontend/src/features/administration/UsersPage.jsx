import React, { useState } from 'react';
import { KeyRound, Plus, UserCog } from 'lucide-react';
import {
  ar,
  Avatar,
  Button,
  InfoBox,
  PageHeading,
  Panel,
  PanelHeading,
  SearchInput,
  Select,
  Status,
  Table,
  Tag,
} from '../../shared/ui/index';
import { roles } from '../../data/fixtures/demo-records';

import { includes } from './AdministrationTable';
const permissionAreas = [
  'لوحة المؤشرات',
  'التنبيهات',
  'الحوادث',
  'التقارير',
  'سجل التدقيق',
  'إدارة المنصة',
];
const permissionRoles = [
  ['مدير النظام', 'إدارة', 'إدارة', 'إدارة', 'قراءة', 'قراءة', 'إدارة'],
  ['محلل أمني', 'قراءة', 'معالجة', 'معالجة', '—', '—', '—'],
  ['مسؤول الاستجابة', 'قراءة', 'قراءة', 'معالجة', 'قراءة', '—', '—'],
  ['مسؤول التدقيق', '—', '—', '—', 'قراءة', 'قراءة', '—'],
  ['قيادة المؤسسة', 'قراءة', '—', '—', 'قراءة', '—', '—'],
];
function RolePermissionPreview() {
  const [left, setLeft] = useState('محلل أمني'),
    [right, setRight] = useState('مسؤول الاستجابة');
  const rows = [left, right].map(role => permissionRoles.find(row => row[0] === role));
  return (
    <details className="experience-module role-compare">
      <summary>
        <span>
          <span className="experience-module-icon">
            <UserCog size={19} />
          </span>
          <span>
            <strong>مقارنة دورين</strong>
            <small>استعرض الصلاحيات المقترحة جنبًا إلى جنب</small>
          </span>
        </span>
        <Tag color="blue">معاينة فقط</Tag>
      </summary>
      <div className="experience-module-body">
        <InfoBox>
          المقارنة من مصفوفة الأدوار التوضيحية أدناه. تغيير الدور هنا لا يغيّر الحساب أو الصلاحيات،
          ولا توجد حماية أو تفويض فعلي في الواجهة.
        </InfoBox>
        <div className="role-compare-selectors">
          {[
            [left, setLeft, 'الدور الأول للمقارنة'],
            [right, setRight, 'الدور الثاني للمقارنة'],
          ].map(([value, setValue, label]) => (
            <label key={label}>
              {label}
              <select
                aria-label={label}
                value={value}
                onChange={event => setValue(event.target.value)}
              >
                {permissionRoles.map(row => (
                  <option key={row[0]} value={row[0]}>
                    {row[0]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="role-compare-grid" role="group" aria-label="مقارنة الصلاحيات المقترحة">
          {permissionAreas.map((area, i) => (
            <div key={area}>
              <strong>{area}</strong>
              {rows.map((row, j) => (
                <span key={j}>
                  <small>{row[0]}</small>
                  <b>{row[i + 1] === '—' ? 'غير مقترحة' : row[i + 1]}</b>
                </span>
              ))}
            </div>
          ))}
        </div>
        <p className="experience-footnote">
          المصفوفة تصور أولي وليست سياسة أمان أو التحقق من صلاحيات المستخدم.
        </p>
      </div>
    </details>
  );
}
export function UsersPage({ data, openModal, update }) {
  const [q, setQ] = useState(''),
    [role, setRole] = useState('all'),
    [tab, setTab] = useState('users');
  const rows = data.users.filter(x => includes(x, q) && (role === 'all' || x.role === role));
  return (
    <>
      <PageHeading
        title="المستخدمون والأدوار"
        subtitle="نظّم وصول فريق العمليات بحسب المسؤوليات المحددة."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => openModal('newUser')}>
            إضافة مستخدم
          </Button>
        }
      />
      <div className="permission-note">
        <KeyRound size={17} />
        <span>تمثيل بصري فقط؛ يجب تطبيق المصادقة والتفويض الفعليين على الخادم لاحقًا.</span>
      </div>
      <div className="tabs page-tabs">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
          المستخدمون <span>{ar(data.users.length)}</span>
        </button>
        <button className={tab === 'roles' ? 'active' : ''} onClick={() => setTab('roles')}>
          الأدوار والصلاحيات
        </button>
      </div>
      {tab === 'users' ? (
        <Panel className="data-panel">
          <PanelHeading title="أعضاء الفريق" subtitle="الحسابات التجريبية في مساحة العمل" />
          <div className="filter-bar">
            <SearchInput value={q} onChange={setQ} placeholder="بحث بالاسم أو البريد الإلكتروني" />
            <div className="filter-controls">
              <Select value={role} onChange={setRole} ariaLabel="الدور">
                <option value="all">كل الأدوار</option>
                {roles.map(r => (
                  <option key={r.name}>{r.name}</option>
                ))}
              </Select>
              <button
                className="reset-filter"
                onClick={() => {
                  setQ('');
                  setRole('all');
                }}
              >
                إعادة ضبط
              </button>
            </div>
          </div>
          <Table head={['المستخدم', 'الدور', 'الحالة', 'آخر نشاط', '']} empty={!rows.length}>
            {rows.map((x, i) => (
              <tr key={x.id}>
                <td>
                  <div className="user-cell">
                    <Avatar name={x.name} tone={i % 2 ? 'purple' : 'blue'} />
                    <div>
                      <strong>{x.name}</strong>
                      <small dir="ltr">{x.email}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <Tag color={roles.find(r => r.name === x.role)?.color || 'neutral'}>{x.role}</Tag>
                </td>
                <td>
                  <Status value={x.status} />
                </td>
                <td className="cell-muted">{x.last}</td>
                <td>
                  <Button onClick={() => openModal('editUser', x)}>تعديل</Button>
                </td>
              </tr>
            ))}
          </Table>
          <div className="table-footer">
            عرض {ar(rows.length)} من {ar(data.users.length)} مستخدمين تجريبيين
          </div>
        </Panel>
      ) : (
        <>
          <RolePermissionPreview />
          <div className="roles-grid">
            {roles.map(r => (
              <Panel className="role-card" key={r.name}>
                <span className={`feature-card-icon ${r.color}`}>
                  <UserCog size={20} />
                </span>
                <h2>{r.name}</h2>
                <p>{r.desc}</p>
                <div className="role-count">
                  {ar(data.users.filter(x => x.role === r.name).length)} مستخدم في العينة
                </div>
              </Panel>
            ))}
            <InfoBox title="مبدأ أقل صلاحية">
              لا يكفي إخفاء عناصر الواجهة لتطبيق الصلاحيات؛ يجب التحقق على الخادم لكل مورد وعملية.
            </InfoBox>
            <Panel className="permission-matrix">
              <PanelHeading
                title="مقارنة الأدوار المقترحة"
                subtitle="تصوّر بصري للمراجعة عند ربط نظام الصلاحيات"
                icon={KeyRound}
              />
              <Table
                head={[
                  'الدور',
                  'لوحة المؤشرات',
                  'التنبيهات',
                  'الحوادث',
                  'التقارير',
                  'سجل التدقيق',
                  'إدارة المنصة',
                ]}
              >
                {permissionRoles.map(row => (
                  <tr key={row[0]}>
                    {row.map((cell, i) => (
                      <td key={i}>
                        {i === 0 ? (
                          <strong>{cell}</strong>
                        ) : (
                          <span className={cell === '—' ? 'matrix-empty' : 'matrix-value'}>
                            {cell}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </Table>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
