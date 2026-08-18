import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function Audit() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api('/config/audit').then((d) => setRows(d.rows)).catch(() => {});
  }, []);

  return (
    <>
      <h1 className="page-title">Config Change Audit Trail</h1>
      <p className="page-sub">Every dashboard or command-driven config change, with who and when.</p>

      <div className="card">
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
    </>
  );
}