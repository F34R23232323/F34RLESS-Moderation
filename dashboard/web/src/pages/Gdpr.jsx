import React, { useEffect, useState, useCallback } from 'react';
import { raw } from '../api';

function formatRateLimit(ms) {
  if (ms <= 0) return 'Available now';
  const m = Math.ceil(ms / 60000);
  return m < 60 ? `Available in ${m} minute(s)` : `Available in ${Math.ceil(m / 60)} hour(s)`;
}

export default function GdprPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [feedback, setFeedback] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await raw('/api/gdpr/summary');
      if (res.error) throw new Error(res.message || res.error);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExport = async () => {
    if (!data || data.rateLimits.export > 0) return;
    setExporting(true);
    try {
      const res = await fetch('/api/gdpr/export', { credentials: 'include' });
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
    } catch (err) {
      setFeedback(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!data || data.rateLimits.delete > 0 || !deleteConfirm) return;
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
      setFeedback('Your data has been anonymized.');
      await loadData();
    } catch (err) {
      setFeedback(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const handleOptOut = async (key, value) => {
    try {
      await fetch('/api/gdpr/opt-out', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      setFeedback('Privacy preference saved.');
      await loadData();
    } catch (err) {
      setFeedback(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (loading) return <div className="page-wrap"><p className="page-sub">Loading…</p></div>;
  if (error) return <div className="page-wrap"><p className="page-sub" style={{ color: '#f87171' }}>{error}</p></div>;
  if (!data) return null;

  const totalItems = Object.values(data.counts).reduce((s, c) => s + c.count, 0);

  return (
    <div className="page-wrap">
      <h1 className="page-title">Data &amp; Privacy</h1>
      <p className="page-sub">
        Manage the data this bot stores about your Discord account. You can review, export,
        delete, or opt out of data collection.
      </p>

      {feedback && (
        <div className="banner" style={{ background: '#1a3a2a', border: '1px solid #2d6a4f', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#a7f3d0' }}>
          {feedback}
        </div>
      )}

      {/* Data summary */}
      <div style={{ background: '#2b2d31', borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>Data We Store</h2>
        <p style={{ color: '#949ba4', fontSize: 13, marginBottom: 12 }}>
          {totalItems === 0 ? 'No data found for this account.' : `Total records: ${totalItems.toLocaleString()}`}
        </p>
        {totalItems > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {Object.entries(data.counts)
              .filter(([, c]) => c.count > 0)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([key, c]) => (
                <div key={key} style={{ background: '#1e1f22', borderRadius: 6, padding: '8px 12px' }}>
                  <div style={{ fontSize: 11, color: '#949ba4' }}>{c.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{c.count.toLocaleString()}</div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Export */}
      <div style={{ background: '#2b2d31', borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Export Your Data</h2>
        <p style={{ color: '#949ba4', fontSize: 13, marginBottom: 12 }}>
          Download a JSON file containing all data stored about your account across every server.
          Rate limited to one export per hour.
        </p>
        <button
          className="btn"
          onClick={handleExport}
          disabled={exporting || data.rateLimits.export > 0}
          style={{ opacity: data.rateLimits.export > 0 ? 0.5 : 1 }}
        >
          {exporting ? 'Exporting…' : data.rateLimits.export > 0 ? formatRateLimit(data.rateLimits.export) : 'Download Data Export'}
        </button>
      </div>

      {/* Delete */}
      <div style={{ background: '#2b2d31', borderRadius: 8, padding: 20, marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Delete Your Data</h2>
        <p style={{ color: '#949ba4', fontSize: 13, marginBottom: 12 }}>
          Anonymize all personal data associated with your account. This action is irreversible and
          rate limited to once per week.
        </p>
        {deleteConfirm ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn"
              style={{ background: '#da373c' }}
              onClick={handleDelete}
              disabled={deleting || data.rateLimits.delete > 0}
            >
              {deleting ? 'Deleting…' : 'Confirm Delete'}
            </button>
            <button className="btn btn-secondary" onClick={() => setDeleteConfirm(false)}>Cancel</button>
            <span style={{ color: '#949ba4', fontSize: 12 }}>This cannot be undone.</span>
          </div>
        ) : (
          <button
            className="btn btn-danger"
            onClick={() => setDeleteConfirm(true)}
            disabled={data.rateLimits.delete > 0}
            style={{ opacity: data.rateLimits.delete > 0 ? 0.5 : 1 }}
          >
            {data.rateLimits.delete > 0 ? formatRateLimit(data.rateLimits.delete) : 'Request Data Deletion'}
          </button>
        )}
      </div>

      {/* Opt-out preferences */}
      <div style={{ background: '#2b2d31', borderRadius: 8, padding: 20 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Collection Preferences</h2>
        <p style={{ color: '#949ba4', fontSize: 13, marginBottom: 12 }}>
          Opt out of specific data collection types. Changes apply to future events.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={data.privacy.optOutSnapshots}
              onChange={(e) => handleOptOut('snapshots', e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#5865f2' }}
            />
            <div>
              <div style={{ fontWeight: 500 }}>Message snapshots</div>
              <div style={{ fontSize: 12, color: '#949ba4' }}>Stop recording your messages for logging, archives, and case evidence.</div>
            </div>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={data.privacy.optOutAutomodLog}
              onChange={(e) => handleOptOut('automodLog', e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#5865f2' }}
            />
            <div>
              <div style={{ fontWeight: 500 }}>Automod trigger logs</div>
              <div style={{ fontSize: 12, color: '#949ba4' }}>Stop storing content snippets when automod flags your messages.</div>
            </div>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={data.privacy.optOutReportTarget}
              onChange={(e) => handleOptOut('reportTarget', e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#5865f2' }}
            />
            <div>
              <div style={{ fontWeight: 500 }}>Report target storage</div>
              <div style={{ fontSize: 12, color: '#949ba4' }}>Opt out of being stored as the target in moderation reports.</div>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}