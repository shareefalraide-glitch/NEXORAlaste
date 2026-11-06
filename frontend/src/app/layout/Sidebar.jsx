import React from 'react';
import { Activity, BookOpen, ChevronDown, ChevronLeft, Shield, X } from 'lucide-react';
import logoDark from '../../assets/nexora-logo-dark.png';
import logoLight from '../../assets/nexora-logo-light.png';

import { ar } from '../../shared/ui/index';

import { ariaBinding } from '../../shared/lib/preferences';
import { groups } from './navigation';
export function Sidebar({
  page,
  go,
  open,
  close,
  data,
  openModal,
  theme,
  preferences,
  startGuide,
}) {
  return (
    <>
      <div className={`sidebar-backdrop ${open ? 'show' : ''}`} onClick={close} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand-row">
          <button
            className="brand"
            onClick={() => go('overview')}
            aria-label="NEXORA الصفحة الرئيسية"
          >
            <img
              className="brand-logo nexora-wordmark"
              src={theme === 'light' ? logoLight : logoDark}
              alt="NEXORA"
            />
            <span>
              مركز العمليات الأمنية <i />
            </span>
          </button>
          <button
            type="button"
            className="sidebar-close"
            aria-label="إغلاق القائمة"
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>
        <button
          className="workspace-selector"
          title="تفاصيل مساحة العمل"
          onClick={() => openModal('workspace')}
        >
          <span className="workspace-mark">
            <Shield size={16} />
          </span>
          <span>
            <strong>مساحة العمل</strong>
            <small>المؤسسة التجريبية</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <nav id="primary-navigation" className="sidebar-nav" aria-label="التنقل الرئيسي">
          {groups.map(group => (
            <div className="nav-group" key={group.title}>
              <div className="nav-group-title">{group.title}</div>
              {group.items.map(item => (
                <button
                  key={item.id}
                  className={`nav-item ${page === item.id ? 'active' : ''}`}
                  aria-current={page === item.id ? 'page' : undefined}
                  aria-keyshortcuts={ariaBinding(preferences.shortcuts[item.id])}
                  onClick={() => go(item.id)}
                >
                  <item.icon size={17} strokeWidth={1.8} />
                  <span>{item.label}</span>
                  {item.id === 'alerts' && <b>{ar(data.alerts.length)}</b>}
                  {item.id === 'incidents' && (
                    <b className="orange-badge">
                      {ar(
                        data.incidents.filter(x => !['مغلقة', 'إنذار كاذب'].includes(x.status))
                          .length,
                      )}
                    </b>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <button type="button" className="sidebar-guide" onClick={() => startGuide('resume', true)}>
          <span className="sidebar-guide-icon">
            <BookOpen size={17} />
          </span>
          <span>
            <strong>الدليل التفاعلي</strong>
            <small>تعرّف على المنصة</small>
          </span>
          <ChevronLeft size={15} />
        </button>
        <div className="sidebar-footer">
          <div className="sidebar-foot-icon">
            <Activity size={17} />
          </div>
          <div>
            <strong>بيئة تجريبية</strong>
            <span>لا يوجد اتصال بخادم</span>
          </div>
          <span className="sidebar-status" />
        </div>
      </aside>
    </>
  );
}
