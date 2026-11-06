import React from 'react';
import { ChevronDown, CircleHelp, Search, X } from 'lucide-react';

export function SearchInput({
  value,
  onChange,
  placeholder = 'بحث...',
  className = '',
  focusOnOpen = false,
}) {
  return (
    <label className={`search-input ${className}`}>
      <Search size={16} />
      <input
        aria-label={placeholder}
        data-dialog-autofocus={focusOnOpen ? 'true' : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button type="button" aria-label="مسح البحث" onClick={() => onChange('')}>
          <X size={14} />
        </button>
      )}
    </label>
  );
}
export function Select({ value, onChange, children, ariaLabel, id, className = '' }) {
  return (
    <span className={`select-wrap ${className}`}>
      <select
        id={id}
        aria-label={ariaLabel || 'اختيار'}
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {children}
      </select>
      <ChevronDown size={14} />
    </span>
  );
}
export function Segmented({ items, value, onChange }) {
  return (
    <div className="segmented">
      {items.map(x => (
        <button
          key={x.value}
          className={value === x.value ? 'active' : ''}
          onClick={() => onChange(x.value)}
        >
          {x.label}
        </button>
      ))}
    </div>
  );
}
export function InfoBox({ children, tone = 'blue', title }) {
  return (
    <div className={`info-box ${tone}`}>
      <CircleHelp size={17} />
      <div>
        {title && <strong>{title}</strong>}
        <p>{children}</p>
      </div>
    </div>
  );
}
export function FormField({ label, children, hint, required = false }) {
  return (
    <label className="form-field">
      <span>
        {label}
        {required && <em> *</em>}
      </span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function TextInput(props) {
  return <input className="form-control" {...props} />;
}
export function Textarea(props) {
  return <textarea className="form-control" rows="3" {...props} />;
}
export function NativeSelect({ children, ...props }) {
  return (
    <select className="form-control" {...props}>
      {children}
    </select>
  );
}
export function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`switch ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  );
}
