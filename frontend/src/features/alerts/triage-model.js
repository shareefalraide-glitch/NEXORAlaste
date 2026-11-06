// Human-authored decisions for the local demo only. Validation is shared by
// the queue UI and the final commit; no decision is copied between alerts.
export const TRIAGE_CHOICES = [
  ['followup', 'يحتاج متابعة'],
  ['escalate', 'رفع للمراجعة البشرية'],
  ['false-positive', 'مرجح إنذار كاذب'],
  ['unknown', 'غير محسوم'],
];
export const TRIAGE_PRIORITIES = [
  ['p1', 'عاجلة'],
  ['p2', 'مرتفعة'],
  ['p3', 'عادية'],
  ['p4', 'منخفضة'],
];
export const triageChoiceLabel = value => TRIAGE_CHOICES.find(item => item[0] === value)?.[1];
export const triagePriorityLabel = value => TRIAGE_PRIORITIES.find(item => item[0] === value)?.[1];
export function completeTriage(value) {
  return !!(
    triageChoiceLabel(value?.decision) &&
    triagePriorityLabel(value?.priority) &&
    String(value?.reason || '').trim() &&
    String(value?.reason || '').length <= 400 &&
    String(value?.note || '').length <= 500
  );
}
export function validateTriageBatch(items, alerts, history = {}) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 50)
    return { ok: false, error: 'اختر من تنبيه واحد إلى ٥٠ تنبيهًا.' };
  const ids = new Set(),
    rows = [];
  for (const item of items) {
    const alert = alerts.find(value => value.id === item.id);
    if (!alert || ids.has(item.id))
      return { ok: false, error: 'يوجد تنبيه مكرر أو غير متاح في العينة.' };
    ids.add(item.id);
    if (!completeTriage(item))
      return { ok: false, error: `يلزم قرار وأولوية وسبب صالح لكل تنبيه، بما في ذلك ${item.id}.` };
    if ((history[item.id] || []).length >= 20)
      return { ok: false, error: `بلغ سجل التنبيه ${item.id} حد ٢٠ قرارًا لهذه الجلسة.` };
    rows.push({
      id: item.id,
      previousStatus: alert.status,
      decision: item.decision,
      decisionLabel: triageChoiceLabel(item.decision),
      priority: item.priority,
      priorityLabel: triagePriorityLabel(item.priority),
      reason: String(item.reason).trim(),
      note: String(item.note || '').trim(),
    });
  }
  return { ok: true, rows };
}
