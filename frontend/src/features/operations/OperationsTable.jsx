import React from 'react';

import { ar, SearchInput } from '../../shared/ui/index';

export const oneOf = (value, options, fallback = 'all') =>
  options.includes(value) ? value : fallback;
export function FilterBar({ search, setSearch, placeholder, children, onReset }) {
  return (
    <div className="filter-bar">
      <SearchInput value={search} onChange={setSearch} placeholder={placeholder} />
      <div className="filter-controls">
        {children}
        <button className="reset-filter" onClick={onReset}>
          إعادة ضبط
        </button>
      </div>
    </div>
  );
}
export function ResultCount({ count, total }) {
  return (
    <div className="table-footer">
      <span>
        عرض <strong>{ar(count)}</strong> من أصل <strong>{ar(total)}</strong> سجلات تجريبية
      </span>
      <span>العينة المعروضة فقط</span>
    </div>
  );
}
export function Score({ score }) {
  return (
    <span
      className={`score ${score > 0.8 ? 'critical' : score > 0.55 ? 'high' : 'medium'}`}
      dir="ltr"
    >
      {score.toFixed(2)}
    </span>
  );
}
export { matchesRecord as matches } from '../../shared/lib/matching';
export { ClickableRow as Row } from '../../shared/ui/ClickableRow';
