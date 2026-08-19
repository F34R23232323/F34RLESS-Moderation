import React, { useEffect, useState } from 'react';
import { Search, RefreshCw, X, Trash2, Pencil, Check, Copy, ExternalLink, Download, Image } from 'lucide-react';
import { api } from '../api';

const PAGE_SIZE = 50;

function formatBytes(n) {
  if (n == null) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function kindBadge(kind) {
  if (kind === 'manual') return 'blue';
  if (kind === 'case_evidence') return 'green';
  if (kind === 'automod_evidence') return 'pink';
  return 'yellow';
}

export default function Archives() {
  const [filters, setFilters] = useState({ guild: '', q: '', kind: '' });
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);

  async function load() {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    const data = await api(`/archives?${params}`).catch(() => ({ rows: [], total: 0 }));
    setRows(data.rows || []);
    setTotal(data.total ?? 0);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function notify(err) {
    setError(err instanceof Error ? err.message : String(err));
    setTimeout(() => setError(''), 4000);
  }

  async function openDetail(code) {
    try {
      const data = await api(`/archives/${code}`);
      setDetail(data);
    } catch (e) {
      notify(e);
    }
  }

  async function deleteArchive(code) {
    if (!window.confirm(`Delete archive ${code} permanently? All messages and media will be removed.`)) return;
    try {
      await api(`/archives/${code}`, { method: 'DELETE' });
      setDetail(null);
      await load();
    } catch (e) {
      notify(e);
    }
  }

  async function deleteMedia(code, mediaId) {
    if (!window.confirm('Delete this media file from the archive?')) return;
    try {
      await api(`/archives/${code}/media/${mediaId}`, { method: 'DELETE' });
      await openDetail(code);
    } catch (e) {
      notify(e);
    }
  }

  async function copyLink(code) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/archive/${code}`);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <h1 className="page-title">Message Archives</h1>
      <p className="page-sub">Shareable message archives with self-hosted media ({total}).</p>

      <div className="card">
        <div className="filters">
          <input placeholder="Guild ID" value={filters.guild} onChange={(e) => setFilters({ ...filters, guild: e.target.value })} />
          <input placeholder="Code / title / reason" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <input placeholder="Kind (manual/case_evidence/automod_evidence)" value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value })} />
          <button className="btn sm" onClick={() => { setPage(0); load(); }}><Search size={14} /> Apply</button>
          <button className="btn sm secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>
        </div>

        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Kind</th>
              <th>Guild</th>
              <th>User</th>
              <th>Messages</th>
              <th>Media</th>
              <th>Size</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><span className="mono">{r.code}</span></td>
                <td><span className={`badge ${kindBadge(r.kind)}`}>{r.kind}</span></td>
                <td className="mono">{r.guild_id}</td>
                <td className="mono">{r.filter_user_id ? `@${r.filter_user_id}` : '-'}</td>
                <td>{r.message_count}</td>
                <td>{r.media_count}</td>
                <td className="mono">{formatBytes(r.total_bytes)}</td>
                <td className="mono">{new Date(r.created_at).toLocaleDateString()}</td>
                <td>
                  <div className="action-row" style={{ margin: 0, flexWrap: 'nowrap' }}>
                    <button className="btn sm secondary" onClick={() => openDetail(r.code)}>View</button>
                    <button className="btn sm secondary" onClick={() => copyLink(r.code)}>{copied === r.code ? <Check size={13} /> : <Copy size={13} />}</button>
                    <a className="btn sm secondary" href={`/archive/${r.code}`} target="_blank" rel="noreferrer"><ExternalLink size={13} /></a>
                    <button className="btn sm danger" onClick={() => deleteArchive(r.code)}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pager">
          <span>{total} archives</span>
          <button className="btn sm secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="mono">Page {page + 1}</span>
          <button className="btn sm secondary" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>

      {detail && <ArchiveDetail
        data={detail}
        onClose={() => setDetail(null)}
        onRefresh={() => openDetail(detail.archive.code)}
        onDelete={deleteArchive}
        onDeleteMedia={deleteMedia}
        onError={notify}
      />}
    </>
  );
}

function ArchiveDetail({ data, onClose, onRefresh, onDelete, onDeleteMedia, onError }) {
  const a = data.archive;
  const [title, setTitle] = useState(a.title || '');
  const [reason, setReason] = useState(a.reason || '');
  const [copied, setCopied] = useState(false);
  const media = data.media || [];
  const messages = data.messages || [];

  async function save() {
    try {
      await api(`/archives/${a.code}`, { method: 'PATCH', body: JSON.stringify({ title, reason }) });
      await onRefresh();
    } catch (e) {
      onError(e);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/archive/${a.code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-wide">
        <div className="modal-head">
          <div className="modal-title">
            <span className="mono">{a.code}</span>
            <span className={`badge ${kindBadge(a.kind)}`}>{a.kind}</span>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="kv">
            <div className="kv-item"><div className="kv-label">Guild</div><div className="kv-value mono">{a.guild_id}</div></div>
            <div className="kv-item"><div className="kv-label">Channel</div><div className="kv-value mono">{a.channel_id || '-'}</div></div>
            <div className="kv-item"><div className="kv-label">User</div><div className="kv-value mono">{a.filter_user_id ? `@${a.filter_user_id}` : '-'}</div></div>
            <div className="kv-item"><div className="kv-label">Created</div><div className="kv-value mono">{new Date(a.created_at).toLocaleString()}</div></div>
            <div className="kv-item"><div className="kv-label">Messages</div><div className="kv-value">{a.message_count}</div></div>
            <div className="kv-item"><div className="kv-label">Media</div><div className="kv-value">{a.media_count} • {formatBytes(a.total_bytes)}</div></div>
          </div>

          <div className="section-title">Title</div>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Archive title" />
          <div className="section-title">Reason</div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this archive was created" style={{ minHeight: 70 }} />
          <div className="action-row">
            <button className="btn" onClick={save}><Check size={14} /> Save</button>
            <a className="btn sm secondary" href={`/archive/${a.code}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open archive</a>
            <a className="btn sm secondary" href={`/api/archives/${a.code}/export`}><Download size={14} /> Export JSON</a>
            <button className="btn sm secondary" onClick={copyLink}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy link'}</button>
            <button className="btn sm danger" onClick={() => onDelete(a.code)}><Trash2 size={14} /> Delete archive</button>
          </div>

          <div className="section-title">Media ({media.filter((m) => m.kind !== 'avatar').length} files, {media.filter((m) => m.kind === 'avatar').length} avatars)</div>
          {media.length === 0 ? (
            <p style={{ color: 'var(--text-dim)' }}>No media stored for this archive.</p>
          ) : (
            <div className="archive-media-grid">
              {media.map((m) => (
                <div className="archive-media-card" key={m.id}>
                  {m.kind === 'avatar' || m.kind === 'image' || m.kind === 'gif' ? (
                    <img src={m.url} alt={m.name || m.kind} />
                  ) : (
                    <div className="archive-media-placeholder"><Image size={20} /></div>
                  )}
                  <div className="archive-media-meta">
                    <span className="mono">{m.kind}{m.kind === 'avatar' ? ` • @${m.authorId}` : ''}</span>
                    <span className="mono">{formatBytes(m.size)}</span>
                  </div>
                  <div className="archive-media-actions">
                    <a className="btn sm secondary" href={m.url} target="_blank" rel="noreferrer"><ExternalLink size={13} /></a>
                    <button className="btn sm danger" onClick={() => onDeleteMedia(a.code, m.id)}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="section-title">Messages ({messages.length})</div>
          <div className="archive-msg-list">
            {messages.slice(0, 60).map((m) => (
              <div className="archive-msg-item" key={m.id}>
                <span className="arc-msg-name" style={{ color: `hsl(${hash(m.author_id) % 360}, 70%, 60%)` }}>{m.author_nickname || m.author_username}</span>
                <span className="mono" style={{ color: 'var(--text-dim)' }}>{new Date(m.created_at).toLocaleString()}</span>
                <span className="pre">{m.content || '(no content)'}</span>
              </div>
            ))}
            {messages.length > 60 && <p style={{ color: 'var(--text-dim)' }}>… and {messages.length - 60} more (see JSON export).</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function hash(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}
