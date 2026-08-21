import React, { useEffect, useState } from 'react';
import {
  Gavel, Search, RefreshCw, X, Ban, ShieldCheck, MessageSquareText,
  Check, CornerDownRight, Users,
} from 'lucide-react';

const CSRF_COOKIE = 'f34rless_csrf';
function csrfToken() {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : '';
}

async function adminApi(path, options = {}) {
  const method = options.method || 'GET';
  const headers = { 'Content-Type': 'application/json' };
  if (method !== 'GET') {
    const csrf = csrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  const res = await fetch(`/api/appeals${path}`, {
    method,
    headers,
    credentials: 'include',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function badgeClass(status) {
  return { pending: 'blue', accepted: 'green', denied: 'yellow', ignored: 'blue' }[status] || 'blue';
}

export default function AppealsAdmin() {
  const [guilds, setGuilds] = useState([]);
  const [guildId, setGuildId] = useState('');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ status: '', user: '', q: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('appeals');
  const [detail, setDetail] = useState(null);
  const [blocks, setBlocks] = useState([]);

  useEffect(() => {
    adminApi('/guilds')
      .then((data) => {
        setGuilds(data.guilds || []);
        if (data.guilds && data.guilds.length > 0) setGuildId(data.guilds[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  async function load() {
    if (!guildId) return;
    setLoading(true);
    const params = new URLSearchParams({ limit: '50' });
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    try {
      const data = await adminApi(`/${guildId}?${params}`);
      setRows(data.rows);
      setTotal(data.total);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadBlocks() {
    if (!guildId) return;
    try {
      const data = await adminApi(`/${guildId}/blocks`);
      setBlocks(data.rows || []);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    if (tab === 'appeals') load();
    else loadBlocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, tab]);

  function notify(e) {
    setError(e instanceof Error ? e.message : String(e));
    setTimeout(() => setError(''), 4000);
  }

  async function openDetail(id) {
    try {
      const data = await adminApi(`/${guildId}/${id}`);
      setDetail(data);
    } catch (e) {
      notify(e);
    }
  }

  async function decide(appealId, decision, reason = '') {
    try {
      await adminApi(`/${guildId}/${appealId}/decide`, {
        method: 'POST',
        body: { decision, reason: reason || undefined },
      });
      await openDetail(appealId);
      await load();
    } catch (e) {
      notify(e);
    }
  }

  async function ignore(appealId) {
    try {
      await adminApi(`/${guildId}/${appealId}/ignore`, { method: 'POST' });
      await openDetail(appealId);
      await load();
    } catch (e) {
      notify(e);
    }
  }

  async function sendMessage(appealId, content) {
    await adminApi(`/${guildId}/${appealId}/messages`, { method: 'POST', body: { content } });
  }

  async function unblock(userId) {
    try {
      await adminApi(`/${guildId}/unblock`, { method: 'POST', body: { userId } });
      await loadBlocks();
    } catch (e) {
      notify(e);
    }
  }

  async function blockUser({ userId, reason, durationDays }) {
    try {
      await adminApi(`/${guildId}/block`, {
        method: 'POST',
        body: {
          userId,
          reason: reason || undefined,
          durationMs: durationDays ? Number(durationDays) * 86400000 : undefined,
        },
      });
      await loadBlocks();
    } catch (e) {
      notify(e);
    }
  }

  return (
    <>
      <h1 className="page-title">Appeals</h1>
      <p className="page-sub">Review, decide and moderate user appeals per guild.</p>

      <div className="card">
        <div className="filters">
          <select value={guildId} onChange={(e) => setGuildId(e.target.value)} disabled={guilds.length === 0}>
            {guilds.length === 0 && <option value="">No guilds with appeals enabled</option>}
            {guilds.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <button className={`seg-btn ${tab === 'appeals' ? 'active' : ''}`} onClick={() => setTab('appeals')}>Appeals</button>
          <button className={`seg-btn ${tab === 'blocks' ? 'active' : ''}`} onClick={() => setTab('blocks')}>Blocked users</button>
        </div>
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

        {tab === 'appeals' ? (
          <>
            <div className="filters">
              <input placeholder="Status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} />
              <input placeholder="User ID" value={filters.user} onChange={(e) => setFilters({ ...filters, user: e.target.value })} />
              <input placeholder="Case # or code" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
              <button className="btn sm" onClick={() => load()}><Search size={14} /> Apply</button>
              <button className="btn sm secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>
            </div>

            {loading ? (
              <div className="center-state"><Gavel size={24} /><span>Loading appeals…</span></div>
            ) : rows.length === 0 ? (
              <div className="center-state"><Gavel size={24} /><span>No appeals match.</span></div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Case</th>
                      <th>Type</th>
                      <th>User</th>
                      <th>Status</th>
                      <th>Submitted</th>
                      <th>Decision</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="mono">#{r.id}</td>
                        <td className="mono">{r.case_code}</td>
                        <td>{r.case_type}</td>
                        <td className="mono">@{r.user_id}</td>
                        <td><span className={`badge ${badgeClass(r.status)}`}>{r.status}</span></td>
                        <td className="mono">{new Date(r.submitted_at).toLocaleDateString()}</td>
                        <td className="pre">{r.decision_reason ? String(r.decision_reason).slice(0, 40) : '-'}</td>
                        <td>
                          <button className="btn sm secondary" onClick={() => openDetail(r.id)}>View</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="pager"><span>{total} appeals</span></div>
          </>
        ) : (
          <BlocksView
            blocks={blocks}
            onUnblock={unblock}
            onBlock={blockUser}
            onRefresh={loadBlocks}
            notify={notify}
          />
        )}
      </div>

      {detail && (
        <AppealDetail
          data={detail}
          onClose={() => setDetail(null)}
          onDecide={decide}
          onIgnore={ignore}
          onSend={sendMessage}
          onRefresh={() => openDetail(detail.appeal.id)}
          onError={notify}
        />
      )}
    </>
  );
}

function BlocksView({ blocks, onUnblock, onBlock, onRefresh, notify }) {
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!userId.trim()) return;
    setBusy(true);
    try {
      await onBlock({ userId: userId.trim(), reason: reason.trim(), durationDays: durationDays.trim() });
      setUserId('');
      setReason('');
      setDurationDays('');
      await onRefresh();
    } catch (e) {
      notify(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="section-title">Block a user from appealing</div>
      <div className="action-row">
        <input placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} style={{ minWidth: 200 }} />
        <input placeholder="Reason (defaults to config)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ minWidth: 200 }} />
        <input placeholder="Duration (days, empty = permanent)" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} style={{ minWidth: 200 }} />
        <button className="btn sm" onClick={add} disabled={!userId.trim() || busy}><Ban size={14} /> Block</button>
      </div>

      <div className="section-title">Active blocks</div>
      {blocks.length === 0 ? (
        <div className="center-state"><Users size={24} /><span>No active blocks.</span></div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Reason</th>
                <th>Blocked by</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b.id}>
                  <td className="mono">@{b.userId}</td>
                  <td className="pre">{b.reason}</td>
                  <td className="mono">{b.blockedBy ? `@${b.blockedBy}` : '-'}</td>
                  <td className="mono">{b.expiresAt ? new Date(b.expiresAt).toLocaleDateString() : 'never'}</td>
                  <td>
                    <button className="btn sm secondary" onClick={() => onUnblock(b.userId)}>Unblock</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function AppealDetail({ data, onClose, onDecide, onIgnore, onSend, onRefresh, onError }) {
  const [reply, setReply] = useState('');
  const [decisionReason, setDecisionReason] = useState('');
  const [busy, setBusy] = useState(false);

  const a = data.appeal;

  async function send() {
    const content = reply.trim();
    if (!content) return;
    setBusy(true);
    try {
      await onSend(a.id, content);
      setReply('');
      await onRefresh();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  async function doDecide(decision) {
    const reason = decision === 'accepted' ? decisionReason : decisionReason || 'Punishment stands.';
    setBusy(true);
    try {
      await onDecide(a.id, decision, reason);
      setDecisionReason('');
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-wide">
        <div className="modal-head">
          <div className="modal-title">
            <span className="mono">Appeal #{a.id}</span>
            <span className={`badge ${badgeClass(a.status)}`}>{a.status}</span>
            {data.case && <span className="mono" style={{ marginLeft: 8 }}>Case {data.case.case_code}</span>}
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="kv">
            <div className="kv-item"><div className="kv-label">User</div><div className="kv-value mono">@{a.user_id}</div></div>
            <div className="kv-item"><div className="kv-label">Submitted</div><div className="kv-value mono">{new Date(a.submitted_at).toLocaleString()}</div></div>
            {a.decided_at && <div className="kv-item"><div className="kv-label">Decided</div><div className="kv-value mono">{new Date(a.decided_at).toLocaleString()}</div></div>}
            {a.decided_by && <div className="kv-item"><div className="kv-label">Decided by</div><div className="kv-value mono">@{a.decided_by}</div></div>}
          </div>

          {data.case && (
            <>
              <div className="section-title">Punishment case</div>
              <div className="note-item">
                <div className="note-meta">
                  <span className="mono">#{data.case.case_number} · {data.case.type}</span>
                  <span className={`badge ${data.case.status === 'voided' ? 'yellow' : 'green'}`}>{data.case.status}</span>
                </div>
                <div className="note-text">{data.case.reason}</div>
              </div>
            </>
          )}

          <div className="section-title">Form answers</div>
          {data.answers.length === 0 ? (
            <div className="center-state"><span>No answers.</span></div>
          ) : (
            data.answers.map((an) => (
              <div className="note-item" key={an.questionId}>
                <div className="note-meta">{an.label}</div>
                <div className="note-text">{an.answerText != null ? an.answerText : an.answerBool ? 'Yes' : 'No'}</div>
              </div>
            ))
          )}

          <div className="section-title">Chat thread</div>
          <div className="appeal-admin-chat">
            {data.messages.map((m) => (
              <div key={m.id} className={'appeal-msg ' + (m.senderType === 'user' ? 'mine' : 'theirs')}>
                <div className="appeal-msg-meta">
                  {m.senderType === 'staff' ? 'Staff' : 'Appellant'}
                  <span className="appeal-msg-time">{new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="appeal-msg-body">{m.content}</div>
              </div>
            ))}
          </div>

          {a.status === 'pending' ? (
            <>
              <div className="action-row" style={{ marginTop: 12 }}>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Reply to the appellant…"
                  style={{ flex: 1, minHeight: 56 }}
                />
                <button className="btn" onClick={send} disabled={!reply.trim() || busy}><CornerDownRight size={14} /> Reply</button>
              </div>
              <div className="action-row" style={{ marginTop: 10 }}>
                <input placeholder="Decision reason (optional)" value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} style={{ flex: 1 }} />
                <button className="btn sm" onClick={() => doDecide('accepted')} disabled={busy}><Check size={14} /> Accept</button>
                <button className="btn sm danger" onClick={() => doDecide('denied')} disabled={busy}><X size={14} /> Deny</button>
                <button className="btn sm secondary" onClick={() => onIgnore(a.id)} disabled={busy}><Ban size={14} /> Ignore</button>
              </div>
            </>
          ) : (
            <div className="appeal-decision" style={{ marginTop: 12 }}>
              <span className={`badge ${badgeClass(a.status)}`}>{a.status}</span>
              <span className="mono" style={{ marginLeft: 8 }}>{a.decision_reason || ''}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
