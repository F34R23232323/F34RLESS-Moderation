import React, { useEffect, useState, useCallback } from 'react';
import { raw } from '../api';

function formatRateLimit(ms) {
  if (ms <= 0) return null;
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `Available in ${m}m`;
  return `Available in ${Math.ceil(m / 60)}h`;
}

export default function GdprPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0); // 0=none, 1=confirm, 2=typed
  const [deleteInput, setDeleteInput] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('success'); // 'success' | 'error'

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await raw('/api/gdpr/summary');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const showFeedback = (msg, type = 'success') => {
    setFeedback(msg);
    setFeedbackType(type);
    setTimeout(() => setFeedback(''), 6000);
  };

  const handleExport = async () => {
    if (!data || data.rateLimits.export > 0) return;
    setExporting(true);
    try {
      const res = await fetch('/api/gdpr/export', { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gdpr-export-${data.userId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await loadData();
      showFeedback('Data export downloaded.');
    } catch (err) {
      showFeedback(`Export failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!data || data.rateLimits.delete > 0) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/gdpr/delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      showFeedback('Your personal data has been anonymized. This cannot be undone.');
      setDeleteStep(0);
      setDeleteInput('');
      await loadData();
    } catch (err) {
      showFeedback(`Delete failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleOptOut = async (key, value) => {
    try {
      const res = await fetch('/api/gdpr/opt-out', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }
      showFeedback('Preference saved.');
      await loadData();
    } catch (err) {
      showFeedback(`Failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  if (loading) {
    return (
      <div className="center-state">
        <div className="empty-state-icon">⏳</div>
        <div className="empty-state-title">Loading your data…</div>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1 className="page-title">Data &amp; Privacy</h1>
            <p className="page-sub">Manage the data this bot stores about your Discord account.</p>
          </div>
        </div>
        <div className="inline-error">
          <span>{error}</span>
          <button className="btn sm secondary" onClick={loadData}>Retry</button>
        </div>
      </>
    );
  }

  if (!data) return null;

  const totalItems = Object.values(data.counts).reduce((s, c) => s + c.count, 0);
  const rateLimitExport = formatRateLimit(data.rateLimits.export);
  const rateLimitDelete = formatRateLimit(data.rateLimits.delete);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Data &amp; Privacy</h1>
          <p className="page-sub">
            Review, export, or delete the data this bot stores about your Discord account.
          </p>
        </div>
        <div className="head-actions">
          <button className="btn sm secondary" onClick={loadData}>Refresh</button>
        </div>
      </div>

      {feedback && (
        <div
          className="inline-error"
          style={feedbackType === 'success'
            ? { background: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.3)', color: 'var(--success)' }
            : undefined
          }
        >
          <span>{feedback}</span>
        </div>
      )}

      {/* ── Data Inventory ──────────────────────────────────────────────── */}
      <div className="stats">
        <div className="stat">
          <div className="label">Total Records</div>
          <div className="value">{totalItems.toLocaleString()}</div>
        </div>
        <div className="stat">
          <div className="label">Tables With Data</div>
          <div className="value">
            {Object.values(data.counts).filter(c => c.count > 0).length}
            <small> / {Object.keys(data.counts).length}</small>
          </div>
        </div>
      </div>

      {totalItems > 0 ? (
        <div className="card">
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Data Breakdown</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Records</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.counts)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([key, c]) => (
                    <tr key={key}>
                      <td>{c.label}</td>
                      <td>
                        <span className={`badge ${c.count > 0 ? 'blue' : ''}`}>
                          {c.count.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="center-state" style={{ padding: '32px 16px' }}>
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">No data stored</div>
            <p className="page-sub" style={{ margin: 0 }}>This account has no recorded data in the system.</p>
          </div>
        </div>
      )}

      {/* ── Export ──────────────────────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Export Your Data</h2>
        <p className="page-sub" style={{ margin: '0 0 14px' }}>
          Download a JSON file containing all data stored about your account. Rate limited to once per hour.
        </p>
        <div className="action-row">
          <button
            className="btn sm"
            onClick={handleExport}
            disabled={exporting || data.rateLimits.export > 0}
          >
            {exporting ? 'Exporting…' : rateLimitExport || 'Download Export'}
          </button>
          {rateLimitExport && (
            <span className="badge yellow">{rateLimitExport}</span>
          )}
        </div>
      </div>

      {/* ── Delete ──────────────────────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Delete Your Data</h2>
        <p className="page-sub" style={{ margin: '0 0 14px' }}>
          Anonymize all personal data associated with your account. This is irreversible and rate limited to once per week.
        </p>

        {deleteStep === 0 && (
          <div className="action-row">
            <button
              className="btn sm danger"
              onClick={() => { setDeleteStep(1); setDeleteInput(''); }}
              disabled={data.rateLimits.delete > 0}
            >
              {rateLimitDelete || 'Request Deletion'}
            </button>
            {rateLimitDelete && (
              <span className="badge yellow">{rateLimitDelete}</span>
            )}
          </div>
        )}

        {deleteStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            <p className="hint" style={{ margin: 0, color: 'var(--danger)' }}>
              Are you sure? This will anonymize all your message snapshots, reports, warnings, sessions, and other records. Type <b>DELETE</b> to confirm.
            </p>
            <div className="action-row">
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder='Type "DELETE" to confirm'
                autoFocus
                style={{ width: 220 }}
              />
              <button
                className="btn sm danger"
                onClick={() => setDeleteStep(2)}
                disabled={deleteInput !== 'DELETE'}
              >
                Continue
              </button>
              <button className="btn sm secondary" onClick={() => { setDeleteStep(0); setDeleteInput(''); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {deleteStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            <p className="hint" style={{ margin: 0, color: 'var(--danger)' }}>
              Final confirmation. Click below to permanently anonymize your data.
            </p>
            <div className="action-row">
              <button
                className="btn sm danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Yes, Delete Everything'}
              </button>
              <button className="btn sm secondary" onClick={() => setDeleteStep(0)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Collection Preferences ─────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Collection Preferences</h2>
        <p className="page-sub" style={{ margin: '0 0 14px' }}>
          Opt out of specific data collection types. Changes apply to future events only.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <OptToggle
            checked={data.privacy.optOutSnapshots}
            onChange={(v) => handleOptOut('snapshots', v)}
            title="Message snapshots"
            desc="Stop recording your messages for logging, archives, and case evidence."
          />
          <OptToggle
            checked={data.privacy.optOutAutomodLog}
            onChange={(v) => handleOptOut('automodLog', v)}
            title="Automod trigger logs"
            desc="Stop storing content snippets when automod flags your messages."
          />
          <OptToggle
            checked={data.privacy.optOutReportTarget}
            onChange={(v) => handleOptOut('reportTarget', v)}
            title="Report target storage"
            desc="Opt out of being stored as the target in moderation reports."
          />
        </div>
      </div>

      {/* ── Your User ID ───────────────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>Account Info</h2>
        <div className="table-scroll">
          <table>
            <tbody>
              <tr>
                <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Discord User ID</td>
                <td className="mono">{data.userId}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Last Export</td>
                <td>{data.rateLimits.export > 0 ? formatRateLimit(data.rateLimits.export) : 'None recorded'}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Last Deletion</td>
                <td>{data.rateLimits.delete > 0 ? formatRateLimit(data.rateLimits.delete) : 'None recorded'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function OptToggle({ checked, onChange, title, desc }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 3, accentColor: 'var(--accent)' }}
      />
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>
        <div className="hint" style={{ margin: '2px 0 0' }}>{desc}</div>
      </div>
    </label>
  );
}
