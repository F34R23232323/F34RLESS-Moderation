import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../api';

export default function AutomodLogs() {
  const [filters, setFilters] = useState({ rule: '', user: '', channel: '' });
  const [rows, setRows] = useState([]);

  async function load() {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    const data = await api(`/logs/automod-logs?${params}`);
    setRows(data.rows);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <h1 className="page-title">Automod Logs</h1>
      <p className="page-sub">Dedicated automod trigger stream, separate from the general audit log.</p>

      <div className="card">
        <div className="filters">
          <input placeholder="Rule" value={filters.rule} onChange={(e) => setFilters({ ...filters, rule: e.target.value })} />
          <input placeholder="User ID" value={filters.user} onChange={(e) => setFilters({ ...filters, user: e.target.value })} />
          <input placeholder="Channel ID" value={filters.channel} onChange={(e) => setFilters({ ...filters, channel: e.target.value })} />
          <button className="btn sm" onClick={load}><Search size={14} /> Apply</button>
        </div>
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
                <td>@{r.user_id}</td>
                <td className="pre">{r.content_snippet}</td>
                <td>{r.response_suppressed ? <span className="badge yellow">throttled</span> : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}