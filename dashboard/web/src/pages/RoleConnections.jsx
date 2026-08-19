import React, { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Plus, Trash2, Copy, Play, Save, RotateCcw } from 'lucide-react';
import { api } from '../api';

const LOGIC_LABELS = { all: 'AND — all conditions must be true', any: 'OR — any condition being true' };

function emptyConnection() {
  return {
    enabled: true,
    name: '',
    main_role: '',
    logic: 'any',
    held_for_seconds: 0,
    conditions: [{ has_role: true, role_id: '' }],
  };
}

function yamlOf(conn) {
  const lines = ['  - enabled: ' + (conn.enabled ? 'true' : 'false')];
  if (conn.name && conn.name.trim()) lines.push(`    name: "${String(conn.name).replace(/"/g, '\\"')}"`);
  lines.push(`    main_role: "${conn.main_role}"`);
  lines.push(`    logic: ${conn.logic}`);
  lines.push(`    held_for_seconds: ${Number(conn.held_for_seconds) || 0}`);
  lines.push('    conditions:');
  for (const c of conn.conditions) {
    if (!c.role_id) continue;
    lines.push(`      - has_role: ${c.has_role ? 'true' : 'false'}`);
    lines.push(`        role_id: "${c.role_id}"`);
  }
  return lines.join('\n');
}

function buildYamlBlock(state) {
  const out = ['role_connections:', `  enabled: ${state.enabled ? 'true' : 'false'}`, `  sync_interval_minutes: ${Number(state.sync_interval_minutes) || 5}`, '  connections:'];
  const conns = state.connections.filter((c) => c.main_role);
  if (conns.length === 0) out.push('    []');
  for (const c of conns) out.push(yamlOf(c));
  return out.join('\n');
}

export default function RoleConnections() {
  const [state, setState] = useState({ enabled: true, sync_interval_minutes: 5, connections: [] });
  const [roles, setRoles] = useState([]);
  const [sel, setSel] = useState(-1);
  const [simRoles, setSimRoles] = useState(new Set());
  const [result, setResult] = useState(null);
  const [yaml, setYaml] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api('/role-connections').then((d) => {
      setState({ enabled: d.enabled, sync_interval_minutes: d.sync_interval_minutes, connections: d.connections ?? [] });
      setRoles(d.roles ?? []);
      setSel(d.connections?.length ? 0 : -1);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const selected = sel >= 0 && sel < state.connections.length ? state.connections[sel] : null;

  const roleName = (id) => {
    const r = roles.find((x) => x.id === id);
    return r ? `${r.name} (${id})` : id || '(select role)';
  };

  const roleOptions = useMemo(() => {
    const map = new Map();
    for (const r of roles) {
      if (!map.has(r.guild_id)) map.set(r.guild_id, []);
      map.get(r.guild_id).push(r);
    }
    return [...map.entries()].map(([guildId, list]) => (
      <optgroup key={guildId} label={`Guild ${guildId}`}>
        {list.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} {r.managed ? '(managed)' : ''}
          </option>
        ))}
      </optgroup>
    ));
  }, [roles]);

  function patch(p) {
    if (!selected) return;
    const next = state.connections.map((c, i) => (i === sel ? { ...c, ...p } : c));
    setState({ ...state, connections: next });
  }

  function patchCondition(i, p) {
    if (!selected) return;
    const next = selected.conditions.map((c, j) => (j === i ? { ...c, ...p } : c));
    patch({ conditions: next });
  }

  function addCondition() {
    patch({ conditions: [...selected.conditions, { has_role: true, role_id: '' }] });
  }

  function removeCondition(i) {
    patch({ conditions: selected.conditions.filter((_, j) => j !== i) });
  }

  function addConnection() {
    const conn = emptyConnection();
    setState({ ...state, connections: [...state.connections, conn] });
    setSel(state.connections.length);
    setResult(null);
  }

  function removeConnection() {
    if (sel < 0) return;
    const next = state.connections.filter((_, i) => i !== sel);
    setState({ ...state, connections: next });
    setSel(next.length ? Math.max(0, sel - 1) : -1);
    setResult(null);
  }

  function selectConnection(i) {
    setSel(i);
    setResult(null);
  }

  function toggleSimRole(id) {
    const next = new Set(simRoles);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSimRoles(next);
    setResult(null);
  }

  async function simulate() {
    if (!selected) return;
    setMsg(null);
    if (!selected.main_role) {
      setMsg({ text: 'Select a main role first.', error: true });
      return;
    }
    const filled = selected.conditions.filter((c) => c.role_id);
    if (filled.length === 0) {
      setMsg({ text: 'Add at least one condition with a role selected.', error: true });
      return;
    }
    const body = { connection: { ...selected, conditions: filled }, memberRoleIds: [...simRoles] };
    const res = await api('/role-connections/simulate', { method: 'POST', body: JSON.stringify(body) });
    setResult(res.result);
  }

  async function copyYaml() {
    const block = buildYamlBlock(state);
    setYaml(block);
    try {
      await navigator.clipboard.writeText(block);
      setMsg({ text: 'YAML copied to clipboard.' });
    } catch {
      setMsg({ text: 'Could not write to clipboard — copy from the box below.', error: true });
    }
  }

  if (loading) {
    return (
      <div className="center-state">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Role Connections</h1>
          <p className="page-sub">
            Auto-manage a main role from role conditions, like Sapphire. Simulate settings here, then paste the generated YAML into config.yml.
          </p>
        </div>
        <div className="head-actions">
          <button className="btn sm secondary" onClick={copyYaml}><Copy size={14} /> Copy YAML</button>
        </div>
      </div>

      {msg && <p><span className={'badge ' + (msg.error ? 'red' : 'green')}>{msg.error ? 'error' : 'ok'}</span> {msg.text}</p>}

      <div className="card filter-card" style={{ marginBottom: 14 }}>
        <div className="filters">
          <label className="field" style={{ gap: 6 }}>
            <input type="checkbox" checked={state.enabled} onChange={(e) => setState({ ...state, enabled: e.target.checked })} />
            Module enabled
          </label>
          <label className="field">
            Sync every
            <input
              type="number"
              min="1"
              value={state.sync_interval_minutes}
              style={{ width: 80, marginLeft: 6 }}
              onChange={(e) => setState({ ...state, sync_interval_minutes: Number(e.target.value) || 5 })}
            />
            minutes
          </label>
          <span className="hint" style={{ margin: 0 }}>
            Re-syncs also run on role add / remove / update and when a referenced role is edited or deleted.
          </span>
        </div>
      </div>

      <div className="builder-grid">
        <div className="builder-editor">
          <div className="builder-side-head">
            <span className="builder-section-title">Connections</span>
            <button className="btn sm" onClick={addConnection}><Plus size={14} /> New</button>
          </div>
          <div className="card filter-card" style={{ marginBottom: 12 }}>
            {state.connections.length === 0 ? (
              <p className="hint" style={{ margin: 0 }}>No connections yet. Click “New” to create one.</p>
            ) : (
              state.connections.map((c, i) => (
                <div
                  key={i}
                  className={'template-item' + (i === sel ? ' active' : '')}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onClick={() => selectConnection(i)}
                >
                  <span className="template-name">{c.name || roleName(c.main_role)}</span>
                  <span className={'badge ' + (c.enabled ? 'green' : 'red')}>{c.enabled ? 'on' : 'off'}</span>
                </div>
              ))
            )}
          </div>

          {selected && (
            <div className="card builder-editor">
              <div className="builder-section-head">
                <span className="builder-section-title">Main role</span>
                <button className="btn sm secondary danger" onClick={removeConnection}><Trash2 size={14} /> Delete</button>
              </div>

              <div className="builder-section-body">
                <p className="hint" style={{ margin: '0 0 6px' }}>Name (optional, for the dashboard)</p>
                <input placeholder="e.g. Level 10 perk" value={selected.name || ''} onChange={(e) => patch({ name: e.target.value })} />
                <p className="hint">The main role is <b>assigned</b> when the conditions are met and <b>removed</b> the moment they stop being met.</p>
                <div className="field-row">
                  <select value={selected.main_role} onChange={(e) => patch({ main_role: e.target.value })}>
                    <option value="">— select main role —</option>
                    {roleOptions}
                  </select>
                  <select value={selected.logic} onChange={(e) => patch({ logic: e.target.value })} style={{ flex: '0 0 auto' }}>
                    <option value="any">OR (any)</option>
                    <option value="all">AND (all)</option>
                  </select>
                  <input
                    type="number"
                    min="0"
                    placeholder="held sec"
                    title="Conditions must stay met this many seconds before the role is applied"
                    value={selected.held_for_seconds}
                    style={{ width: 110, flex: '0 0 auto' }}
                    onChange={(e) => patch({ held_for_seconds: Number(e.target.value) || 0 })}
                  />
                </div>
                <p className="hint">{LOGIC_LABELS[selected.logic]}.</p>

                <div className="fields-head">
                  <span className="builder-section-title">Conditions</span>
                  <button className="btn sm secondary" onClick={addCondition}><Plus size={14} /> Add condition</button>
                </div>
                {selected.conditions.length === 0 && <p className="hint">Add at least one condition.</p>}
                {selected.conditions.map((c, i) => (
                  <div className="builder-subcard" key={i}>
                    <div className="builder-subcard-head">
                      <span className="badge blue">#{i + 1}</span>
                      <button className="btn sm secondary danger" onClick={() => removeCondition(i)}><Trash2 size={13} /></button>
                    </div>
                    <div className="field-row">
                      <select value={c.has_role ? 'has' : 'lacks'} onChange={(e) => patchCondition(i, { has_role: e.target.value === 'has' })} style={{ flex: '0 0 auto' }}>
                        <option value="has">has</option>
                        <option value="lacks">doesn’t have</option>
                      </select>
                      <select value={c.role_id} onChange={(e) => patchCondition(i, { role_id: e.target.value })}>
                        <option value="">— select role —</option>
                        {roleOptions}
                      </select>
                    </div>
                  </div>
                ))}

                {selected.main_role && selected.conditions.some((c) => c.role_id === selected.main_role) && (
                  <p><span className="badge red">warning</span> A condition must not reference the main role itself — it would flip every sync.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="builder-preview">
          <div className="card preview-card">
            <div className="preview-head"><FlaskConical size={15} /> Simulate a member</div>
            <p className="hint">Tick the roles the test member has, then run the simulation to see what would happen to the main role.</p>
            <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginBottom: 10 }}>
              {roles.length === 0 && <p className="hint" style={{ margin: 0 }}>No roles synced yet — the bot fills this list from your servers every few minutes.</p>}
              {roles.map((r) => (
                <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 2px', fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={simRoles.has(r.id)} onChange={() => toggleSimRole(r.id)} />
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: r.color ? '#' + r.color.toString(16).padStart(6, '0') : 'transparent', border: '1px solid var(--border)', flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  <span className="mono" style={{ color: 'var(--text-dim)' }}>{r.id}</span>
                </label>
              ))}
            </div>
            <div className="field-row" style={{ marginBottom: 0 }}>
              <button className="btn sm" onClick={simulate} style={{ flex: 1 }}><Play size={14} /> Simulate</button>
              <button className="btn sm secondary" onClick={() => { setSimRoles(new Set()); setResult(null); }}><RotateCcw size={14} /> Clear</button>
            </div>

            {result && selected && (
              <div style={{ marginTop: 12 }}>
                {result.outcome === 'add' && <p><span className="badge green">ADD</span> Main role would be <b>assigned</b> to this member.</p>}
                {result.outcome === 'remove' && <p><span className="badge red">REMOVE</span> Main role would be <b>removed</b> from this member.</p>}
                {result.outcome === 'unchanged' && <p><span className="badge yellow">NO CHANGE</span> The main role already matches what the conditions require.</p>}
                <div className="log-stream" style={{ marginTop: 8 }}>
                  {result.conditions.map((c, i) => (
                    <div className="log-line" key={i}>
                      <span className={'badge ' + (c.satisfied ? 'green' : 'red')}>{c.satisfied ? 'TRUE' : 'FALSE'}</span>
                      <span className="mono">{c.has_role ? 'has' : 'lacks'} {roleName(c.role_id)}</span>
                    </div>
                  ))}
                  <div className="log-line">
                    <span className={'badge ' + (result.met ? 'blue' : 'red')}>{result.met ? 'MET' : 'NOT MET'}</span>
                    <span>Overall condition is {selected.logic === 'all' ? 'AND' : 'OR'} of the above</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card preview-card" style={{ marginTop: 14 }}>
            <div className="preview-head"><Save size={15} /> Generated config.yml block</div>
            <p className="hint">Paste this under <span className="mono">role_connections:</span> (replace the existing one).</p>
            <pre className="mono" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, maxHeight: 320, overflowY: 'auto' }}>
              {yaml || buildYamlBlock(state)}
            </pre>
            <div className="field-row" style={{ marginBottom: 0, marginTop: 8 }}>
              <button className="btn sm" onClick={copyYaml} style={{ flex: 1 }}><Copy size={14} /> Copy YAML</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
