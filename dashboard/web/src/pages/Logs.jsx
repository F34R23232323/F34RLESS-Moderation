import React, { useEffect, useRef, useState } from 'react';
import {
  Search, X, ChevronDown, Copy, Check, Filter, Clock, AlertTriangle, FileText, User, Hash,
} from 'lucide-react';
import { api } from '../api';
import SearchSelect from '../components/SearchSelect';

const EVENT_COLORS = {
  error_event: 'red',
  rate_limit_event: 'yellow',
  member_ban: 'red',
  member_kick: 'red',
  member_timeout: 'red',
  moderation_action: 'red',
  automod_trigger: 'pink',
  member_join: 'green',
  member_unban: 'green',
  member_boost: 'orange',
  report_created: 'blue',
  appeal_created: 'blue',
};

const EVENT_ICONS = {
  error_event: AlertTriangle,
  rate_limit_event: AlertTriangle,
  message_delete: FileText,
  message_edit: FileText,
  message_bulk_delete: FileText,
  moderation_action: FileText,
  member_join: User,
  member_leave: User,
  member_ban: User,
  member_unban: User,
};

function badgeClass(event) {
  const map = { red: 'red', yellow: 'yellow', green: 'green', blue: 'blue', pink: 'pink', orange: 'orange' };
  return map[EVENT_COLORS[event]] || 'blue';
}

export default function Logs() {
  const [events, setEvents] = useState([]);
  const [filters, setFilters] = useState({ event: '', actor: '', q: '', from: '', to: '' });
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [copied, setCopied] = useState(null);
  const [livePulse, setLivePulse] = useState(false);

  useEffect(() => {
    api('/logs/log-events').then((d) => setEvents(d.events || [])).catch(() => {});
    load();
  }, []);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    const data = await api(`/logs?${params}`).catch(() => ({ rows: [], total: 0 }));
    setRows(data.rows || []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyEntry(entry) {
    const payload = JSON.stringify(
      {
        id: entry.id,
        event: entry.event,
        message: entry.message,
        actorId: entry.actor_id,
        targetId: entry.target_id,
        channelId: entry.channel_id,
        details: entry.details,
        createdAt: entry.created_at,
      },
      null,
      2,
    );
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = payload;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(entry.id);
    setTimeout(() => setCopied((c) => (c === entry.id ? null : c)), 1500);
  }

  function copyFiltered() {
    const payload = JSON.stringify(rows.slice(0, 100), null, 2);
    navigator.clipboard.writeText(payload).then(() => {
      setCopied('all');
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const hasFilter = Object.values(filters).some(Boolean);
  const iconFor = (event) => EVENT_ICONS[event] || FileText;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Log Browser</h1>
          <p className="page-sub">
            {total.toLocaleString()} entries{hasFilter ? ' (filtered)' : ''} · click a row to expand details, use the copy button to grab entries
          </p>
        </div>
        <div className="head-actions">
          {rows.length > 0 && (
            <button className="btn sm secondary" onClick={copyFiltered}>
              {copied === 'all' ? <Check size={14} /> : <Copy size={14} />} Copy all ({rows.length})
            </button>
          )}
        </div>
      </div>

      <div className="card filter-card">
        <div className="filters">
          <div className="field">
            <Filter size={14} className="field-icon" />
            <SearchSelect value={filters.event} onChange={(event) => setFilters({ ...filters, event })} placeholder="All events" options={events.map((e) => ({ value: e, label: e }))} />
          </div>
          <div className="field">
            <User size={14} className="field-icon" />
            <input placeholder="Actor ID" value={filters.actor} onChange={(e) => setFilters({ ...filters, actor: e.target.value })} />
          </div>
          <div className="field grow">
            <Search size={14} className="field-icon" />
            <input placeholder="Search message / details…" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && load()} />
          </div>
          <div className="field">
            <Clock size={14} className="field-icon" />
            <input type="datetime-local" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
          </div>
          <div className="field">
            <Clock size={14} className="field-icon" />
            <input type="datetime-local" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
          </div>
          <button className="btn sm" onClick={load}>Apply</button>
          {hasFilter && (
            <button className="btn sm secondary" onClick={() => { setFilters({ event: '', actor: '', q: '', from: '', to: '' }); setTimeout(load, 0); }}>
              <X size={14} /> Reset
            </button>
          )}
        </div>
      </div>

      <div className="log-list">
        {loading && rows.length === 0 && (
          <div className="card center-state"><div className="spinner" /><span>Loading logs…</span></div>
        )}
        {!loading && rows.length === 0 && (
          <div className="card center-state"><FileText size={28} /><span>No log entries match.</span></div>
        )}
        {rows.map((entry, i) => {
          const Icon = iconFor(entry.event);
          const isOpen = expanded.has(entry.id);
          const isCopied = copied === entry.id;
          const isError = entry.event === 'error_event' || entry.event === 'rate_limit_event';
          return (
            <div
              key={entry.id}
              className={`log-row ${isOpen ? 'expanded' : ''} ${isError ? 'is-error' : ''}`}
              style={{ animationDelay: `${Math.min(i, 30) * 25}ms` }}
            >
              <button className="log-row-main" onClick={() => toggle(entry.id)} aria-expanded={isOpen}>
                <span className={`badge ${badgeClass(entry.event)} log-badge`}><Icon size={11} /> {entry.event}</span>
                <span className="log-time">{new Date(entry.created_at).toLocaleString()}</span>
                <span className="log-msg">{entry.message || entry.event}</span>
                <ChevronDown size={16} className={`chevron ${isOpen ? 'open' : ''}`} />
              </button>
              <div className="log-row-details">
                <div className="log-details-inner">
                  <div className="log-meta">
                    {entry.actor_id && <span className="meta-chip"><User size={12} /> Actor: {entry.actor_id}</span>}
                    {entry.target_id && <span className="meta-chip"><User size={12} /> Target: {entry.target_id}</span>}
                    {entry.channel_id && <span className="meta-chip"><Hash size={12} /> {entry.channel_id}</span>}
                    <span className="meta-chip"><Clock size={12} /> ID {entry.id}</span>
                  </div>
                  {entry.message && entry.message !== entry.event && (
                    <div className="detail-block">
                      <div className="detail-label">Message</div>
                      <pre className="detail-pre">{entry.message}</pre>
                    </div>
                  )}
                  {entry.details && (
                    <div className="detail-block">
                      <div className="detail-label">Details</div>
                      <pre className="detail-pre">{JSON.stringify(entry.details, null, 2)}</pre>
                    </div>
                  )}
                  <div className="detail-actions">
                    <button className="btn sm secondary" onClick={() => copyEntry(entry)}>
                      {isCopied ? <Check size={13} /> : <Copy size={13} />} {isCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}