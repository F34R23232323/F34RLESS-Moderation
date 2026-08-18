import React, { useState } from 'react';
import { Download, Upload, Database } from 'lucide-react';
import { api } from '../api';

export default function Export() {
  const [message, setMessage] = useState('');

  async function exportSnapshot() {
    const data = await api('/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guild-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Snapshot exported.');
  }

  return (
    <>
      <h1 className="page-title">Export / Backup</h1>
      <p className="page-sub">Export cases, warnings, notes, reports and custom commands as JSON.</p>

      <div className="card">
        <button className="btn" onClick={exportSnapshot}><Download size={16} /> Export snapshot</button>
        <div className="filters" style={{ marginTop: 16 }}>
          <Database size={16} />
          <span className="page-sub">Database backups run automatically each night (config: <span className="mono">ops.backups_enabled</span>) and are kept per <span className="mono">ops.backup_retention_count</span>.</span>
        </div>
        {message && <p>{message}</p>}
      </div>
    </>
  );
}