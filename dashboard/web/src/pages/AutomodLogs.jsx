import React, { useState } from 'react';
import { Search, ShieldAlert, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useAsync } from '../hooks/useAsync';
import { api } from '../api';
import { TableSkeleton, EmptyState } from '../components/Skeleton';

export default function AutomodLogs() {
  const [draft, setDraft] = useState({ rule: '', user: '', channel: '' });
  const [applied, setApplied] = useState({ rule: '', user: '', channel: '' });

  const { data, loading, error, reload } = useAsync(() => {
    const params = new URLSearchParams();
    Object.entries(applied).forEach(([k, v]) => v && params.set(k, v));
    return api(`/logs/automod-logs?${params}`);
  }, [applied]);

  const rows = data?.rows || [];
  const hasFilter = Object.values(applied).some(Boolean);

  function apply(next) {
    setApplied(next);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Automod Logs</h1>
          <p className="page-sub">Dedicated automod trigger stream, separate from the general audit log.</p>
        </div>
        <div className="head-actions">
          <button className="btn sm secondary" onClick={reload} disabled={loading}><RefreshCw size={14} className={loading ? 'spin-soft' : ''} /> Refresh</button>
        </div>
      </div>

      <div className="card">
        <div className="filters" style={{ marginBottom: 12 }}>
          <input placeholder="Rule" value={draft.rule} onChange={(e) => setDraft({ ...draft, rule: e.target.value })} />
          <input placeholder="User ID" value={draft.user} onChange={(e) => setDraft({ ...draft, user: e.target.value })} />
          <input placeholder="Channel ID" value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value })} />
          <button className="btn sm" onClick={() => apply(draft)}><Search size={14} /> Apply</button>
          {hasFilter && <button className="btn sm secondary" onClick={() => { const empty = { rule: '', user: '', channel: '' }; setDraft(empty); apply(empty); }}><X size={14} /> Clear</button>}
        </div>

        {error && (
          <div className="inline-error" style={{ marginBottom: 12 }}>
            <AlertTriangle size={16} /><span>{error}</span>
            <button className="btn sm" onClick={reload}>Retry</button>
          </div>
        )}
        {loading ? (
          <TableSkeleton rows={7} cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState icon={ShieldAlert} title={hasFilter ? 'No matching triggers' : 'No automod triggers'}>
            {hasFilter ? 'Try adjusting your filters.' : 'Automod events will appear here.'}
          </EmptyState>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Rule</th>
                  <th>Module</th>
                  <th>User</th>
                  <th>Snippet</th>
                  <th>Suppressed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{new Date(r.created_at).toLocaleString()}</td>
                    <td>{r.rule}</td>
                    <td>{r.module}</td>
                    <td>
                      {r.user_display_name || r.user_username ? `${r.user_display_name || r.user_username}` : `@${r.user_id}`}
                      <span className="mono dim" style={{ fontSize: 11 }}> ({r.user_id})</span>
                    </td>
                    <td className="pre">{r.content_snippet}</td>
                    <td>{r.response_suppressed ? <span className="badge yellow">throttled</span> : '-'}</td>
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
