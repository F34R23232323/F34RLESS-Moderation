import React, { useEffect, useState } from 'react';
import { Ban, LogOut } from 'lucide-react';
import { api, raw } from '../api';

export default function Sessions() {
  const [rows, setRows] = useState([]);

  async function load() {
    const data = await api('/sessions');
    setRows(data.rows);
  }

  useEffect(() => {
    load();
  }, []);

  async function revoke(id) {
    await api(`/sessions/${id}/revoke`, { method: 'POST' });
    load();
  }

  async function logout() {
    await raw('/oauth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  }

  return (
    <>
      <h1 className="page-title">Dashboard Sessions</h1>
      <p className="page-sub">Your active dashboard sessions. Revoke any you do not recognize.</p>

      <div className="card">
        <button className="btn sm danger" onClick={logout}><LogOut size={14} /> Log out</button>
        <table style={{ marginTop: 12 }}>
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
    </>
  );
}