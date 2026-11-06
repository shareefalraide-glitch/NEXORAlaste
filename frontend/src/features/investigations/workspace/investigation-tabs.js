// A bounded, in-memory workspace registry. Nothing here persists to storage or
// changes the actual sample records. Each open investigation keeps its own
// breadcrumb stack; the panel can be hidden and restored during this session.
export const MAX_INVESTIGATION_TABS = 8;
export const initialInvestigationTabs = () => ({
  stack: [],
  activeId: null,
  tabs: [],
  confirmation: null,
  error: '',
});

function withStack(state, stack) {
  if (!stack.length) return { ...state, stack: [], activeId: null, error: '' };
  // Going back past the case returns to the original non-workspace record;
  // keep the case's last meaningful trail available for later restoration.
  if (state.activeId && !stack.some(item => item.kind === 'incident' && item.id === state.activeId))
    return { ...state, stack, activeId: null, error: '' };
  const tabs = state.activeId
    ? state.tabs.map(tab => (tab.id === state.activeId ? { ...tab, stack } : tab))
    : state.tabs;
  return { ...state, stack, tabs, error: '' };
}
function incidentStack(tab, selection) {
  const at = tab.stack.findLastIndex(item => item.kind === 'incident' && item.id === tab.id);
  return at < 0 ? [...tab.stack, selection] : tab.stack.slice(0, at + 1);
}
export function investigationTabsReducer(state, action) {
  switch (action.type) {
    case 'set-stack': {
      const value = typeof action.value === 'function' ? action.value(state.stack) : action.value;
      return withStack(state, Array.isArray(value) ? value : []);
    }
    case 'open': {
      const { selection } = action;
      if (!selection?.kind || !selection?.id) return state;
      const current = state.stack.at(-1);
      if (current?.kind === selection.kind && current?.id === selection.id) return state;
      if (selection.kind !== 'incident') {
        // Avoid multiple mounted copies of the same record inside one case trail:
        // revisiting it goes back to that location, preserving its active draft.
        // A record before the case root is a separate outside context.
        const root = state.activeId
          ? state.stack.findLastIndex(
              item => item.kind === 'incident' && item.id === state.activeId,
            )
          : -1;
        const prior = state.stack.findLastIndex(
          item => item.kind === selection.kind && item.id === selection.id,
        );
        if (prior > root) return withStack(state, state.stack.slice(0, prior + 1));
        return withStack(state, [...state.stack, selection]);
      }
      const existing = state.tabs.find(tab => tab.id === selection.id);
      if (existing) {
        const stack = incidentStack(existing, selection);
        return {
          ...state,
          activeId: existing.id,
          stack,
          tabs: state.tabs.map(tab => (tab.id === existing.id ? { ...tab, stack } : tab)),
          error: '',
        };
      }
      if (state.tabs.length >= MAX_INVESTIGATION_TABS)
        return { ...state, error: 'بلغت مساحة التحقيق حد ٨ تبويبات؛ أزل تبويبًا قبل فتح آخر.' };
      // A new case opened from another active case starts its own trail. A case
      // opened from an ordinary alert keeps that initial alert in its breadcrumb.
      const stack = [...(state.activeId ? [] : state.stack), selection];
      return {
        ...state,
        activeId: selection.id,
        stack,
        tabs: [...state.tabs, { id: selection.id, pinned: false, stack }],
        error: '',
      };
    }
    case 'switch': {
      const tab = state.tabs.find(item => item.id === action.id);
      if (!tab) return state;
      return { ...state, activeId: tab.id, stack: tab.stack, confirmation: null, error: '' };
    }
    case 'merge-panes': {
      // Split mode edits only case trails. Never add missing tabs or alter pins.
      const panes = Array.isArray(action.panes) ? action.panes : [];
      const tabs = state.tabs.map(tab => {
        const pane = panes.find(item => item.id === tab.id);
        if (
          !pane ||
          !Array.isArray(pane.stack) ||
          !pane.stack.some(item => item.kind === 'incident' && item.id === tab.id)
        )
          return tab;
        return { ...tab, stack: pane.stack };
      });
      const active =
        tabs.find(tab => tab.id === action.activeId) || tabs.find(tab => tab.id === state.activeId);
      return {
        ...state,
        tabs,
        activeId: active?.id || null,
        stack: active?.stack || [],
        confirmation: null,
        error: '',
      };
    }
    case 'pin':
      return {
        ...state,
        tabs: state.tabs.map(tab => (tab.id === action.id ? { ...tab, pinned: !tab.pinned } : tab)),
      };
    case 'remove': {
      const tab = state.tabs.find(item => item.id === action.id);
      if (!tab) return state;
      if (tab.pinned && !action.confirmed) return { ...state, confirmation: tab.id };
      const index = state.tabs.findIndex(item => item.id === action.id),
        tabs = state.tabs.filter(item => item.id !== action.id);
      if (state.activeId !== tab.id) return { ...state, tabs, confirmation: null };
      const next = tabs[Math.min(index, tabs.length - 1)];
      return {
        ...state,
        tabs,
        activeId: next?.id || null,
        stack: next?.stack || [],
        confirmation: null,
        error: '',
      };
    }
    case 'cancel-remove':
      return { ...state, confirmation: null };
    case 'clear-error':
      return { ...state, error: '' };
    case 'reset':
      return initialInvestigationTabs();
    default:
      return state;
  }
}
