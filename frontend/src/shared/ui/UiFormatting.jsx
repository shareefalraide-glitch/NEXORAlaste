import React from 'react';

// Sandboxed previews may need explicit Enter-to-submit handlers.
export const ar = n => new Intl.NumberFormat('ar-EG').format(n);
export const pct = v => `${ar(Math.round(v * 100))}٪`;
export const ltr = (v, className = '') => (
  <span dir="ltr" className={`ltr ${className}`}>
    {v}
  </span>
);
export const enterToSubmit = handler => e => {
  if (
    e.key === 'Enter' &&
    !e.nativeEvent.isComposing &&
    e.target.tagName === 'INPUT' &&
    !['checkbox', 'radio', 'file'].includes(e.target.type)
  ) {
    e.preventDefault();
    handler(e);
  }
};
