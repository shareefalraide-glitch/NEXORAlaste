import React from 'react';

import { ar } from '../../shared/ui/index';

export function Result({ rows, total }) {
  return (
    <div className="table-footer">
      <span>
        عرض <strong>{ar(rows)}</strong> من أصل <strong>{ar(total)}</strong> سجلات تجريبية
      </span>
      <span>العينة المعروضة فقط</span>
    </div>
  );
}
export { matchesRecord as includes } from '../../shared/lib/matching';
export { ClickableRow as Row } from '../../shared/ui/ClickableRow';
