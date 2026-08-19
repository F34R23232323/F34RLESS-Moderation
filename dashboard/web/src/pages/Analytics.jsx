import React from 'react';
import { RefreshCw, BarChart3, AlertTriangle } from 'lucide-react';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api';
import { TableSkeleton, EmptyState } from '../components/Skeleton';

export default function Analytics() {
  const { data, loading, error, reload } = useAsync(() => api('/analytics'), []);
  const rows = data?.rows || [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Command Analytics</h1>
          <p className="page-sub">Per-command invocation counts, success/failure and average execution time.</p>
        </div>
        <div className="head-actions">
          <button className="btn sm secondary" onClick={reload} disabled={loading}><RefreshCw size={14} className={loading ? 'spin-soft' : ''} /> Refresh</button>
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
          <TableSkeleton rows={7} cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState icon={BarChart3} title="No analytics yet">Run some commands to see usage data.</EmptyState>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Command</th>
                  <th>Surface</th>
                  <th>Uses</th>
                  <th>Success</th>
                  <th>Failed</th>
                  <th>Avg duration (ms)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.command}-${r.surface}`}>
                    <td className="mono">{r.command}</td>
                    <td>{r.surface}</td>
                    <td>{r.uses}</td>
                    <td>{r.success}</td>
                    <td>{r.failed}</td>
                    <td>{r.avg_duration_ms ?? '-'}</td>
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
