import React from 'react';

export function Panel({ children, className = '', ...props }) {
  return (
    <section className={`panel ${className}`} {...props}>
      {children}
    </section>
  );
}
export function PanelHeading({ title, subtitle, aside, icon: Icon }) {
  return (
    <div className="panel-heading">
      <div className="heading-with-icon">
        {Icon && (
          <span className="heading-icon">
            <Icon size={17} />
          </span>
        )}
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {aside && <div className="panel-heading-aside">{aside}</div>}
    </div>
  );
}
export function PageHeading({ eyebrow, title, subtitle, actions, badge }) {
  return (
    <div className="page-heading">
      <div>
        <div className="page-title-line">
          <h1>{title}</h1>
          {badge}
        </div>
        {subtitle && <p>{subtitle}</p>}
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
