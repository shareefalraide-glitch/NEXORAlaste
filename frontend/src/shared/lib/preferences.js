// Non-sensitive, device-local presentation preferences only; no user or SOC records.
export const PREFS_KEY = 'nexora-ui-preferences-v1';
export const roleNames = ['مدير النظام', 'محلل أمني', 'مسؤول الاستجابة', 'قيادة المؤسسة'];
export const metricLabels = {
  events: 'الأحداث المحلَّلة',
  alerts: 'التنبيهات المرصودة',
  incidents: 'الحوادث المفتوحة',
  assets: 'الأصول في العينة',
};
export const defaultMetricOrder = Object.keys(metricLabels);
export const widgetLabels = {
  network: 'ملخص الشبكة',
  attention: 'يحتاج انتباهك',
  charts: 'رسوم النشاط والخطورة',
  recent: 'الحوادث الأخيرة',
  services: 'المصادر ونبض الاستجابة',
};
export const defaultWidgetOrder = Object.keys(widgetLabels);
export const shortcutActions = [
  { id: 'search', label: 'فتح البحث العام', description: 'البحث في سجلات العينة' },
  { id: 'overview', label: 'فتح نظرة عامة', description: 'العودة إلى اللوحة' },
  { id: 'alerts', label: 'فتح التنبيهات', description: 'الانتقال إلى قائمة التنبيهات' },
  { id: 'incidents', label: 'فتح الحوادث', description: 'الانتقال إلى قائمة الحوادث' },
  { id: 'notifications', label: 'فتح الإشعارات', description: 'عرض مركز الإشعارات التجريبي' },
];
export const defaultShortcuts = () => ({
  search: { code: 'KeyK', alt: true, ctrl: false, meta: false, shift: false },
  overview: null,
  alerts: null,
  incidents: null,
  notifications: null,
});
export const defaultPreferences = () => ({
  density: 'comfortable',
  layouts: {},
  hiddenMetrics: {},
  widgetOrders: {},
  hiddenWidgets: {},
  shortcuts: defaultShortcuts(),
});
const booleanKeys = ['ctrl', 'alt', 'shift', 'meta'];
export function cleanBinding(value) {
  if (!value || typeof value !== 'object' || !/^Key[A-Z]$|^Digit[0-9]$/.test(value.code || ''))
    return null;
  const binding = {
    code: value.code,
    ...Object.fromEntries(booleanKeys.map(k => [k, value[k] === true])),
  };
  if (
    (!binding.ctrl && !binding.alt && !binding.meta) ||
    (binding.ctrl && binding.alt) ||
    isKnownConflict(binding)
  )
    return null;
  return binding;
}
export function isKnownConflict(binding) {
  const { code, alt, ctrl, meta, shift } = binding;
  // Conservative examples only; browsers/OS/extensions may reserve other combinations.
  if (alt && shift && !ctrl && !meta) return true; // often switches keyboard language
  if (
    alt &&
    !ctrl &&
    !meta &&
    (['KeyD', 'KeyE', 'KeyF'].includes(code) || /^Digit[1-9]$/.test(code))
  )
    return true;
  const primary = ctrl || meta;
  if (
    primary &&
    ([
      'KeyA',
      'KeyC',
      'KeyV',
      'KeyX',
      'KeyZ',
      'KeyY',
      'KeyK',
      'KeyL',
      'KeyT',
      'KeyW',
      'KeyN',
      'KeyR',
      'KeyF',
      'KeyD',
      'KeyH',
      'KeyJ',
      'KeyO',
      'KeyP',
      'KeyS',
      'KeyU',
      'KeyQ',
    ].includes(code) ||
      /^Digit[0-9]$/.test(code))
  )
    return true;
  if (primary && shift && ['KeyI', 'KeyJ', 'KeyC'].includes(code)) return true;
  return false;
}
export const equalBindings = (a, b) =>
  !!a && !!b && a.code === b.code && booleanKeys.every(k => !!a[k] === !!b[k]);
export function bindingFromEvent(event) {
  const value = {
    code: event.code,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey,
  };
  if (event.getModifierState?.('AltGraph')) return null;
  return cleanBinding(value);
}
export function bindingMatches(event, binding) {
  if (!binding || event.getModifierState?.('AltGraph')) return false;
  const physical =
    event.code || ((event.key || '').length === 1 ? `Key${event.key.toUpperCase()}` : '');
  return physical === binding.code && booleanKeys.every(k => !!event[`${k}Key`] === !!binding[k]);
}
export const isMacPlatform = () =>
  /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgentData?.platform || '');
export function formatBinding(binding, mac = isMacPlatform()) {
  if (!binding) return 'غير مخصص';
  return [
    binding.ctrl ? 'Ctrl' : null,
    binding.alt ? (mac ? '⌥' : 'Alt') : null,
    binding.shift ? (mac ? '⇧' : 'Shift') : null,
    binding.meta ? (mac ? '⌘' : 'Meta') : null,
    binding.code.replace(/^Key|^Digit/, ''),
  ]
    .filter(Boolean)
    .join(' + ');
}
export function ariaBinding(binding) {
  if (!binding) return undefined;
  return [
    binding.ctrl ? 'Control' : null,
    binding.alt ? 'Alt' : null,
    binding.shift ? 'Shift' : null,
    binding.meta ? 'Meta' : null,
    binding.code.replace(/^Key|^Digit/, ''),
  ]
    .filter(Boolean)
    .join('+');
}
export function loadPreferences() {
  const defaults = defaultPreferences();
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return defaults;
    const layouts = {};
    for (const role of roleNames) {
      const order = saved.layouts?.[role];
      if (
        Array.isArray(order) &&
        order.length === defaultMetricOrder.length &&
        new Set(order).size === order.length &&
        order.every(id => defaultMetricOrder.includes(id))
      )
        layouts[role] = order;
    }
    const hiddenMetrics = {};
    for (const role of roleNames) {
      const ids = saved.hiddenMetrics?.[role];
      if (
        Array.isArray(ids) &&
        new Set(ids).size === ids.length &&
        ids.every(id => defaultMetricOrder.includes(id))
      )
        hiddenMetrics[role] = ids;
    }
    const widgetOrders = {},
      hiddenWidgets = {};
    for (const role of roleNames) {
      const order = saved.widgetOrders?.[role];
      if (
        Array.isArray(order) &&
        order.length === defaultWidgetOrder.length &&
        new Set(order).size === order.length &&
        order.every(id => defaultWidgetOrder.includes(id))
      )
        widgetOrders[role] = order;
      const hidden = saved.hiddenWidgets?.[role];
      if (
        Array.isArray(hidden) &&
        new Set(hidden).size === hidden.length &&
        hidden.every(id => defaultWidgetOrder.includes(id))
      )
        hiddenWidgets[role] = hidden;
    }
    const shortcuts = defaultShortcuts(),
      used = [];
    for (const { id } of shortcutActions) {
      let candidate = Object.hasOwn(saved.shortcuts || {}, id)
        ? saved.shortcuts[id] === null
          ? null
          : cleanBinding(saved.shortcuts[id])
        : shortcuts[id];
      if (candidate && used.some(b => equalBindings(b, candidate))) candidate = null;
      shortcuts[id] = candidate;
      if (candidate) used.push(candidate);
    }
    return {
      density: saved.density === 'compact' ? 'compact' : 'comfortable',
      layouts,
      hiddenMetrics,
      widgetOrders,
      hiddenWidgets,
      shortcuts,
    };
  } catch {
    return defaults;
  }
}
