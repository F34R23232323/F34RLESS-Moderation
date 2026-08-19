import React, { useState } from 'react';
import { FlaskConical, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../components/Toast';

function highlight(text, matches) {
  if (!matches || matches.length === 0) return text;
  const sorted = [...matches].sort((a, b) => a.index - b.index);
  const parts = [];
  let cursor = 0;
  for (const m of sorted) {
    if (m.index > cursor) parts.push(text.slice(cursor, m.index));
    parts.push(<mark key={m.index} className="match-hi">{text.slice(m.index, m.index + m.match.length)}</mark>);
    cursor = m.index + m.match.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

export default function RegexTest() {
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('gi');
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function test() {
    if (busy) return;
    setBusy(true);
    try {
      const params = new URLSearchParams({ pattern, flags, text });
      const res = await api(`/regex-test?${params}`);
      setResult(res);
      if (!res.valid) toast.error(res.error || 'Invalid pattern');
    } catch (e) {
      toast.error(e.message || 'Test failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="page-title">Regex Tester</h1>
      <p className="page-sub">Test patterns against the same engine the automod regex module uses in production.</p>

      <div className="card">
        <div className="filters">
          <input placeholder="Pattern, e.g. \b(slur1|slur2)\b" value={pattern} onChange={(e) => setPattern(e.target.value)} style={{ flex: 1 }} onKeyDown={(e) => e.key === 'Enter' && test()} />
          <input placeholder="flags" value={flags} onChange={(e) => setFlags(e.target.value)} style={{ width: 70 }} />
          <button className="btn sm" onClick={test} disabled={busy}>{busy ? <Loader2 size={14} className="spin-soft" /> : <FlaskConical size={14} />} Test</button>
        </div>
        <textarea placeholder="Sample text" value={text} onChange={(e) => setText(e.target.value)} />

        {result && (
          <div style={{ marginTop: 12 }}>
            {!result.valid && (
              <div className="inline-error" style={{ marginBottom: 0 }}>
                <AlertTriangle size={16} /><span>Invalid pattern: {result.error}</span>
              </div>
            )}
            {result.valid && (
              <>
                <p><span className="badge green">{result.matches.length} match(es)</span></p>
                <div className="log-stream">
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{highlight(text, result.matches)}</pre>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
