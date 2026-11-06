import React from 'react';

export function Button({ children, icon: Icon, variant = 'secondary', className = '', ...props }) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...props}>
      {Icon && <Icon size={15} />}
      <span>{children}</span>
    </button>
  );
}
export function IconButton({ icon: Icon, label, className = '', ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`icon-button ${className}`}
      {...props}
    >
      <Icon size={18} />
    </button>
  );
}
