import React from 'react';
import { parseNote } from './notebook-model';

// Text nodes are escaped by React. Only # headings and - list items are styled;
// raw HTML and scripts are always displayed as literal text.
export default function NoteBody({ text }) {
  return (
    <div className="notebook-formatted">
      {parseNote(text).map((part, index) =>
        part.type === 'heading' ? (
          <strong className="notebook-line-heading" key={index}>
            {part.text}
          </strong>
        ) : part.type === 'list' ? (
          <ul key={index}>
            {part.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={index}>{part.text || '\u00a0'}</p>
        ),
      )}
    </div>
  );
}
