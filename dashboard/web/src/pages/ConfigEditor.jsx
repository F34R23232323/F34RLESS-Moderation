import React, { useEffect, useState } from 'react';
import { CheckCircle2, Save, Download, Upload, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import { Skeleton } from '../components/Skeleton';
import { useToast } from '../components/Toast';

export default function ConfigEditor() {
  const [yaml, setYaml] = useState('');
  const [path, setPath] = useState('');
  const [issues, setIssues] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const toast = useToast();

  useEffect(() => {
    api('/config').then((d) => {
      setYaml(d.yaml);
      setPath(d.configPath);
    }).catch((e) => {
      toast.error(e.message || 'Failed to load config');
    }).finally(() => setLoading(false));
  }, []);

  async function validate() {
    setBusy('validate');
    try {
      const res = await api('/config/validate', { method: 'POST', body: JSON.stringify({ yaml }) });
      setIssues(res.issues ?? []);
      const ok = res.ok ? 'Config is valid.' : 'Config has errors.';
      setMessage(ok);
      if (res.ok) toast.success(ok);
      else toast.error(ok);
    } catch (e) {
      toast.error(e.message || 'Validation failed');
    } finally {
      setBusy('');
    }
  }

  async function save() {
    setBusy('save');
    try {
      const res = await api('/config/validate', { method: 'POST', body: JSON.stringify({ yaml }) });
      if (!res.ok) {
        setIssues(res.issues ?? []);
        setMessage('Validation failed — not saving.');
        toast.error('Validation failed — not saving.');
        return;
      }
      await api('/config/save', { method: 'POST', body: JSON.stringify({ yaml }) });
      setIssues([]);
      setMessage('Saved and validated.');
      toast.success('Config saved and validated.');
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setBusy('');
    }
  }

  async function download() {
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.yml';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function upload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setYaml(text);
    setMessage('File loaded — validate before saving.');
  }

  return (
    <>
      <h1 className="page-title">Config Editor</h1>
      <p className="page-sub">Edit <span className="mono">{path || 'config.yml'}</span>. Validated before save.</p>

      <div className="card">
        <div className="filters">
          <button className="btn sm secondary" onClick={validate} disabled={busy === 'validate'}>{busy === 'validate' ? <Loader2 size={14} className="spin-soft" /> : <CheckCircle2 size={14} />} Validate</button>
          <button className="btn sm" onClick={save} disabled={busy === 'save'}>{busy === 'save' ? <Loader2 size={14} className="spin-soft" /> : <Save size={14} />} Save</button>
          <button className="btn sm secondary" onClick={download}><Download size={14} /> Download</button>
          <label className="btn sm secondary" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Upload
            <input type="file" accept=".yml,.yaml" style={{ display: 'none' }} onChange={upload} />
          </label>
        </div>
        {message && (
          <div className={`config-status ${issues.length > 0 ? 'err' : ''}`}>
            {issues.length > 0 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />} {message}
          </div>
        )}
        {issues.length > 0 && (
          <div className="log-stream" style={{ marginBottom: 12 }}>
            {issues.map((i, idx) => (
              <div className="log-line" key={idx}><span className="badge red">{i.path || '(root)'}</span> {i.message || `${i.expected} — ${i.found}`}</div>
            ))}
          </div>
        )}
        {loading ? (
          <div style={{ padding: '8px 2px' }}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} height="13px" style={{ marginBottom: 12, display: 'block' }} />)}
          </div>
        ) : (
          <textarea
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            style={{ minHeight: '60vh', fontFamily: 'Consolas, monospace', fontSize: 12 }}
            spellCheck={false}
          />
        )}
      </div>
    </>
  );
}