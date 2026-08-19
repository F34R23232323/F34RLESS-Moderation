import React, { useEffect, useState } from 'react';
import { Search, RefreshCw, X, Trash2, Trash, Eye, ExternalLink, MessageSquareText } from 'lucide-react';
import { api } from '../api';
import SearchSelect from '../components/SearchSelect';
import { TableSkeleton } from '../components/Skeleton';
import { useToast } from '../components/Toast';

const PAGE_SIZE = 50;

export default function MessageLog() {
  const [filters, setFilters] = useState({ guild: '', user: '', channel: '', q: '', kind: '' });
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filterData, setFilterData] = useState({ guilds: [], users: [], channels: [] });
  const toast = useToast();

  useEffect(() => {
    api('/message-log/filters').then((d) => setFilterData(d || { guilds: [], users: [], channels: [] })).catch(() => {});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guildOptions = [{ value: '', label: 'Any guild' }, ...filterData.guilds];
  const userOptions = [
    { value: '', label: 'Any user' },
    ...filterData.users.filter((u) => !filters.guild || u.guildId === filters.guild),
  ];
  const channelOptions = [
    { value: '', label: 'Any channel' },
    ...filterData.channels.filter((c) => !filters.guild || c.guildId === filters.guild),
  ];

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    const data = await api(`/message-log?${params}`).catch(() => ({ rows: [], total: 0 }));
    setRows(data.rows || []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function notify(err, isSuccess = false) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isSuccess) toast.success(msg);
    else toast.error(msg);
    setError(isSuccess ? '' : msg);
    if (!isSuccess) setTimeout(() => setError(''), 4000);
  }

  async function openDetail(id) {
    try {
      setDetail(await api(`/message-log/${id}`));
    } catch (e) {
      notify(e);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this saved message?')) return;
    try {
      await api(`/message-log/${id}`, { method: 'DELETE' });
      setDetail(null);
      await load();
    } catch (e) {
      notify(e);
    }
  }

  async function clearAll() {
    if (!window.confirm('Delete ALL saved messages (message log)? This cannot be undone.')) return;
    try {
      const r = await api('/message-log/clear', { method: 'POST', body: JSON.stringify({ guild: filters.guild || undefined }) });
      await load();
      notify(`Cleared ${r.removed} saved message(s).`, true);
    } catch (e) {
      notify(e);
    }
  }

  async function purgeOld() {
    const days = Number(window.prompt('Delete saved messages older than how many days?', '90'));
    if (!days || days < 1) return;
    try {
      const r = await api('/message-log/purge', { method: 'POST', body: JSON.stringify({ days, guild: filters.guild || undefined }) });
      await load();
      notify(`Purged ${r.removed} old message(s).`, true);
    } catch (e) {
      notify(e);
    }
  }

  return (
    <>
      <h1 className="page-title">Message Log</h1>
      <p className="page-sub">Aggressively saved messages (edits keep before/after) — 90 day auto-purge ({total}).</p>

      <div className="card">
        <div className="filters">
          <SearchSelect className="compact" value={filters.guild} onChange={(guild) => { setFilters({ ...filters, guild, user: '', channel: '' }); }} placeholder="Any guild" options={guildOptions} />
          <SearchSelect className="compact" value={filters.user} onChange={(user) => setFilters({ ...filters, user })} placeholder="Any user" options={userOptions} />
          <SearchSelect className="compact" value={filters.channel} onChange={(channel) => setFilters({ ...filters, channel })} placeholder="Any channel" options={channelOptions} />
          <input placeholder="Content contains" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <select value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value })}>
            <option value="">All kinds</option>
            <option value="deleted">Deleted</option>
            <option value="edited">Edited</option>
            <option value="active">Active</option>
            <option value="normal">Normal</option>
          </select>
          <button className="btn sm" onClick={() => { setPage(0); load(); }}><Search size={14} /> Apply</button>
          <button className="btn sm secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>
          <button className="btn sm secondary" onClick={purgeOld}><Trash size={14} /> Purge old</button>
          <button className="btn sm danger" onClick={clearAll}><Trash2 size={14} /> Clear all</button>
        </div>

        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

        {loading ? (
          <div className="table-scroll"><TableSkeleton rows={7} cols={7} /></div>
        ) : rows.length === 0 ? (
          <div className="center-state"><MessageSquareText size={26} /><span>No saved messages match.</span></div>
        ) : (
        <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Author</th>
              <th>Content</th>
              <th>Channel</th>
              <th>Edits</th>
              <th>Created</th>
              <th>Kind</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.author_nickname || r.author_username}
                  <span className="mono" style={{ color: 'var(--text-dim)' }}> · {r.author_id}</span>
                  {r.author_is_bot ? ' 🤖' : ''}
                </td>
                <td className="pre" style={{ maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.content || '(no text)'}</td>
                <td className="mono">{r.channel_id || '-'}</td>
                <td>{r.edit_count}</td>
                <td className="mono">{new Date(r.created_at).toLocaleString()}</td>
                <td>
                  {r.deleted_at ? <span className="badge red">deleted</span>
                    : r.edit_count > 0 ? <span className="badge yellow">edited</span>
                    : <span className="badge green">active</span>}
                </td>
                <td>
                  <div className="action-row" style={{ margin: 0, flexWrap: 'nowrap' }}>
                    <button className="btn sm secondary" onClick={() => openDetail(r.id)}><Eye size={13} /> View</button>
                    <button className="btn sm danger" onClick={() => remove(r.id)}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        )}

        <div className="pager">
          <span>{total} saved messages</span>
          <button className="btn sm secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</button>
          <span className="mono">Page {page + 1}</span>
          <button className="btn sm secondary" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>

      {detail && <MessageDetail data={detail} onClose={() => setDetail(null)} onDelete={remove} />}
    </>
  );
}

function MessageDetail({ data, onClose, onDelete }) {
  const d = data;
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-wide">
        <div className="modal-head">
          <div className="modal-title"><span>Saved message</span><span className="badge blue mono">{d.message_id}</span></div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="kv">
            <div className="kv-item"><div className="kv-label">Author</div><div className="kv-value">{d.author_nickname || d.author_username} <span className="mono">({d.author_id})</span></div></div>
            <div className="kv-item"><div className="kv-label">Guild / Channel</div><div className="kv-value mono">{d.guild_id} / {d.channel_id || '-'}</div></div>
            <div className="kv-item"><div className="kv-label">Created</div><div className="kv-value mono">{new Date(d.created_at).toLocaleString()}</div></div>
            <div className="kv-item"><div className="kv-label">Updated</div><div className="kv-value mono">{d.updated_at ? new Date(d.updated_at).toLocaleString() : '-'}</div></div>
            <div className="kv-item"><div className="kv-label">Deleted</div><div className="kv-value mono">{d.deleted_at ? new Date(d.deleted_at).toLocaleString() : '-'}</div></div>
            <div className="kv-item"><div className="kv-label">Edits</div><div className="kv-value">{d.edit_count}</div></div>
          </div>

          {d.content && (
            <>
              <div className="section-title">Content</div>
              <pre className="detail-pre">{d.content}</pre>
            </>
          )}

          {Array.isArray(d.edits) && d.edits.length > 0 && (
            <>
              <div className="section-title">Edit history (before → after)</div>
              {d.edits.map((e, i) => (
                <div className="note-item" key={i}>
                  <div className="note-meta"><span className="mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{new Date(e.at).toLocaleString()}</span></div>
                  <div className="note-text"><span className="badge yellow">before</span> {e.content || '(no text)'}</div>
                </div>
              ))}
              <div className="note-item"><div className="note-text"><span className="badge green">after</span> {d.content || '(no text)'}</div></div>
            </>
          )}

          {Array.isArray(d.attachments) && d.attachments.length > 0 && (
            <>
              <div className="section-title">Attachments ({d.attachments.length})</div>
              <div className="archive-media-grid">
                {d.attachments.map((a) => (
                  <div className="archive-media-card" key={a.id}>
                    {/^image\//.test(a.contentType || '') ? <img src={a.url} alt={a.name || 'attachment'} /> : <div className="archive-media-placeholder">📄</div>}
                    <div className="archive-media-meta"><span className="mono">{a.name || 'file'}</span><span className="mono">{a.width ? `${a.width}x${a.height}` : ''}</span></div>
                    <div className="archive-media-actions">
                      <a className="btn sm secondary" href={a.url} target="_blank" rel="noreferrer"><ExternalLink size={13} /></a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {(Array.isArray(d.embeds) && d.embeds.length > 0) || (Array.isArray(d.components) && d.components.length > 0) ? (
            <>
              <div className="section-title">Embeds / Components (raw)</div>
              <pre className="detail-pre">{JSON.stringify({ embeds: d.embeds || [], components: d.components || [] }, null, 2)}</pre>
            </>
          ) : null}

          <div className="action-row" style={{ marginTop: 14 }}>
            <button className="btn sm danger" onClick={() => onDelete(d.id)}><Trash2 size={14} /> Delete saved message</button>
          </div>
        </div>
      </div>
    </div>
  );
}
