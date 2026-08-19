import React from 'react';
import { History, AlertTriangle } from 'lucide-react';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api';
import { TableSkeleton, EmptyState } from '../components/Skeleton';

export default function Audit() {
  const { data, loading, error, reload } = useAsync(() => api('/config/audit'), []);
  const rows = data?.rows || [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Config Change Audit Trail</h1>
          <p className="page-sub">Every dashboard or command-driven config change, with who and when.</p>
        </div>
      </div>

      <div className="card">
        {error && (
          <div className="inline-error" style={{ marginBottom: 12 }}>
            <AlertTriangle size={16} /><span>{error}</span>
            <button className="btn sm" onClick={reload}>Retry</button>
          </div>
        )}
        {loading ? (
          <TableSkeleton rows={7} cols={4} />
        ) : rows.length === 0 ? (
          <EmptyState icon={History} title="No changes recorded">Config changes will appear here.</EmptyState>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Source</th>
                  <th>Path</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{new Date(r.created_at).toLocaleString()}</td>
                    <td>{r.actor_id ? `@${r.actor_id}` : '-'}</td>
                    <td>{r.source}</td>
                    <td className="mono">{r.path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
