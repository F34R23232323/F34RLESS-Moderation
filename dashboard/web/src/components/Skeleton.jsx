import React from 'react';
import { Inbox } from 'lucide-react';

export function Skeleton({ width, height, style, className = '', radius }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ width: width ?? '100%', height: height ?? '1em', borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="page-skeleton" aria-hidden="true">
      <div className="page-head">
        <div>
          <Skeleton width="220px" height="30px" />
          <div style={{ marginTop: 8 }}><Skeleton width="340px" height="14px" /></div>
        </div>
      </div>
      <div className="stats" style={{ margin: '18px 0' }}>
        {[0, 1, 2, 3].map((i) => (
          <div className="stat" key={i} style={{ height: 92 }}>
            <Skeleton width="55%" height="12px" />
            <div style={{ marginTop: 14 }}><Skeleton width="70%" height="24px" /></div>
          </div>
        ))}
      </div>
      <div className="card">
        <Skeleton width="40%" height="16px" style={{ marginBottom: 16 }} />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 4px' }}>
            <Skeleton width="96px" height="20px" radius="999px" />
            <Skeleton width="130px" height="14px" />
            <Skeleton width="100%" height="14px" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }) {
  return (
    <div className="table-skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div className="ts-row" key={r} style={{ animationDelay: `${Math.min(r, 10) * 60}ms` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} width={`${c === 0 ? 45 : 100}%`} height="15px" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here', children }) {
  return (
    <div className="center-state empty-state">
      <div className="empty-state-icon"><Icon size={26} /></div>
      <div className="empty-state-title">{title}</div>
      {children && <div className="page-sub" style={{ margin: 0 }}>{children}</div>}
    </div>
  );
}
