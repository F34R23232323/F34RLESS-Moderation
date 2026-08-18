import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../api';

export default function Analytics() {
  const [rows, setRows] = useState([]);

  async function load() {
    const data = await api('/analytics');
    setRows(data.rows);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <h1 className="page-title">Command Analytics</h1>
      <p className="page-sub">Per-command invocation counts, success/failure and average execution time.</p>

      <div className="card">
        <button className="btn sm secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>
        <table style={{ marginTop: 12 }}>
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
                <td>{r.command}</td>
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
    </>
  );
}