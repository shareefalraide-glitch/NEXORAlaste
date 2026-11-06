import { useDemoActions } from './state/useDemoActions';
import { apiClient } from '../services/api-client';
import ApiWorkspace from '../features/api/ApiWorkspace';

const API_MODE = import.meta.env.VITE_NEXORA_AUTH_MODE === 'api';
import { PageContent } from './PageContent';
import { AppHeader } from './layout/AppHeader';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { Check, WifiOff, X } from 'lucide-react';

import {
  initialAlerts,
  initialAssets,
  initialAudit,
  initialIncidents,
  initialIocs,
  initialRules,
  initialUsers,
  sourceCards,
} from '../data/fixtures/demo-records';

import { Button, InfoBox, Modal } from '../shared/ui/index';
import { commandPages } from './layout/navigation';
import { Sidebar } from './layout/Sidebar';

import { applyTheme } from './layout/theme';

import AssetImport from '../features/assets/AssetImport';
import Auth from '../features/auth/Auth';

import Details from '../features/investigations/details/Details';
import SplitInvestigation from '../features/investigations/workspace/SplitInvestigation';
import BatchTriage from '../features/alerts/BatchTriage';

import {
  initialInvestigationTabs,
  investigationTabsReducer,
} from '../features/investigations/workspace/investigation-tabs';
import Dialogs from './dialogs/Dialogs';
import ExportDialog from '../features/export/ExportDialog';
import { initialNotifications } from '../features/notifications/NotificationCenter';
import { guideSteps, initialGuide } from '../features/guide/guide-data';
import GuideTour from '../features/guide/GuideTour';

import GlobalTimeBar from '../shared/components/GlobalTimeBar';
import {
  PREFS_KEY,
  bindingMatches,
  loadPreferences,
  shortcutActions,
} from '../shared/lib/preferences';

const initialData = () =>
  JSON.parse(
    JSON.stringify({
      incidents: initialIncidents,
      alerts: initialAlerts,
      assets: initialAssets,
      rules: initialRules,
      iocs: initialIocs,
      users: initialUsers,
      audit: initialAudit,
      sources: sourceCards,
    }),
  );

// Use a physical key so the shortcut also works with Arabic keyboard layouts.
const isEditableTarget = target =>
  target instanceof Element &&
  (target.isContentEditable ||
    !!target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
    ));

export default function App() {
  const [data, setData] = useState(initialData),
    [page, setPage] = useState('overview'),
    [modal, setModal] = useState(null),
    [menu, setMenu] = useState(''),
    [sideOpen, setSideOpen] = useState(false),
    [loggedIn, setLoggedIn] = useState(false),
    [apiUser, setApiUser] = useState(null),
    [pendingNavigation, setPendingNavigation] = useState(null),
    [undoEntry, setUndoEntry] = useState(null),
    [exportRequest, setExportRequest] = useState(null),
    [notifications, setNotifications] = useState(initialNotifications),
    [guide, setGuide] = useState(initialGuide),
    [tourIndex, setTourIndex] = useState(null),
    [tourIntro, setTourIntro] = useState(null),
    [offlineSimulation, setOfflineSimulation] = useState(false),
    [toast, setToast] = useState(null),
    [theme, setTheme] = useState(() =>
      document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
    ),
    [preferences, setPreferences] = useState(loadPreferences),
    [investigations, setInvestigations] = useState({}),
    [ruleDrafts, setRuleDrafts] = useState({}),
    [handoverDraft, setHandoverDraft] = useState({ from: '', to: '', note: '', reviewed: false }),
    [copilotHistory, setCopilotHistory] = useState([]),
    [triageRecords, setTriageRecords] = useState({}),
    [timeRange, setTimeRange] = useState('24h');
  const [detailState, dispatchDetail] = useReducer(
    investigationTabsReducer,
    undefined,
    initialInvestigationTabs,
  );
  const drawerStack = detailState.stack;
  const setDrawerStack = useCallback(value => dispatchDetail({ type: 'set-stack', value }), []);
  const switchInvestigation = useCallback(id => dispatchDetail({ type: 'switch', id }), []);
  const pinInvestigation = useCallback(id => dispatchDetail({ type: 'pin', id }), []);
  const removeInvestigation = useCallback(id => dispatchDetail({ type: 'remove', id }), []);
  const cancelRemoveInvestigation = useCallback(
    () => dispatchDetail({ type: 'cancel-remove' }),
    [],
  );
  const settingsDirty = useRef(false),
    tourOrigin = useRef(null),
    sessionRef = useRef({}),
    pageRef = useRef(page),
    navHistory = useRef([]),
    pendingScroll = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false),
    [presentation, setPresentation] = useState(false);
  pageRef.current = page;
  const [splitInitial, setSplitInitial] = useState(null),
    splitRef = useRef(null);
  const openSplit = useCallback(
    (firstId, secondId) => {
      if (!firstId || !secondId || firstId === secondId) return;
      const first = detailState.tabs.find(tab => tab.id === firstId),
        second = detailState.tabs.find(tab => tab.id === secondId);
      if (!first || !second) return;
      const value = {
        panes: [first, second].map(tab => ({
          id: tab.id,
          stack: tab.stack.map(entry => ({ ...entry })),
        })),
        active: 0,
      };
      splitRef.current = value;
      setSplitInitial(value);
    },
    [detailState.tabs],
  );
  const updateSplit = useCallback(value => {
    splitRef.current = value;
  }, []);
  const closeSplit = useCallback(() => {
    const value = splitRef.current;
    if (value)
      dispatchDetail({
        type: 'merge-panes',
        panes: value.panes,
        activeId: value.panes[value.active]?.id,
      });
    splitRef.current = null;
    setSplitInitial(null);
  }, []);

  const updateSettingsDirty = useCallback(value => {
    settingsDirty.current = value;
  }, []);
  const toggleTheme = useCallback(
    () =>
      setTheme(current => {
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        return next;
      }),
    [],
  );
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  // Persist this small UI preference before paint so a quick reload cannot race the hide action.
  useLayoutEffect(() => {
    try {
      localStorage.setItem('nexora-ui-guide', JSON.stringify(guide));
    } catch {}
  }, [guide]);
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
    } catch {}
  }, [preferences]);
  const notify = useCallback((text, type = 'success') => {
    setToast({ text, type, key: Date.now() });
  }, []);
  useEffect(() => {
    if (detailState.error) {
      notify(detailState.error, 'error');
      dispatchDetail({ type: 'clear-error' });
    }
  }, [detailState.error, notify]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  const performGo = useCallback((id, forTour = false) => {
    if (splitRef.current) closeSplit();
    if (id !== 'overview') setPresentation(false);
    const previous = pageRef.current;
    if (id !== previous && !forTour) {
      navHistory.current = [
        ...navHistory.current.slice(-29),
        { page: previous, scroll: window.scrollY },
      ];
      setCanGoBack(true);
    }
    pageRef.current = id;
    pendingScroll.current = forTour ? null : 0;
    setPage(id);
    settingsDirty.current = false;
    setDrawerStack([]);
    setModal(null);
    setMenu('');
    setSideOpen(false);
    if (id === previous) {
      pendingScroll.current = null;
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);
  const performBack = useCallback(() => {
    if (splitRef.current) closeSplit();
    const previous = navHistory.current.pop();
    if (!previous) return;
    if (previous.page !== 'overview') setPresentation(false);
    setCanGoBack(navHistory.current.length > 0);
    const same = pageRef.current === previous.page;
    pageRef.current = previous.page;
    pendingScroll.current = previous.scroll;
    settingsDirty.current = false;
    setPage(previous.page);
    setDrawerStack([]);
    setModal(null);
    setMenu('');
    setSideOpen(false);
    if (same) {
      window.scrollTo({ top: previous.scroll, behavior: 'auto' });
      pendingScroll.current = null;
    }
  }, []);
  const goBack = useCallback(() => {
    if (pageRef.current === 'settings' && settingsDirty.current) {
      setPendingNavigation({ kind: 'back' });
      return;
    }
    performBack();
  }, [performBack]);
  useLayoutEffect(() => {
    if (pendingScroll.current !== null) {
      window.scrollTo({ top: pendingScroll.current, behavior: 'auto' });
      pendingScroll.current = null;
    }
  }, [page]);
  const go = useCallback(
    id => {
      if (page === 'settings' && settingsDirty.current && id !== 'settings') {
        setPendingNavigation({ kind: 'page', id });
        setMenu('');
        setSideOpen(false);
        return;
      }
      performGo(id);
    },
    [page, performGo],
  );
  // Opening example detail drawers is read-only. Only an explicit confirmation
  // may discard dirty settings before the tour changes pages.
  const enterGuideStep = useCallback(
    (next, reset = false) => {
      const step = guideSteps[next];
      if (!step) return;
      if (page !== step.page) performGo(step.page, true);
      else {
        setDrawerStack([]);
        setModal(null);
        setMenu('');
        setSideOpen(false);
      }
      if (step.detail) {
        const collection = { alert: 'alerts', incident: 'incidents', asset: 'assets' }[step.detail],
          record = data[collection]?.[0];
        if (record)
          setDrawerStack([
            {
              kind: step.detail,
              id: record.id,
              key: `tour-${step.detail}-${record.id}-${Date.now()}`,
            },
          ]);
      }
      setTourIndex(next);
      setGuide(current => ({
        ...current,
        version: 2,
        visible: true,
        finished: false,
        lastStep: step.id,
        visited: reset
          ? [step.id]
          : current.visited.includes(step.id)
            ? current.visited
            : [...current.visited, step.id],
      }));
    },
    [page, data, performGo],
  );
  const restoreTourFocus = useCallback(
    () =>
      requestAnimationFrame(() => {
        const candidates = [
          document.querySelector('.detail-layer-active .drawer [data-dialog-autofocus]'),
          tourOrigin.current,
          document.querySelector('.mobile-menu'),
          document.querySelector('.sidebar-guide'),
        ];
        const target = candidates.find(el => {
          if (!el?.isConnected || !el.getClientRects().length || el.closest('[inert]'))
            return false;
          const r = el.getBoundingClientRect();
          return (
            r.bottom > 0 &&
            r.right > 0 &&
            r.top < innerHeight &&
            r.left < innerWidth &&
            getComputedStyle(el).visibility !== 'hidden'
          );
        });
        target?.focus({ preventScroll: true });
      }),
    [],
  );
  const cancelPendingNavigation = useCallback(() => {
    setPendingNavigation(null);
    if (pendingNavigation?.kind === 'guide') restoreTourFocus();
  }, [pendingNavigation, restoreTourFocus]);
  const startGuide = useCallback(
    (mode = 'resume', fromSidebar = false) => {
      const reset = mode === 'restart' || guide.finished;
      const saved = guideSteps.findIndex(step => step.id === guide.lastStep),
        next = reset ? 0 : Math.max(0, saved);
      tourOrigin.current = document.activeElement;
      if (page === 'settings' && settingsDirty.current) {
        setPendingNavigation({ kind: 'guide', index: next, reset });
        setMenu('');
        setSideOpen(false);
        return;
      }
      if (fromSidebar) {
        setTourIntro({ index: next, reset });
        setMenu('');
        setSideOpen(false);
        return;
      }
      enterGuideStep(next, reset);
    },
    [guide.finished, guide.lastStep, page, enterGuideStep],
  );
  const pauseGuide = useCallback(() => {
    setTourIndex(null);
    restoreTourFocus();
  }, [restoreTourFocus]);
  const skipGuide = useCallback(() => {
    setGuide(current => ({ ...current, visible: false }));
    setTourIndex(null);
    restoreTourFocus();
  }, [restoreTourFocus]);
  const finishGuide = useCallback(() => {
    setGuide(current => ({ ...current, finished: true }));
    setTourIndex(null);
    restoreTourFocus();
  }, [restoreTourFocus]);
  const cancelTourIntro = useCallback(() => {
    setTourIntro(null);
    restoreTourFocus();
  }, [restoreTourFocus]);
  useEffect(() => {
    const handler = e => {
      if (settingsDirty.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
  const openDetail = useCallback((kind, id) => {
    dispatchDetail({
      type: 'open',
      selection: {
        kind,
        id,
        key: `${kind}-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
    setMenu('');
    setSideOpen(false);
  }, []);
  const backDetail = useCallback(() => setDrawerStack(prev => prev.slice(0, -1)), []);
  const jumpDetail = useCallback(index => setDrawerStack(prev => prev.slice(0, index + 1)), []);
  const openModal = useCallback(
    (type, payload = {}) => {
      const writes = [
        'transition',
        'falsePositive',
        'approval',
        'newAsset',
        'editAsset',
        'assetInterface',
        'deleteInterface',
        'importAssets',
        'newUser',
        'editUser',
        'newRule',
        'importIoc',
        'addSource',
        'editSource',
        'createFromAlert',
        'newIncident',
        'modelAction',
        'bulkReview',
        'bulkAssign',
        'independentTriage',
      ];
      if (offlineSimulation && writes.includes(type)) {
        notify('محاكاة عدم الاتصال: العرض للقراءة فقط', 'error');
        return;
      }
      setModal({ type, payload, key: Date.now() });
      setMenu('');
      setSideOpen(false);
    },
    [offlineSimulation, notify],
  );
  const closeModal = useCallback(() => setModal(null), []);
  const closeDrawer = useCallback(() => setDrawerStack([]), []);
  // Focus and keyboard stay inside the mobile drawer until it is closed.
  useEffect(() => {
    if (!sideOpen) return;
    const sidebar = document.querySelector('.sidebar'),
      trigger = document.querySelector('.mobile-menu');
    const focusable = () =>
      Array.from(sidebar?.querySelectorAll('button:not([disabled]),a[href]') || []).filter(
        el => el.getClientRects().length,
      );
    const frame = requestAnimationFrame(() => focusable()[0]?.focus());
    const handleTab = e => {
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleTab);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleTab);
      if (!document.querySelector('.overlay') && trigger?.getClientRects().length) trigger.focus();
    };
  }, [sideOpen]);
  useEffect(() => {
    const mq = window.matchMedia('(min-width:761px)');
    const closeWide = () => {
      if (mq.matches) setSideOpen(false);
    };
    mq.addEventListener('change', closeWide);
    return () => mq.removeEventListener('change', closeWide);
  }, []);
  useEffect(() => {
    const handler = e => {
      if (!loggedIn) return;
      if (
        !e.defaultPrevented &&
        !e.repeat &&
        !e.isComposing &&
        !isEditableTarget(e.target) &&
        !modal &&
        !pendingNavigation &&
        !exportRequest &&
        !tourIntro &&
        tourIndex === null
      ) {
        const match = shortcutActions.find(action =>
          bindingMatches(e, preferences.shortcuts[action.id]),
        );
        if (match && (!drawerStack.length || match.id === 'search')) {
          e.preventDefault();
          if (match.id === 'search') openModal('search');
          else if (match.id === 'notifications') {
            setMenu(current => (current === 'notifications' ? '' : 'notifications'));
            setSideOpen(false);
          } else go(match.id);
        }
      }
      if (e.key === 'Escape') {
        setMenu('');
        setSideOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    openModal,
    go,
    loggedIn,
    modal,
    pendingNavigation,
    exportRequest,
    preferences.shortcuts,
    drawerStack.length,
    tourIntro,
    tourIndex,
  ]);
  const { update, submitTriage, submitTriageBatch, bulkAlerts, undoLast, add, createIncident } =
    useDemoActions({
      data,
      setData,
      triageRecords,
      setTriageRecords,
      offlineSimulation,
      notify,
      setNotifications,
      undoEntry,
      setUndoEntry,
      performGo,
      dispatchDetail,
    });
  const exportData = useCallback(
    (name, rows, options = {}) => {
      if (!rows?.length && !options.allRows?.length) {
        notify('لا توجد بيانات للتصدير', 'error');
        return;
      }
      setExportRequest({ name, rows: rows || [], ...options, key: Date.now() });
    },
    [notify],
  );
  const closeExport = useCallback(() => setExportRequest(null), []);
  const performLogout = useCallback(() => {
    splitRef.current = null;
    setSplitInitial(null);
    setLoggedIn(false);
    setPresentation(false);
    setData(initialData());
    setOfflineSimulation(false);
    sessionRef.current = {};
    navHistory.current = [];
    pageRef.current = 'overview';
    pendingScroll.current = null;
    setCanGoBack(false);
    setPage('overview');
    settingsDirty.current = false;
    setUndoEntry(null);
    setExportRequest(null);
    setNotifications(initialNotifications());
    setGuide(initialGuide());
    setTourIndex(null);
    setTourIntro(null);
    setInvestigations({});
    setRuleDrafts({});
    setHandoverDraft({ from: '', to: '', note: '', reviewed: false });
    setCopilotHistory([]);
    setTriageRecords({});
    setTimeRange('24h');
    dispatchDetail({ type: 'reset' });
    setModal(null);
    setMenu('');
    notify('تم مسح التعديلات المؤقتة للدخول التجريبي');
  }, [notify]);
  const logout = () => {
    if (page === 'settings' && settingsDirty.current) {
      setMenu('');
      setPendingNavigation({ kind: 'logout' });
      return;
    }
    performLogout();
  };
  const confirmPendingNavigation = () => {
    const next = pendingNavigation;
    setPendingNavigation(null);
    if (next?.kind === 'logout') performLogout();
    else if (next?.kind === 'page') performGo(next.id);
    else if (next?.kind === 'back') performBack();
    else if (next?.kind === 'guide') enterGuideStep(next.index, next.reset);
  };
  const login = useCallback(
    async credentials => {
      if (API_MODE) {
        const user = await apiClient.login(credentials);
        setApiUser(user);
        setLoggedIn(true);
        window.scrollTo({ top: 0, behavior: 'auto' });
        notify(`تم تسجيل الدخول إلى المؤسسة · ${user.role}`);
        return user;
      }
      setLoggedIn(true);
      window.scrollTo({ top: 0, behavior: 'auto' });
      notify('مرحبًا بك في العرض التجريبي');
      return null;
    },
    [notify],
  );
  const logoutApi = useCallback(
    async revoke => {
      let revocationFailed = false;
      try {
        if (revoke) await apiClient.logout();
      } catch {
        revocationFailed = true;
        apiClient.clear();
      } finally {
        setApiUser(null);
        setLoggedIn(false);
        setData(initialData());
      }
      if (revocationFailed)
        notify('مُسحت الجلسة محليًا، لكن تعذّر تأكيد إبطالها على الخادم.', 'error');
    },
    [notify],
  );

  if (API_MODE && loggedIn && apiUser) return <ApiWorkspace user={apiUser} onLogout={logoutApi} />;

  if (!loggedIn)
    return (
      <>
        <Auth
          mode={API_MODE ? 'api' : 'demo'}
          theme={theme}
          toggleTheme={toggleTheme}
          onLogin={login}
        />
        {toast && (
          <div className={`toast ${toast.type}`} role="status">
            <Check size={16} />
            {toast.text}
          </div>
        )}
      </>
    );
  const workspaceTabs = {
    state: detailState,
    onOpen: openDetail,
    onSwitch: switchInvestigation,
    onPin: pinInvestigation,
    onRemove: removeInvestigation,
    onSplit: openSplit,
  };
  const common = {
    data,
    go,
    openDetail,
    openModal,
    update,
    add,
    bulkAlerts,
    notify,
    exportData,
    sessionRef,
    workspaceTabs,
    presentation,
    setPresentation,
    offlineSimulation,
    setOfflineSimulation,
    guide,
    setGuide,
    startGuide,
    preferences,
    setPreferences,
    timeRange,
    setTimeRange,
    investigations,
    setInvestigations,
    ruleDrafts,
    setRuleDrafts,
    handoverDraft,
    setHandoverDraft,
  };
  const content = (
    <PageContent
      page={page}
      common={common}
      tourActive={tourIndex !== null}
      onSettingsDirtyChange={updateSettingsDirty}
    />
  );
  return (
    <div
      className={`app-shell ${presentation ? 'presentation-mode' : ''}`}
      dir="rtl"
      data-density={preferences.density}
    >
      <Sidebar
        page={page}
        go={go}
        open={sideOpen}
        close={() => setSideOpen(false)}
        data={data}
        openModal={openModal}
        theme={theme}
        preferences={preferences}
        startGuide={startGuide}
      />
      <main className="main-shell">
        <AppHeader
          page={page}
          canGoBack={canGoBack}
          sideOpen={sideOpen}
          setSideOpen={setSideOpen}
          goBack={goBack}
          preferences={preferences}
          openModal={openModal}
          theme={theme}
          toggleTheme={toggleTheme}
          data={data}
          notifications={notifications}
          setNotifications={setNotifications}
          menu={menu}
          setMenu={setMenu}
          offlineSimulation={offlineSimulation}
          openDetail={openDetail}
          go={go}
          logout={logout}
        />
        <GlobalTimeBar value={timeRange} onChange={setTimeRange} />
        {offlineSimulation && (
          <div className="offline-banner" role="status">
            <WifiOff size={16} />
            <span>
              <strong>محاكاة انقطاع الاتصال</strong> · العرض للقراءة فقط، والإجراءات غير متاحة حتى
              إنهاء المحاكاة.
            </span>
            <button onClick={() => setOfflineSimulation(false)}>إنهاء المحاكاة</button>
          </div>
        )}
        <div className="content-area" key={page}>
          {content}
        </div>
        <footer className="app-footer">
          <span>© NEXORA · مركز العمليات الأمنية</span>
          <span>واجهة تجريبية مبنية على تقرير المشروع</span>
        </footer>
        {tourIndex !== null && <div className="tour-scroll-spacer" aria-hidden="true" />}
      </main>

      {!splitInitial &&
        drawerStack.map((selection, index) => (
          <div
            key={selection.key}
            className={
              index === drawerStack.length - 1 ? 'detail-layer-active' : 'detail-layer-hidden'
            }
            aria-hidden={index === drawerStack.length - 1 ? undefined : true}
          >
            <Details
              selection={selection}
              history={drawerStack.slice(0, index + 1)}
              onBack={backDetail}
              onJump={jumpDetail}
              data={data}
              onClose={closeDrawer}
              openModal={openModal}
              openDetail={openDetail}
              update={update}
              offlineSimulation={offlineSimulation}
              investigations={investigations}
              setInvestigations={setInvestigations}
              triageRecords={triageRecords}
              submitTriage={submitTriage}
              timeRange={timeRange}
              workspaceTabs={workspaceTabs}
              sessionRef={sessionRef}
              tourExample={!!selection.key?.startsWith('tour-')}
            />
          </div>
        ))}
      {splitInitial && (
        <SplitInvestigation
          initial={splitInitial}
          onChange={updateSplit}
          onClose={closeSplit}
          data={data}
          sessionRef={sessionRef}
          openModal={openModal}
          update={update}
          offlineSimulation={offlineSimulation}
          investigations={investigations}
          setInvestigations={setInvestigations}
          triageRecords={triageRecords}
          submitTriage={submitTriage}
          timeRange={timeRange}
        />
      )}
      {modal &&
        (modal.type === 'independentTriage' ? (
          <BatchTriage
            key={modal.key}
            ids={modal.payload.ids || []}
            alerts={data.alerts}
            history={triageRecords}
            sessionRef={sessionRef}
            onClose={closeModal}
            onComplete={modal.payload.onComplete}
            submit={submitTriageBatch}
            offlineSimulation={offlineSimulation}
          />
        ) : modal.type === 'importAssets' ? (
          <AssetImport key={modal.key} data={data} add={add} close={closeModal} />
        ) : (
          <Dialogs
            key={`${modal.type}-${modal.key}`}
            modal={modal}
            close={closeModal}
            data={data}
            update={update}
            add={add}
            bulkAlerts={bulkAlerts}
            createIncident={createIncident}
            notify={notify}
            go={go}
            openDetail={openDetail}
            openModal={openModal}
            exportData={exportData}
            timeRange={timeRange}
            copilotHistory={copilotHistory}
            setCopilotHistory={setCopilotHistory}
            offlineSimulation={offlineSimulation}
            pageOptions={commandPages}
            currentPage={page}
            activeDetail={drawerStack.at(-1)}
            toggleTheme={toggleTheme}
          />
        ))}
      {exportRequest && (
        <ExportDialog
          key={exportRequest.key}
          request={exportRequest}
          onClose={closeExport}
          notify={notify}
        />
      )}
      {detailState.confirmation && (
        <Modal
          title="إزالة تحقيق مثبّت؟"
          subtitle="تأكيد إزالة التبويب"
          onClose={cancelRemoveInvestigation}
        >
          <div className="modal-content">
            <InfoBox tone="amber">
              إزالة التبويب تحذف مساره من قائمة التحقيقات، لكنها لا تحذف المهام والملاحظات أو
              المسودات من ذاكرة هذه الجلسة. تبقى جميع البيانات مؤقتة.
            </InfoBox>
            <p className="modal-lead">
              <bdi dir="ltr">{detailState.confirmation}</bdi>
            </p>
            <div className="modal-actions">
              <Button type="button" onClick={cancelRemoveInvestigation}>
                الاحتفاظ بالتبويب
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() =>
                  dispatchDetail({ type: 'remove', id: detailState.confirmation, confirmed: true })
                }
              >
                إزالة التبويب المثبّت
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {tourIntro && (
        <Modal
          title="بدء الجولة التعليمية"
          subtitle="جولة اختيارية داخل الواجهة"
          onClose={cancelTourIntro}
        >
          <div className="modal-content">
            <p className="modal-lead">
              ستنتقل الجولة بين أقسام المنصة وتبرز الأدوات دون تغيير أي سجل.
            </p>
            <InfoBox>
              قد تُصفّر مرشحات الصفحة المؤقتة عند مغادرتها. يمكنك إيقاف الجولة واستئنافها لاحقًا.
            </InfoBox>
            <div className="modal-actions">
              <Button type="button" onClick={cancelTourIntro}>
                إلغاء
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  const next = tourIntro;
                  setTourIntro(null);
                  enterGuideStep(next.index, next.reset);
                }}
              >
                متابعة الجولة
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {pendingNavigation && (
        <Modal
          title="إعدادات غير محفوظة"
          subtitle="تأكيد مغادرة الصفحة"
          onClose={cancelPendingNavigation}
        >
          <div className="modal-content">
            <InfoBox tone="amber">
              لديك تغييرات غير محفوظة في الإعدادات التجريبية. هل تريد تجاهلها؟
            </InfoBox>
            <div className="modal-actions">
              <Button type="button" onClick={cancelPendingNavigation}>
                متابعة التعديل
              </Button>
              <Button type="button" variant="primary" onClick={confirmPendingNavigation}>
                تجاهل التغييرات والمتابعة
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {undoEntry && !modal && !pendingNavigation && !exportRequest && !drawerStack.length && (
        <div className="undo-banner" role="status">
          <span>
            <strong>{undoEntry.label}</strong>
            <small>يمكن التراجع عن آخر تغيير للتنبيهات في الذاكرة فقط.</small>
          </span>
          <button
            type="button"
            onClick={undoLast}
            disabled={offlineSimulation}
            title={offlineSimulation ? 'ينبغي إنهاء محاكاة الانقطاع أولًا' : 'تراجع محلي'}
          >
            تراجع
          </button>
          <button
            type="button"
            className="undo-dismiss"
            aria-label="إخفاء التراجع"
            onClick={() => setUndoEntry(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {tourIndex !== null && (
        <GuideTour
          index={tourIndex}
          onStep={enterGuideStep}
          onPause={pauseGuide}
          onSkip={skipGuide}
          onFinish={finishGuide}
        />
      )}
      {toast && (
        <div key={toast.key} className={`toast ${toast.type}`} role="status">
          <span>{toast.type === 'error' ? <X size={15} /> : <Check size={15} />}</span>
          {toast.text}
        </div>
      )}
    </div>
  );
}
