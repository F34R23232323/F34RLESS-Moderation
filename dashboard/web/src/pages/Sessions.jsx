import React from 'react';
import { Ban, LogOut, KeyRound, AlertTriangle } from 'lucide-react';
import { useAsync } from '../hooks/useAsync';
import { api, raw } from '../api';
import { TableSkeleton, EmptyState } from '../components/Skeleton';
import { useToast } from '../components/Toast';

export default function Sessions() {
  const { data, loading, error, reload } = useAsync(() => api('/sessions'), []);
  const rows = data?.rows || [];
  const toast = useToast();

  async function revoke(id) {
    try {
      await api(`/sessions/${id}/revoke`, { method: 'POST' });
      toast.success('Session revoked');
      reload();
    } catch (e) {
      toast.error(e.message || 'Failed to revoke session');
    }
  }

  async function logout() {
    await raw('/oauth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard Sessions</h1>
          <p className="page-sub">Your active dashboard sessions. Revoke any you do not recognize.</p>
        </div>
        <div className="head-actions">
          <button className="btn sm danger" onClick={logout}><LogOut size={14} /> Log out</button>
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
          <TableSkeleton rows={5} cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState icon={KeyRound} title="No sessions">Sign in again to create a session.</EmptyState>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Expires</th>
                  <th>IP</th>
                  <th>User agent</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="mono">{new Date(r.expires_at).toLocaleString()}</td>
                    <td>{r.ip ?? '-'}</td>
                    <td className="pre">{r.user_agent ?? '-'}</td>
                    <td>{r.revoked ? <span className="badge yellow">revoked</span> : <span className="badge green">active</span>}</td>
                    <td>{!r.revoked && <button className="btn sm danger" onClick={() => revoke(r.id)}><Ban size={14} /> Revoke</button>}</td>
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
