import React, { useEffect, useState } from 'react';
import { CheckCircle2, Save, Download, Upload } from 'lucide-react';
import { api } from '../api';

export default function ConfigEditor() {
  const [yaml, setYaml] = useState('');
  const [path, setPath] = useState('');
  const [issues, setIssues] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api('/config').then((d) => {
      setYaml(d.yaml);
      setPath(d.configPath);
    }).catch(() => {});
  }, []);

  async function validate() {
    const res = await api('/config/validate', { method: 'POST', body: JSON.stringify({ yaml }) });
    setIssues(res.issues ?? []);
    setMessage(res.ok ? 'Config is valid.' : 'Config has errors.');
  }

  async function save() {
    const res = await api('/config/validate', { method: 'POST', body: JSON.stringify({ yaml }) });
    if (!res.ok) {
      setIssues(res.issues ?? []);
      setMessage('Validation failed — not saving.');
      return;
    }
    await api('/config/save', { method: 'POST', body: JSON.stringify({ yaml }) });
    setIssues([]);
    setMessage('Saved and validated.');
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
  }

  return (
    <>
      <h1 className="page-title">Config Editor</h1>
      <p className="page-sub">Edit <span className="mono">{path}</span>. Validated before save.</p>

      <div className="card">
        <div className="filters">
          <button className="btn sm secondary" onClick={validate}><CheckCircle2 size={14} /> Validate</button>
          <button className="btn sm" onClick={save}><Save size={14} /> Save</button>
          <button className="btn sm secondary" onClick={download}><Download size={14} /> Download</button>
          <label className="btn sm secondary" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Upload
            <input type="file" accept=".yml,.yaml" style={{ display: 'none' }} onChange={upload} />
          </label>
        </div>
        {message && <p>{message}</p>}
        {issues.length > 0 && (
          <div className="log-stream" style={{ marginBottom: 12 }}>
            {issues.map((i, idx) => (
              <div className="log-line" key={idx}><span className="badge red">{i.path || '(root)'}</span> {i.message || `${i.expected} — ${i.found}`}</div>
            ))}
          </div>
        )}
        <textarea
          value={yaml}
          onChange={(e) => setYaml(e.target.value)}
          style={{ minHeight: '60vh', fontFamily: 'Consolas, monospace', fontSize: 12 }}
        />
      </div>
    </>
  );
}