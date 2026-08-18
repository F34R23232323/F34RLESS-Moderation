import React, { useState } from 'react';
import { Clock } from 'lucide-react';

const FLAGS = [
  { flag: 't', label: 'Short time' },
  { flag: 'T', label: 'Long time' },
  { flag: 'd', label: 'Short date' },
  { flag: 'D', label: 'Long date' },
  { flag: 'f', label: 'Short date/time' },
  { flag: 'F', label: 'Long date/time' },
  { flag: 'R', label: 'Relative' },
];

export default function Timestamp() {
  const [input, setInput] = useState('');
  const [outputs, setOutputs] = useState(null);

  function generate() {
    const parsed = input ? Date.parse(input) : Date.now();
    if (Number.isNaN(parsed)) {
      setOutputs({ error: 'Could not parse that date.' });
      return;
    }
    const ts = Math.floor(parsed / 1000);
    setOutputs(
      FLAGS.map(({ flag, label }) => ({
        flag,
        label,
        code: `<t:${ts}:${flag}>`,
        preview: new Date(parsed).toLocaleString(),
      })),
    );
  }

  async function copy(text) {
    await navigator.clipboard.writeText(text);
  }

  return (
    <>
      <h1 className="page-title">Timestamp Generator</h1>
      <p className="page-sub">Produces Discord <span className="mono">&lt;t:...:F&gt;</span> codes. Matches the bot's <span className="mono">/timestamp</span> command.</p>

      <div className="card">
        <div className="filters">
          <input placeholder="Date/time (leave empty for now)" value={input} onChange={(e) => setInput(e.target.value)} style={{ flex: 1 }} />
          <button className="btn sm" onClick={generate}><Clock size={14} /> Generate</button>
        </div>
        {outputs?.error && <p><span className="badge red">error</span> {outputs.error}</p>}
        {outputs && !outputs.error && (
          <table>
            <thead>
              <tr>
                <th>Flag</th>
                <th>Label</th>
                <th>Code</th>
                <th>Preview</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {outputs.map((o) => (
                <tr key={o.flag}>
                  <td className="mono">{o.flag}</td>
                  <td>{o.label}</td>
                  <td className="mono">{o.code}</td>
                  <td>{o.preview}</td>
                  <td><button className="btn sm secondary" onClick={() => copy(o.code)}>Copy</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}