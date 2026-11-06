import React from 'react';
import {
  ArrowLeft,
  ChevronDown,
  CircleHelp,
  LogOut,
  Menu,
  Search,
  Shield,
  Sparkles,
  UserCog,
} from 'lucide-react';
import { Avatar, IconButton } from '../../shared/ui/index';
import NotificationCenter from '../../features/notifications/NotificationCenter';
import { ariaBinding, formatBinding } from '../../shared/lib/preferences';
import { pages } from './navigation';
import { ThemeButton } from './ThemeButton';

export function AppHeader({
  page,
  canGoBack,
  sideOpen,
  setSideOpen,
  goBack,
  preferences,
  openModal,
  theme,
  toggleTheme,
  data,
  notifications,
  setNotifications,
  menu,
  setMenu,
  offlineSimulation,
  openDetail,
  go,
  logout,
}) {
  return (
    <header className="topbar">
      <div className={`topbar-start ${canGoBack ? 'has-page-back' : ''}`}>
        <IconButton
          className="mobile-menu"
          icon={Menu}
          label="فتح القائمة"
          aria-controls="primary-navigation"
          aria-expanded={sideOpen}
          onClick={() => setSideOpen(true)}
        />
        {canGoBack && (
          <IconButton
            className="page-back"
            icon={ArrowLeft}
            label="العودة للصفحة السابقة"
            onClick={goBack}
          />
        )}
        <div className="breadcrumbs">
          <span>مساحة العمل</span>
          <ChevronDown className="crumb-chevron" size={13} />
          <strong>{pages[page]}</strong>
        </div>
      </div>
      <div className="topbar-actions">
        <button
          className="top-search"
          aria-label="البحث في المنصة"
          aria-keyshortcuts={ariaBinding(preferences.shortcuts.search)}
          title={
            preferences.shortcuts.search
              ? `البحث في المنصة · ${formatBinding(preferences.shortcuts.search)} خارج حقول الكتابة`
              : 'البحث في المنصة · الاختصار معطّل'
          }
          onClick={() => openModal('search')}
        >
          <Search size={16} />
          <span>ابحث في المنصة...</span>
          {preferences.shortcuts.search && (
            <kbd dir="ltr">{formatBinding(preferences.shortcuts.search)}</kbd>
          )}
        </button>
        <span className="demo-pill">
          <i /> نسخة تجريبية
        </span>
        <IconButton
          icon={Sparkles}
          label="المساعد التجريبي"
          className="copilot-button"
          onClick={() => openModal('copilot')}
        />
        <ThemeButton theme={theme} onClick={toggleTheme} />
        <span className="topbar-divider" />
        <NotificationCenter
          data={data}
          shortcut={ariaBinding(preferences.shortcuts.notifications)}
          items={notifications}
          setItems={setNotifications}
          expanded={menu === 'notifications'}
          onToggle={() => setMenu(menu === 'notifications' ? '' : 'notifications')}
          onOpen={item => {
            setMenu('');
            const record = data.incidents.find(x => x.id === item.entityId);
            if (
              item.category === 'approval' &&
              record?.approval === 'بانتظار الموافقة' &&
              !offlineSimulation
            )
              openModal('approval', { id: item.entityId, mode: 'approve' });
            else openDetail(item.kind, item.entityId);
          }}
        />
        <IconButton
          icon={CircleHelp}
          label="المساعدة"
          className="help-button"
          onClick={() => openModal('help')}
        />
        <span className="topbar-divider" />
        <div className="popover-anchor">
          <button
            className="profile-button"
            aria-label="قائمة الحساب"
            aria-expanded={menu === 'profile'}
            onClick={() => setMenu(menu === 'profile' ? '' : 'profile')}
          >
            <Avatar />
            <span>
              <strong>أحمد علي</strong>
              <small>مدير النظام</small>
            </span>
            <ChevronDown size={14} />
          </button>
          {menu === 'profile' && (
            <div className="popover profile-popover">
              <div className="profile-popover-head">
                <Avatar />
                <span>
                  <strong>أحمد علي</strong>
                  <small>حساب تجريبي</small>
                </span>
              </div>
              <button onClick={() => go('users')}>
                <UserCog size={16} /> المستخدمون والأدوار
              </button>
              <button onClick={() => openModal('about')}>
                <Shield size={16} /> عن المنصة
              </button>
              <button onClick={logout}>
                <LogOut size={16} /> تسجيل الخروج التجريبي
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
