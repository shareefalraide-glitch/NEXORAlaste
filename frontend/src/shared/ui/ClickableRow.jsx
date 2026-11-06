import React from 'react';

// A table row that works with a pointer, Enter, and Space.
export function ClickableRow({ children, onClick }) {
  return (
    <tr
      className="clickable-row"
      tabIndex="0"
      onClick={onClick}
      onKeyDown={event => {
        if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </tr>
  );
}
