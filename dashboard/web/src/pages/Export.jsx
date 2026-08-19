import React, { useState } from 'react';
import { Download, Database, Loader2 } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

export default function Export() {
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function exportSnapshot() {
    if (busy) return;
    setBusy(true);
    try {
      const data = await api('/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `guild-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Snapshot exported — check your downloads.');
    } catch (e) {
      toast.error(e.message || 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="page-title">Export / Backup</h1>
      <p className="page-sub">Export cases, warnings, notes, reports and custom commands as JSON.</p>

      <div className="card">
        <button className="btn" onClick={exportSnapshot} disabled={busy}>
          {busy ? <Loader2 size={16} className="spin-soft" /> : <Download size={16} />}
          {busy ? 'Exporting…' : 'Export snapshot'}
        </button>
        <div className="filters" style={{ marginTop: 16 }}>
          <Database size={16} />
          <span className="page-sub">Database backups run automatically each night (config: <span className="mono">ops.backups_enabled</span>) and are kept per <span className="mono">ops.backup_retention_count</span>.</span>
        </div>
      </div>
    </>
  );
}
