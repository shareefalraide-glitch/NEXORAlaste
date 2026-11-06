import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { apiClient } from '../../services/api-client';

const basePages = [
  { id: 'summary', label: 'الملخص' },
  { id: 'assets', label: 'الأصول' },
  { id: 'sources', label: 'المصادر' },
  { id: 'events', label: 'الأحداث' },
  { id: 'incidents', label: 'الحوادث' },
  { id: 'audit', label: 'التدقيق' },
];
const writers = new Set(['admin', 'analyst', 'responder']);
const adminRoles = new Set(['admin']);
const readAuditRoles = new Set(['admin', 'auditor']);
const listPath = {
  assets: '/assets',
  sources: '/sources',
  events: '/events',
  incidents: '/incidents',
  audit: '/audit',
};
const columnSets = {
  assets: [
    ['name', 'الاسم'],
    ['kind', 'النوع'],
    ['criticality', 'الأهمية'],
    ['primary_ip', 'عنوان IP'],
    ['created_at', 'تاريخ الإضافة'],
  ],
  sources: [
    ['name', 'الاسم'],
    ['kind', 'النوع'],
    ['collection_method', 'طريقة الجمع'],
    ['active', 'نشط'],
    ['last_received_at', 'آخر استقبال'],
  ],
  events: [
    ['observed_at', 'وقت الحدث'],
    ['category', 'الفئة'],
    ['action', 'الإجراء'],
    ['source_ip', 'المصدر'],
    ['destination_ip', 'الوجهة'],
    ['message', 'الوصف'],
  ],
  incidents: [
    ['created_at', 'تاريخ الإنشاء'],
    ['title', 'العنوان'],
    ['severity', 'الخطورة'],
    ['status', 'الحالة'],
    ['origin', 'المنشأ'],
  ],
  audit: [
    ['occurred_at', 'الوقت'],
    ['action', 'العملية'],
    ['actor', 'المنفّذ'],
    ['resource_type', 'نوع المورد'],
    ['resource_id', 'معرّف المورد'],
    ['entry_hash', 'بصمة السجل'],
  ],
  users: [
    ['email', 'البريد الإلكتروني'],
    ['role', 'الدور'],
    ['active', 'نشط'],
    ['created_at', 'تاريخ الإنشاء'],
  ],
};
const display = value => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};
const time = value => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value) : date.toLocaleString();
};
const describeError = error => error?.message || 'تعذر إكمال الطلب.';

function LoginIdentity({ user }) {
  return (
    <div className="api-identity">
      <span className="api-identity-icon">
        <Activity size={18} />
      </span>
      <span>
        <strong>{user.email}</strong>
        <small>{user.role} · API فعلي</small>
      </span>
    </div>
  );
}

function IncidentDetails({ incident, user, assets, onChanged }) {
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [note, setNote] = useState('');
  const [task, setTask] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canWrite = writers.has(user.role);

  const loadDetails = useCallback(
    async signal => {
      setError('');
      try {
        const [noteResult, taskResult] = await Promise.all([
          apiClient.request(`/incidents/${incident.id}/notes?limit=100`, { signal }),
          apiClient.request(`/incidents/${incident.id}/tasks?limit=100`, { signal }),
        ]);
        setNotes(noteResult.items || []);
        setTasks(taskResult.items || []);
      } catch (cause) {
        setError(describeError(cause));
      }
    },
    [incident.id],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadDetails(controller.signal);
    return () => controller.abort();
  }, [loadDetails]);

  const submitNote = async event => {
    event.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    setError('');
    try {
      await apiClient.request(`/incidents/${incident.id}/notes`, {
        method: 'POST',
        body: { body: note.trim() },
      });
      setNote('');
      await loadDetails();
      onChanged();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  };

  const submitTask = async event => {
    event.preventDefault();
    if (!task.trim()) return;
    setBusy(true);
    setError('');
    try {
      await apiClient.request(`/incidents/${incident.id}/tasks`, {
        method: 'POST',
        body: { title: task.trim() },
      });
      setTask('');
      await loadDetails();
      onChanged();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  };

  const changeTask = async (taskId, status) => {
    setBusy(true);
    setError('');
    try {
      await apiClient.request(`/incidents/${incident.id}/tasks/${taskId}`, {
        method: 'PATCH',
        body: { status },
      });
      await loadDetails();
      onChanged();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="api-detail" aria-labelledby="api-detail-title">
      <div className="api-detail-heading">
        <div>
          <p className="api-kicker">تفاصيل من الخادم</p>
          <h2 id="api-detail-title">{incident.title}</h2>
        </div>
        <span className="api-badge">{display(incident.status)}</span>
      </div>
      <p>{incident.description || 'لا يوجد وصف محفوظ لهذه الحادثة.'}</p>
      <p className="api-muted">
        الأصل المرتبط:{' '}
        {display(assets.find(asset => asset.id === incident.asset_id)?.name || incident.asset_id)}
      </p>
      {error && (
        <p className="api-error" role="alert">
          {error}
        </p>
      )}
      <div className="api-detail-grid">
        <section>
          <h3>الملاحظات ({notes.length})</h3>
          {notes.length ? (
            <ul className="api-note-list">
              {notes.map(item => (
                <li key={item.id}>
                  <p>{item.body}</p>
                  <small>{time(item.created_at)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="api-muted">لا توجد ملاحظات محفوظة.</p>
          )}
          {canWrite && (
            <form className="api-inline-form" onSubmit={submitNote}>
              <label htmlFor="api-note">إضافة ملاحظة موثقة</label>
              <textarea
                id="api-note"
                maxLength={4000}
                required
                value={note}
                onChange={event => setNote(event.target.value)}
              />
              <button disabled={busy || !note.trim()}>حفظ الملاحظة</button>
            </form>
          )}
        </section>
        <section>
          <h3>المهام ({tasks.length})</h3>
          {tasks.length ? (
            <ul className="api-task-list">
              {tasks.map(item => (
                <li key={item.id}>
                  <span>{item.title}</span>
                  <select
                    aria-label={`حالة المهمة ${item.title}`}
                    value={item.status}
                    disabled={!canWrite || busy}
                    onChange={event => changeTask(item.id, event.target.value)}
                  >
                    <option value="todo">todo</option>
                    <option value="in_progress">in_progress</option>
                    <option value="done">done</option>
                  </select>
                </li>
              ))}
            </ul>
          ) : (
            <p className="api-muted">لا توجد مهام محفوظة.</p>
          )}
          {canWrite && (
            <form className="api-inline-form" onSubmit={submitTask}>
              <label htmlFor="api-task">إضافة مهمة</label>
              <input
                id="api-task"
                maxLength={300}
                required
                value={task}
                onChange={event => setTask(event.target.value)}
              />
              <button disabled={busy || !task.trim()}>إنشاء المهمة</button>
            </form>
          )}
        </section>
      </div>
      <small className="api-muted">لا يُنفّذ هذا العرض احتواءً أو تغييرات على الأجهزة.</small>
    </section>
  );
}

export default function ApiWorkspace({ user, onLogout }) {
  const pages = useMemo(
    () => [
      ...basePages.filter(page => page.id !== 'audit' || readAuditRoles.has(user.role)),
      ...(adminRoles.has(user.role) ? [{ id: 'users', label: 'المستخدمون' }] : []),
    ],
    [user.role],
  );
  const [page, setPage] = useState('summary');
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [assets, setAssets] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [auditResult, setAuditResult] = useState(null);
  const [creating, setCreating] = useState(false);
  const [incidentDraft, setIncidentDraft] = useState({
    title: '',
    description: '',
    severity: 'medium',
    asset_id: '',
  });
  const [assetDraft, setAssetDraft] = useState({
    name: '',
    kind: 'server',
    criticality: 'medium',
    primary_ip: '',
  });
  const canWriteIncidents = writers.has(user.role);
  const isAdmin = adminRoles.has(user.role);

  const load = useCallback(
    async signal => {
      setLoading(true);
      setError('');
      try {
        if (page === 'summary') {
          const result = await apiClient.request('/dashboard/summary', { signal });
          setSummary(result);
          setRows([]);
        } else {
          const endpoint = page === 'users' ? '/users' : listPath[page];
          if (!endpoint) return;
          const pageOffset = page === 'audit' ? 0 : offset;
          const path = `${endpoint}?limit=50&offset=${pageOffset}`;
          const result = await apiClient.request(path, { signal });
          setRows(Array.isArray(result?.items) ? result.items : []);
          if (page === 'incidents' && canWriteIncidents) {
            const assetsResult = await apiClient.request('/assets?limit=100', { signal });
            setAssets(assetsResult.items || []);
          }
          setAuditResult(null);
        }
      } catch (cause) {
        if (cause.name === 'AbortError') return;
        setError(describeError(cause));
        if (cause.status === 401) onLogout(false);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, offset, refreshKey, canWriteIncidents, onLogout],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const refresh = () => setRefreshKey(value => value + 1);
  const changePage = value => {
    setPage(value);
    setOffset(0);
    setQuery('');
    setSelectedIncident(null);
    setError('');
    setNotice('');
  };
  const visibleRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return rows;
    return rows.filter(row => JSON.stringify(row).toLocaleLowerCase().includes(needle));
  }, [rows, query]);

  const submitIncident = async event => {
    event.preventDefault();
    setCreating(true);
    setError('');
    try {
      await apiClient.request('/incidents', { method: 'POST', body: incidentDraft });
      setIncidentDraft({ title: '', description: '', severity: 'medium', asset_id: '' });
      setNotice('تم إنشاء الحادثة وحفظ الإجراء في سجل التدقيق بالخادم.');
      refresh();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setCreating(false);
    }
  };

  const submitAsset = async event => {
    event.preventDefault();
    setCreating(true);
    setError('');
    try {
      await apiClient.request('/assets', { method: 'POST', body: assetDraft });
      setAssetDraft({ name: '', kind: 'server', criticality: 'medium', primary_ip: '' });
      setNotice('تم إنشاء الأصل وحفظ الإجراء في سجل التدقيق بالخادم.');
      refresh();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setCreating(false);
    }
  };

  const verifyAudit = async () => {
    setCreating(true);
    setError('');
    try {
      setAuditResult(await apiClient.request('/audit/verify'));
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setCreating(false);
    }
  };

  const exportRows = () => {
    const columns = (columnSets[page] || []).map(([key]) => key);
    const csvCell = value => {
      let text = String(value ?? '');
      if (/^[\\t\\r\\n ]*[=+@-]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const csv = [
      columns.map(csvCell).join(','),
      ...visibleRows.map(row => columns.map(key => csvCell(row[key])).join(',')),
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `nexora-${page}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const counts = summary?.counts || {};
  const tableColumns = page === 'users' ? columnSets.users : columnSets[page] || [];
  const pageLabel = pages.find(item => item.id === page)?.label || page;

  return (
    <div className="api-workspace" dir="rtl">
      <header className="api-topbar">
        <a
          className="api-brand"
          href="#api-summary"
          onClick={event => {
            event.preventDefault();
            changePage('summary');
          }}
        >
          <span className="api-brand-mark">
            <Activity size={21} />
          </span>
          <span>
            <strong>NEXORA</strong>
            <small>مساحة API الفعلية</small>
          </span>
        </a>
        <LoginIdentity user={user} />
        <button className="api-logout" onClick={() => onLogout(true)}>
          <LogOut size={17} /> تسجيل الخروج
        </button>
      </header>
      <div className="api-shell">
        <nav className="api-nav" aria-label="تنقل مساحة API">
          {pages.map(item => (
            <button
              key={item.id}
              className={page === item.id ? 'active' : ''}
              onClick={() => changePage(item.id)}
              aria-current={page === item.id ? 'page' : undefined}
            >
              {item.label}
              <ChevronLeft size={15} />
            </button>
          ))}
        </nav>
        <main className="api-main">
          <div className="api-page-heading">
            <div>
              <p className="api-kicker">NEXORA · بيانات الخادم</p>
              <h1>{pageLabel}</h1>
              <p>الاستجابات من API الموثق؛ لا تُعرض بيانات Demo في هذه المساحة.</p>
            </div>
            <div className="api-heading-actions">
              {page !== 'summary' && (
                <button onClick={exportRows} disabled={!visibleRows.length}>
                  تصدير CSV
                </button>
              )}
              <button onClick={refresh} disabled={loading}>
                <RefreshCw size={16} /> تحديث
              </button>
            </div>
          </div>
          <div className="api-truth-banner">
            <ShieldAlert size={18} />
            <span>
              الكشف الآلي والتنبيهات غير متاحين في Backend الحالي. هذا العرض لا يقدّم مؤشرات وهمية
              ولا ينفذ احتواءً.
            </span>
          </div>
          {notice && (
            <p className="api-success" role="status">
              <CheckCircle2 size={17} />
              {notice}
            </p>
          )}
          {error && (
            <p className="api-error" role="alert">
              {error}
            </p>
          )}
          {loading && (
            <div className="api-state" role="status">
              جارٍ تحميل البيانات من الخادم…
            </div>
          )}
          {!loading && page === 'summary' && summary && (
            <>
              <div className="api-cards">
                {[
                  ['الأحداث المسجلة ضمن الفترة', counts.events],
                  ['الحوادث المفتوحة الآن', counts.open_incidents_now],
                  ['الأصول', counts.assets_now],
                  ['المصادر المهيأة', counts.sources_configured_now],
                  ['تنبيهات', counts.alerts === null ? 'غير متاح' : counts.alerts],
                ].map(([label, value]) => (
                  <article key={label}>
                    <span>{label}</span>
                    <strong>{display(value)}</strong>
                  </article>
                ))}
              </div>
              <section className="api-panel">
                <h2>حدود البيانات</h2>
                <p>
                  الأحداث: {display(summary.data_status?.events)} · الحوادث:{' '}
                  {display(summary.data_status?.incidents)} · الكشف:{' '}
                  {display(summary.data_status?.detection)} · احتُسب في{' '}
                  {time(summary.calculated_at)}.
                </p>
                <p className="api-muted">
                  لا تعني قيمة الأحداث أو الحوادث غياب تهديد إذا لم توجد سجلات أو قواعد كشف.
                </p>
              </section>
            </>
          )}
          {!loading && page !== 'summary' && (
            <>
              {page === 'incidents' && canWriteIncidents && (
                <details className="api-panel api-create">
                  <summary>إنشاء حادثة فعلية</summary>
                  <form onSubmit={submitIncident} className="api-form-grid">
                    <label>
                      العنوان
                      <input
                        required
                        maxLength={200}
                        value={incidentDraft.title}
                        onChange={event =>
                          setIncidentDraft(current => ({ ...current, title: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      الخطورة
                      <select
                        value={incidentDraft.severity}
                        onChange={event =>
                          setIncidentDraft(current => ({
                            ...current,
                            severity: event.target.value,
                          }))
                        }
                      >
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="high">high</option>
                        <option value="critical">critical</option>
                      </select>
                    </label>
                    <label>
                      الأصل المرتبط (اختياري)
                      <select
                        value={incidentDraft.asset_id}
                        onChange={event =>
                          setIncidentDraft(current => ({
                            ...current,
                            asset_id: event.target.value,
                          }))
                        }
                      >
                        <option value="">لا يوجد</option>
                        {assets.map(asset => (
                          <option key={asset.id} value={asset.id}>
                            {asset.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="api-span-all">
                      الوصف
                      <textarea
                        maxLength={4000}
                        value={incidentDraft.description}
                        onChange={event =>
                          setIncidentDraft(current => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <button disabled={creating}>حفظ الحادثة</button>
                  </form>
                </details>
              )}
              {page === 'assets' && isAdmin && (
                <details className="api-panel api-create">
                  <summary>إضافة أصل فعلي</summary>
                  <form onSubmit={submitAsset} className="api-form-grid">
                    <label>
                      الاسم
                      <input
                        required
                        maxLength={160}
                        value={assetDraft.name}
                        onChange={event =>
                          setAssetDraft(current => ({ ...current, name: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      النوع
                      <select
                        value={assetDraft.kind}
                        onChange={event =>
                          setAssetDraft(current => ({ ...current, kind: event.target.value }))
                        }
                      >
                        <option value="server">server</option>
                        <option value="workstation">workstation</option>
                        <option value="network_device">network_device</option>
                        <option value="other">other</option>
                      </select>
                    </label>
                    <label>
                      الأهمية
                      <select
                        value={assetDraft.criticality}
                        onChange={event =>
                          setAssetDraft(current => ({
                            ...current,
                            criticality: event.target.value,
                          }))
                        }
                      >
                        <option value="low">low</option>
                        <option value="medium">medium</option>
                        <option value="critical">critical</option>
                      </select>
                    </label>
                    <label>
                      عنوان IP اختياري
                      <input
                        dir="ltr"
                        maxLength={45}
                        value={assetDraft.primary_ip}
                        onChange={event =>
                          setAssetDraft(current => ({ ...current, primary_ip: event.target.value }))
                        }
                      />
                    </label>
                    <button disabled={creating}>حفظ الأصل</button>
                  </form>
                </details>
              )}
              {page === 'audit' && (
                <section className="api-panel api-audit">
                  <button onClick={verifyAudit} disabled={creating}>
                    <CheckCircle2 size={17} /> التحقق من سلسلة التدقيق
                  </button>
                  {auditResult && (
                    <p role="status">
                      {auditResult.valid ? 'السلسلة سليمة' : 'تعذر إثبات سلامة السلسلة'} ·{' '}
                      {display(auditResult.checked)} سجل ·{' '}
                      {auditResult.complete ? 'الفحص كامل' : 'الفحص غير مكتمل'} ·{' '}
                      {auditResult.message}
                    </p>
                  )}
                  <p className="api-muted">التحقق يبدأ من السلسلة المخزنة ولا يشمل مرساة خارجية.</p>
                </section>
              )}
              <section className="api-panel api-table-panel">
                <div className="api-table-toolbar">
                  <p>{rows.length} سجل في الصفحة الحالية (حد الصفحة 50)</p>
                  <label>
                    <Search size={16} />
                    <input
                      value={query}
                      onChange={event => setQuery(event.target.value)}
                      placeholder="بحث في النتائج المحملة"
                      aria-label="بحث في النتائج المحملة"
                    />
                  </label>
                </div>
                <div className="api-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        {tableColumns.map(([key, label]) => (
                          <th key={key}>{label}</th>
                        ))}
                        {page === 'incidents' && <th>تفاصيل</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map(row => (
                        <tr key={row.id}>
                          {tableColumns.map(([key]) => (
                            <td
                              key={key}
                              dir={
                                key.includes('ip') ||
                                key.endsWith('_at') ||
                                key.includes('hash') ||
                                key.endsWith('_id')
                                  ? 'ltr'
                                  : undefined
                              }
                            >
                              {key.endsWith('_at') ? time(row[key]) : display(row[key])}
                            </td>
                          ))}
                          {page === 'incidents' && (
                            <td>
                              <button
                                className="api-small-button"
                                onClick={() => setSelectedIncident(row)}
                              >
                                الملاحظات والمهام
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!visibleRows.length && (
                  <div className="api-state">
                    {query ? 'لا توجد نتائج مطابقة في الصفحة الحالية.' : 'لا توجد سجلات متاحة.'}
                  </div>
                )}
                <div className="api-pagination">
                  <button
                    onClick={() => setOffset(value => Math.max(0, value - 50))}
                    disabled={offset === 0 || loading}
                  >
                    السابق
                  </button>
                  <span>إزاحة {offset}</span>
                  <button
                    onClick={() => setOffset(value => value + 50)}
                    disabled={page === 'audit' || rows.length < 50 || loading}
                  >
                    التالي
                  </button>
                </div>
              </section>
              {selectedIncident && page === 'incidents' && (
                <IncidentDetails
                  key={selectedIncident.id}
                  incident={selectedIncident}
                  user={user}
                  assets={assets}
                  onChanged={refresh}
                />
              )}
            </>
          )}
          {!loading && error && !rows.length && page !== 'summary' && (
            <div className="api-state">
              تعذر تحميل البيانات. يمكنك المحاولة مجددًا بعد التحقق من الخدمة والصلاحية.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
