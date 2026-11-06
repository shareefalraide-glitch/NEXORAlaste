import { useCallback } from 'react';
import { assetForRecord } from '../../features/assets/asset-relations';
import { assetChangeHistory } from '../../features/assets/asset-model';
import { validateTriageBatch } from '../../features/alerts/triage-model';
import { ar } from '../../shared/ui/index';
import { SAMPLE_END_UTC } from '../../shared/lib/time-scope';

// Local demo mutations only; no network or backend is contacted.

// Local demo mutations only; no network or backend is contacted.
export function useDemoActions({
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
}) {
  const auditEntry = (action, entity) => ({
    id: `AUD-DEMO-${Date.now().toString().slice(-6)}`,
    time: new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date()),
    date: 'الآن · تجريبي',
    action,
    actor: 'أحمد علي',
    entity,
    ip: '—',
    result: 'ناجح',
    hash: 'تجريبي',
  });
  const update = useCallback(
    (collection, id, patch, action = 'تعديل سجل') => {
      if (offlineSimulation) {
        notify('محاكاة عدم الاتصال: لا يمكن تعديل البيانات', 'error');
        return;
      }
      const old = collection === 'alerts' ? data.alerts.find(x => x.id === id) : null;
      if (
        old &&
        Object.keys(patch).length === 1 &&
        patch.status === 'تمت المراجعة' &&
        old.status !== patch.status
      )
        setUndoEntry({
          field: 'status',
          after: patch.status,
          previous: [{ id, had: Object.hasOwn(old, 'status'), value: old.status }],
          label: 'مراجعة التنبيه',
        });
      else setUndoEntry(null);
      setData(prev => ({
        ...prev,
        [collection]: prev[collection].map(x =>
          x.id === id
            ? collection === 'assets'
              ? {
                  ...x,
                  ...patch,
                  history: assetChangeHistory(
                    x,
                    patch,
                    action,
                    new Intl.DateTimeFormat('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    }).format(new Date()),
                  ),
                }
              : { ...x, ...patch }
            : x,
        ),
        audit: [auditEntry(action, id), ...prev.audit],
      }));
      if (collection === 'incidents' && patch.approval)
        setNotifications(prev => [
          {
            id: `notice-${Date.now()}-${id}`,
            category: 'approval',
            kind: 'incident',
            entityId: id,
            title: `تحديث طلب احتواء: ${patch.approval}`,
            summary: `${id} · قرار أو طلب مسجّل في العينة`,
            time: 'الآن · تجريبي',
            read: false,
          },
          ...prev,
        ]);
      notify('تم التحديث في الواجهة التجريبية فقط');
    },
    [data, notify, offlineSimulation],
  );
  const submitTriage = useCallback(
    (id, decision) => {
      if (offlineSimulation) {
        notify('محاكاة عدم الاتصال: لا يمكن تسجيل القرار', 'error');
        return false;
      }
      const alert = data.alerts.find(x => x.id === id),
        decisions = {
          followup: 'يحتاج متابعة',
          escalate: 'رفع للمراجعة البشرية',
          'false-positive': 'مرجح إنذار كاذب',
          unknown: 'غير محسوم',
        },
        priorities = { p1: 'عاجلة', p2: 'مرتفعة', p3: 'عادية', p4: 'منخفضة' };
      const reason = String(decision.reason || '')
          .trim()
          .slice(0, 400),
        note = String(decision.note || '')
          .trim()
          .slice(0, 500);
      if (
        !alert ||
        !decisions[decision.decision] ||
        !priorities[decision.priority] ||
        !reason ||
        (triageRecords[id] || []).length >= 20
      )
        return false;
      const now = new Date(),
        entry = {
          id: `decision-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
          decision: decision.decision,
          decisionLabel: decisions[decision.decision],
          priority: decision.priority,
          priorityLabel: priorities[decision.priority],
          reason,
          note,
          localTime: new Intl.DateTimeFormat('en-GB', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).format(now),
        };
      setTriageRecords(current => ({ ...current, [id]: [...(current[id] || []), entry] }));
      setData(prev => ({
        ...prev,
        alerts: prev.alerts.map(x => (x.id === id ? { ...x, status: 'تمت المراجعة' } : x)),
        audit: [auditEntry('قرار مراجعة تنبيه تجريبي', id), ...prev.audit],
      }));
      setUndoEntry({
        kind: 'triage',
        id,
        decisionId: entry.id,
        previousStatus: alert.status,
        after: 'تمت المراجعة',
        label: 'قرار مراجعة التنبيه',
      });
      notify('سُجّل القرار محليًا؛ التراجع متاح بعد إغلاق التفاصيل.');
      return true;
    },
    [data.alerts, triageRecords, offlineSimulation, notify],
  );
  const submitTriageBatch = useCallback(
    items => {
      if (offlineSimulation) {
        notify('محاكاة عدم الاتصال: لا يمكن تسجيل القرارات', 'error');
        return false;
      }
      const checked = validateTriageBatch(items, data.alerts, triageRecords);
      if (!checked.ok) {
        notify(checked.error, 'error');
        return false;
      }
      const now = new Date(),
        localTime = new Intl.DateTimeFormat('en-GB', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(now);
      const entries = checked.rows.map(row => ({
        ...row,
        entry: {
          id: `decision-${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`,
          decision: row.decision,
          decisionLabel: row.decisionLabel,
          priority: row.priority,
          priorityLabel: row.priorityLabel,
          reason: row.reason,
          note: row.note,
          localTime,
        },
      }));
      setTriageRecords(current => {
        const next = { ...current };
        for (const row of entries) next[row.id] = [...(next[row.id] || []), row.entry];
        return next;
      });
      setData(current => ({
        ...current,
        alerts: current.alerts.map(alert =>
          entries.some(row => row.id === alert.id) ? { ...alert, status: 'تمت المراجعة' } : alert,
        ),
        audit: [
          auditEntry('قرارات مراجعة مستقلة في العينة', entries.map(row => row.id).join('، ')),
          ...current.audit,
        ],
      }));
      setUndoEntry({
        kind: 'triage-batch',
        changes: entries.map(row => ({
          id: row.id,
          decisionId: row.entry.id,
          previousStatus: row.previousStatus,
        })),
        after: 'تمت المراجعة',
        label: 'قرارات المراجعة المستقلة',
      });
      notify(`سُجّلت ${ar(entries.length)} قرارات مستقلة في الجلسة فقط.`);
      return true;
    },
    [data.alerts, triageRecords, offlineSimulation, notify],
  );
  const bulkAlerts = useCallback(
    (ids, kind, owner) => {
      if (offlineSimulation) {
        notify('محاكاة عدم الاتصال: لا يمكن تعديل البيانات', 'error');
        return false;
      }
      const field = kind === 'review' ? 'status' : 'owner',
        after = kind === 'review' ? 'تمت المراجعة' : owner;
      if (kind === 'assign' && !data.users.some(u => u.name === owner && u.status === 'نشط')) {
        notify('اختر مستخدمًا نشطًا من العينة.', 'error');
        return false;
      }
      const records = data.alerts.filter(x => ids.includes(x.id) && x[field] !== after);
      if (!records.length) {
        notify('لا توجد تنبيهات تحتاج هذا التغيير في الاختيار.', 'error');
        return false;
      }
      const previous = records.map(x => ({
        id: x.id,
        had: Object.hasOwn(x, field),
        value: x[field],
      }));
      setUndoEntry({
        field,
        after,
        previous,
        label: kind === 'review' ? 'مراجعة التنبيهات المحددة' : 'إسناد التنبيهات المحددة',
      });
      setData(prev => ({
        ...prev,
        alerts: prev.alerts.map(x =>
          records.some(r => r.id === x.id) ? { ...x, [field]: after } : x,
        ),
        audit: [
          auditEntry(
            kind === 'review' ? 'مراجعة تنبيهات جماعيًا' : 'إسناد تنبيهات جماعيًا',
            records.map(r => r.id).join('، '),
          ),
          ...prev.audit,
        ],
      }));
      notify(`تم تحديث ${ar(records.length)} من التنبيهات في العينة فقط.`);
      return true;
    },
    [data, notify, offlineSimulation],
  );
  const undoLast = useCallback(() => {
    if (offlineSimulation || !undoEntry) return;
    if (undoEntry.kind === 'triage-batch') {
      const changes = undoEntry.changes;
      // All-or-nothing: never remove a newer decision or overwrite a changed status.
      const safe = changes.every(
        change =>
          (triageRecords[change.id] || []).at(-1)?.id === change.decisionId &&
          data.alerts.find(alert => alert.id === change.id)?.status === undoEntry.after,
      );
      if (!safe) {
        setUndoEntry(null);
        notify('تعذّر التراجع عن الدفعة لأن بعض السجلات تغيّرت بعد تسجيلها.', 'error');
        return;
      }
      setTriageRecords(previous => {
        const next = { ...previous };
        for (const change of changes) next[change.id] = (next[change.id] || []).slice(0, -1);
        return next;
      });
      setData(previous => ({
        ...previous,
        alerts: previous.alerts.map(alert => {
          const change = changes.find(row => row.id === alert.id);
          return change ? { ...alert, status: change.previousStatus } : alert;
        }),
        audit: [
          auditEntry('تراجع تجريبي عن قرارات مستقلة', changes.map(row => row.id).join('، ')),
          ...previous.audit,
        ],
      }));
      setUndoEntry(null);
      notify('تم التراجع عن قرارات الدفعة وحالاتها السابقة في الجلسة.');
      return;
    }
    if (undoEntry.kind === 'triage') {
      const { id, decisionId, previousStatus, after } = undoEntry;
      setTriageRecords(prev => {
        const entries = prev[id] || [];
        if (entries.at(-1)?.id !== decisionId) return prev;
        return { ...prev, [id]: entries.slice(0, -1) };
      });
      setData(prev => ({
        ...prev,
        alerts: prev.alerts.map(x =>
          x.id === id && x.status === after ? { ...x, status: previousStatus } : x,
        ),
        audit: [auditEntry('تراجع تجريبي عن قرار مراجعة', id), ...prev.audit],
      }));
      setUndoEntry(null);
      notify('تم التراجع عن قرار المراجعة في الجلسة.');
      return;
    }
    const { field, after, previous, label } = undoEntry;
    setData(prev => ({
      ...prev,
      alerts: prev.alerts.map(x => {
        const old = previous.find(v => v.id === x.id);
        if (!old || x[field] !== after) return x;
        const restored = { ...x };
        if (old.had) restored[field] = old.value;
        else delete restored[field];
        return restored;
      }),
      audit: [
        auditEntry(`تراجع تجريبي: ${label}`, previous.map(x => x.id).join('، ')),
        ...prev.audit,
      ],
    }));
    setUndoEntry(null);
    notify('تم التراجع عن التغيير في العينة المحلية فقط.');
  }, [undoEntry, offlineSimulation, notify, triageRecords, data.alerts]);
  const add = useCallback(
    (collection, items, action = 'إضافة سجل') => {
      if (offlineSimulation) {
        notify('محاكاة عدم الاتصال: لا يمكن إضافة بيانات', 'error');
        return;
      }
      setUndoEntry(null);
      const arr = Array.isArray(items) ? items : [items];
      const id = arr[0]?.id || arr[0]?.name || 'عينة';
      setData(prev => ({
        ...prev,
        [collection]: [...arr, ...prev[collection]],
        audit: [auditEntry(action, id), ...prev.audit],
      }));
      notify('تمت الإضافة إلى العينة المؤقتة');
    },
    [notify, offlineSimulation],
  );
  const createIncident = useCallback(
    (alertId, reason) => {
      if (offlineSimulation) {
        notify('محاكاة عدم الاتصال: لا يمكن إنشاء حوادث', 'error');
        return;
      }
      setUndoEntry(null);
      const alert = data.alerts.find(x => x.id === alertId);
      if (!alert || alert.incident) {
        notify('التنبيه غير متاح أو مرتبط بحادثة', 'error');
        return;
      }
      const asset = assetForRecord(data.assets, alert),
        id = `INC-DEMO-${Date.now().toString().slice(-5)}`;
      const item = {
        id,
        title: alert.title,
        description: `حادثة أنشأها المحلل يدويًا من التنبيه ${alert.id}.`,
        severity: alert.severity,
        score: alert.score,
        status: 'جديدة',
        asset: alert.asset,
        assetId: asset?.id,
        ip: asset?.ip || '—',
        sourceIp: alert.source,
        destinationIp: alert.destination || asset?.ip || '—',
        owner: 'غير مسندة',
        age: 'الآن',
        time: 'الآن',
        date: 'الآن · تجريبي',
        sampleTime: SAMPLE_END_UTC,
        alerts: 1,
        technique: '—',
        correlation: 'قرار يدوي موثّق',
        rule: alert.rule,
        anomaly: alert.anomaly,
        assetScore: alert.assetScore,
        frequency: alert.frequency,
        approval: 'لم يُطلب',
        rootCause: '',
        category: 'رفع يدوي',
        timeline: [
          {
            time: 'الآن',
            session: true,
            title: 'إنشاء الحادثة يدويًا',
            detail: reason,
            actor: 'أحمد علي',
          },
        ],
      };
      setData(prev => ({
        ...prev,
        incidents: [item, ...prev.incidents],
        alerts: prev.alerts.map(a => (a.id === alertId ? { ...a, incident: id } : a)),
        audit: [auditEntry('إنشاء حادثة يدويًا', id), ...prev.audit],
      }));
      performGo('incidents');
      dispatchDetail({
        type: 'open',
        selection: { kind: 'incident', id, key: `incident-${id}-${Date.now()}` },
      });
      setNotifications(prev => [
        {
          id: `notice-${Date.now()}-${id}`,
          category: 'incident',
          kind: 'incident',
          entityId: id,
          title: 'حادثة أُنشئت في العينة',
          summary: `${id} · من التنبيه ${alertId}`,
          time: 'الآن · تجريبي',
          read: false,
        },
        ...prev,
      ]);
      notify('أُنشئت حادثة تجريبية من التنبيه');
    },
    [data, notify, offlineSimulation, performGo],
  );

  return { update, submitTriage, submitTriageBatch, bulkAlerts, undoLast, add, createIncident };
}
