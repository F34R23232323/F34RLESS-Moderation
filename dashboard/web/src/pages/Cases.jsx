import React, { useEffect, useState } from 'react';
import { Search, RefreshCw, X, Plus, Pencil, Trash2, Link2, Check } from 'lucide-react';
import { api } from '../api';
import SearchSelect from '../components/SearchSelect';

const PAGE_SIZE = 100;

export default function Cases() {
  const [filters, setFilters] = useState({ user: '', type: '', status: '', q: '' });
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [bulkReason, setBulkReason] = useState('');
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    const data = await api(`/cases?${params}`);
    setRows(data.rows);
    setTotal(data.total);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function notify(err) {
    setError(err instanceof Error ? err.message : String(err));
    setTimeout(() => setError(''), 4000);
  }

  async function setStatus(id, status) {
    try {
      await api(`/cases/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    } catch (e) {
      notify(e);
    } finally {
      if (detail && detail.id === id) await openDetail(id).catch(() => undefined);
      await load().catch(() => undefined);
    }
  }

  async function voidCase(id, reason) {
    try {
      await api(`/cases/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) });
    } catch (e) {
      notify(e);
    } finally {
      if (detail && detail.id === id) await openDetail(id).catch(() => undefined);
      await load().catch(() => undefined);
    }
  }

  async function unvoidCase(id) {
    try {
      await api(`/cases/${id}/unvoid`, { method: 'POST' });
    } catch (e) {
      notify(e);
    } finally {
      if (detail && detail.id === id) await openDetail(id).catch(() => undefined);
      await load().catch(() => undefined);
    }
  }

  async function linkCase(id, otherRef) {
    try {
      await api(`/cases/${id}/link`, { method: 'POST', body: JSON.stringify({ otherRef }) });
    } catch (e) {
      notify(e);
    } finally {
      if (detail && detail.id === id) await openDetail(id).catch(() => undefined);
    }
  }

  async function bulkEdit() {
    const ids = [...selected];
    if (ids.length === 0 || !bulkReason.trim()) return;
    try {
      await api('/cases/bulk-edit', { method: 'POST', body: JSON.stringify({ ids, reason: bulkReason.trim() }) });
      setSelected(new Set());
      setBulkReason('');
      await load();
    } catch (e) {
      notify(e);
    }
  }

  async function openDetail(id) {
    try {
      const data = await api(`/cases/${id}`);
      setDetail({ ...data.case, linked: data.linked || [], notes: data.notes || [] });
    } catch (e) {
      notify(e);
    }
  }

  function toggleSelect(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function badgeClass(status) {
    if (status === 'active') return 'green';
    if (status === 'voided') return 'yellow';
    return 'blue';
  }

  return (
    <>
      <h1 className="page-title">Case Browser</h1>
      <p className="page-sub">Search, edit, void, link and annotate moderation cases ({total}).</p>

      <div className="card">
        <div className="filters">
          <input placeholder="User ID" value={filters.user} onChange={(e) => setFilters({ ...filters, user: e.target.value })} />
          <input placeholder="Type (warn/ban/...)" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} />
          <input placeholder="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} />
          <input placeholder="Reason contains" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <button className="btn sm" onClick={() => { setPage(0); load(); }}><Search size={14} /> Apply</button>
          <button className="btn sm secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>
        </div>

        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

        {selected.size > 0 && (
          <div className="action-row">
            <input
              style={{ flex: 1, minWidth: 240 }}
              placeholder={`New reason for ${selected.size} selected case(s)...`}
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
            />
            <button className="btn sm" onClick={bulkEdit} disabled={!bulkReason.trim()}><Check size={14} /> Bulk edit</button>
            <button className="btn sm secondary" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th style={{ width: 30 }}></th>
              <th>Case</th>
              <th>Type</th>
              <th>User</th>
              <th>Moderator</th>
              <th>Reason</th>
              <th>Created</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><input type="checkbox" className="row-select" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                <td><span className="mono">{r.case_code}</span></td>
                <td>{r.type}</td>
                <td>@{r.user_id}</td>
                <td>{r.moderator_id ? `@${r.moderator_id}` : '-'}</td>
                <td className="pre">{r.reason}</td>
                <td className="mono">{new Date(r.created_at).toLocaleDateString()}</td>
                <td><span className={`badge ${badgeClass(r.status)}`}>{r.status}</span></td>
                <td>
                  <div className="action-row" style={{ margin: 0, flexWrap: 'nowrap' }}>
                    <button className="btn sm secondary" onClick={() => openDetail(r.id)}>View</button>
                    {r.status !== 'voided' ? (
                      <button className="btn sm danger" onClick={() => voidCase(r.id, window.prompt('Reason for voiding (optional):') || '')}>Void</button>
                    ) : (
                      <button className="btn sm secondary" onClick={() => unvoidCase(r.id)}>Restore</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pager">
          <span>{total} cases</span>
          <button className="btn sm secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="mono">Page {page + 1}</span>
          <button className="btn sm secondary" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>

      {detail && <CaseDetail
        caseData={detail}
        onClose={() => setDetail(null)}
        onRefresh={async () => { await openDetail(detail.id); await load(); }}
        onVoid={voidCase}
        onUnvoid={unvoidCase}
        onStatus={setStatus}
        onLink={linkCase}
        onOpenCase={openDetail}
        onError={notify}
      />}
    </>
  );
}

function CaseDetail({ caseData, onClose, onRefresh, onVoid, onUnvoid, onStatus, onLink, onOpenCase, onError }) {
  const c = caseData;
  const [reason, setReason] = useState(c.reason);
  const [status, setStatus] = useState(c.status);
  const [otherRef, setOtherRef] = useState('');
  const [notes, setNotes] = useState(c.notes || []);
  const [noteInput, setNoteInput] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [evidence, setEvidence] = useState(null);
  const [showEvidence, setShowEvidence] = useState(false);

  useEffect(() => {
    setReason(c.reason);
    setStatus(c.status);
    setNotes(c.notes || []);
  }, [c]);

  async function saveReason() {
    if (reason === c.reason) return;
    try {
      await api(`/cases/${c.id}`, { method: 'PATCH', body: JSON.stringify({ reason }) });
      await onRefresh();
    } catch (e) {
      onError(e);
    }
  }

  async function saveStatus() {
    if (status === c.status) return;
    try {
      await onStatus(c.id, status);
      await onRefresh();
    } catch (e) {
      onError(e);
    }
  }

  async function addNote() {
    const text = noteInput.trim();
    if (!text) return;
    try {
      await api(`/cases/${c.id}/notes`, { method: 'POST', body: JSON.stringify({ note: text }) });
      setNoteInput('');
      await onRefresh();
    } catch (e) {
      onError(e);
    }
  }

  async function saveNote(noteId) {
    try {
      await api(`/cases/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify({ note: editingNoteText }) });
      setEditingNoteId(null);
      await onRefresh();
    } catch (e) {
      onError(e);
    }
  }

  async function deleteNote(noteId) {
    try {
      await api(`/cases/notes/${noteId}`, { method: 'DELETE' });
      await onRefresh();
    } catch (e) {
      onError(e);
    }
  }

  function toggleEvidence() {
    if (showEvidence) {
      setShowEvidence(false);
      return;
    }
    try {
      setEvidence(JSON.parse(c.evidence || '[]'));
      setShowEvidence(true);
    } catch {
      setEvidence(c.evidence);
      setShowEvidence(true);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <div className="modal-title">
            <span className="mono">Case {c.case_code}</span>
            <span className={`badge ${c.status === 'active' ? 'green' : c.status === 'voided' ? 'yellow' : 'blue'}`}>{c.status}</span>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="kv">
            <div className="kv-item"><div className="kv-label">Number</div><div className="kv-value mono">#{c.case_number}</div></div>
            <div className="kv-item"><div className="kv-label">Type</div><div className="kv-value">{c.type}</div></div>
            <div className="kv-item"><div className="kv-label">User</div><div className="kv-value mono">@{c.user_id}</div></div>
            <div className="kv-item"><div className="kv-label">Moderator</div><div className="kv-value mono">{c.moderator_id ? `@${c.moderator_id}` : 'system'}</div></div>
            <div className="kv-item"><div className="kv-label">Duration</div><div className="kv-value">{c.duration_ms ? `${Math.floor(c.duration_ms / 60000)}m` : 'n/a'}</div></div>
            <div className="kv-item"><div className="kv-label">Created</div><div className="kv-value mono">{new Date(c.created_at).toLocaleString()}</div></div>
            {c.updated_at && <div className="kv-item"><div className="kv-label">Updated</div><div className="kv-value mono">{new Date(c.updated_at).toLocaleString()}</div></div>}
            <div className="kv-item"><div className="kv-label">Guild</div><div className="kv-value mono">{c.guild_id}</div></div>
          </div>

          <div className="section-title">Reason</div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="action-row">
            <button className="btn sm" onClick={saveReason} disabled={reason === c.reason}><Check size={14} /> Save reason</button>
            <button className="btn sm secondary" onClick={toggleEvidence}>{showEvidence ? 'Hide' : 'Show'} evidence</button>
          </div>
          {showEvidence && (
            <pre className="detail-pre">{typeof evidence === 'string' ? evidence : JSON.stringify(evidence, null, 2)}</pre>
          )}

          <div className="section-title">Status</div>
          <div className="action-row">
            <SearchSelect className="compact" value={status} onChange={setStatus} searchable={false} options={[{ value: 'active', label: 'active' }, { value: 'voided', label: 'voided' }]} />
            <button className="btn sm" onClick={saveStatus} disabled={status === c.status}><Check size={14} /> Save status</button>
            {c.status !== 'voided'
              ? <button className="btn sm danger" onClick={() => onVoid(c.id, window.prompt('Reason for voiding (optional):') || '')}>Void case</button>
              : <button className="btn sm secondary" onClick={() => onUnvoid(c.id)}>Restore case</button>}
          </div>

          <div className="section-title">Link another case</div>
          <div className="action-row">
            <input placeholder="Case code or number" value={otherRef} onChange={(e) => setOtherRef(e.target.value)} style={{ minWidth: 200 }} />
            <button className="btn sm secondary" onClick={() => { if (otherRef.trim()) { onLink(c.id, otherRef.trim()); setOtherRef(''); } }}><Link2 size={14} /> Link</button>
          </div>
          {c.linked && c.linked.length > 0 && (
            <div className="action-row">
              {c.linked.map((l) => (
                <button key={l.id} className="btn sm secondary link-item" onClick={() => onOpenCase(l.id)}>
                  <span className="mono">{l.case_code}</span> · {l.type} · {l.status}
                </button>
              ))}
            </div>
          )}

          <div className="section-title">User notes ({notes.length})</div>
          {notes.length > 0 && notes.map((n) => (
            <div className="note-item" key={n.id}>
              <div className="note-meta">
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {n.moderator_id ? `@${n.moderator_id}` : 'system'} · {new Date(n.created_at).toLocaleString()}{n.edited_at ? ' · edited' : ''}
                </span>
                <span className="action-row" style={{ margin: 0, gap: 6 }}>
                  {editingNoteId === n.id ? (
                    <>
                      <button className="btn sm" onClick={() => saveNote(n.id)}><Check size={13} /></button>
                      <button className="btn sm secondary" onClick={() => setEditingNoteId(null)}><X size={13} /></button>
                    </>
                  ) : (
                    <>
                      <button className="btn sm secondary" onClick={() => { setEditingNoteId(n.id); setEditingNoteText(n.note); }}><Pencil size={13} /></button>
                      <button className="btn sm danger" onClick={() => deleteNote(n.id)}><Trash2 size={13} /></button>
                    </>
                  )}
                </span>
              </div>
              {editingNoteId === n.id ? (
                <textarea value={editingNoteText} onChange={(e) => setEditingNoteText(e.target.value)} style={{ minHeight: 70 }} />
              ) : (
                <div className="note-text">{n.note}</div>
              )}
            </div>
          ))}
          <div className="action-row" style={{ marginTop: 10 }}>
            <textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder="Add a note for this user..." style={{ minHeight: 60, flex: 1 }} />
            <button className="btn" onClick={addNote} disabled={!noteInput.trim()}><Plus size={14} /> Add note</button>
          </div>
        </div>
      </div>
    </div>
  );
}
