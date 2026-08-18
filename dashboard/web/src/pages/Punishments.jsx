import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../api';

export default function Punishments() {
  const [rows, setRows] = useState([]);

  async function load() {
    const data = await api('/punishments');
    setRows(data.rows);
  }

  useEffect(() => {
    load();
  }, []);

  async function revoke(id) {
    await api(`/punishments/${id}/revoke`, { method: 'POST' });
    load();
  }

  return (
    <>
      <h1 className="page-title">Active Punishments</h1>
      <p className="page-sub">Timed mutes, temp-bans and temp-roles, with countdown to expiry.</p>

      <div className="card">
        <button className="btn sm secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>
        <table style={{ marginTop: 12 }}>
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
                <td>@{r.userId}</td>
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
    </>
  );
}