import React from 'react';

export function StatusBadge({ type, label }) {
  const badgeClasses = {
    published: 'badge badge-published',
    unpublished: 'badge badge-unpublished',
    unsaved: 'badge badge-unsaved',
    version: 'badge badge-version',
    conflict: 'badge badge-conflict'
  };

  return (
    <span className={badgeClasses[type] || 'badge'}>
      {type === 'published' && <span className="badge-dot dot-green" />}
      {type === 'unpublished' && <span className="badge-dot dot-gray" />}
      {type === 'unsaved' && <span className="badge-dot dot-amber" />}
      {label}
    </span>
  );
}
