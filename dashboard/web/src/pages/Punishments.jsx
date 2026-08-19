import React from 'react';
import { RefreshCw, Timer, AlertTriangle } from 'lucide-react';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api';
import { TableSkeleton, EmptyState } from '../components/Skeleton';
import { useToast } from '../components/Toast';

export default function Punishments() {
  const { data, loading, error, reload } = useAsync(() => api('/punishments'), []);
  const rows = data?.rows || [];
  const toast = useToast();

  async function revoke(id) {
    try {
      await api(`/punishments/${id}/revoke`, { method: 'POST' });
      toast.success('Punishment revoked');
      reload();
    } catch (e) {
      toast.error(e.message || 'Failed to revoke punishment');
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Active Punishments</h1>
          <p className="page-sub">Timed mutes, temp-bans and temp-roles, with countdown to expiry.</p>
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
          <TableSkeleton rows={6} cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Timer} title="No active punishments">Everything is calm right now.</EmptyState>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Type</th>
                  <th>Case</th>
                  <th>Expires</th>
                  <th>Remaining</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">@{r.userId}</td>
                    <td>{r.type}</td>
                    <td>{r.caseId ? `#${r.caseId}` : '-'}</td>
                    <td className="mono">{new Date(r.expiresAt).toLocaleString()}</td>
                    <td className="mono">{Math.max(0, Math.floor(r.remainingMs / 60000))}m</td>
                    <td><button className="btn sm danger" onClick={() => revoke(r.id)}>Revoke</button></td>
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
