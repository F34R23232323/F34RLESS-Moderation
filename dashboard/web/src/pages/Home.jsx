import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Activity, Radio, WifiOff, Zap, ShieldCheck, MessageSquare, Command, AlertTriangle } from 'lucide-react';
import { api, connectLiveLogs } from '../api';
import { PageSkeleton, Skeleton } from '../components/Skeleton';
import Reveal from '../components/Reveal';
import { useToast } from '../components/Toast';

function useCountUp(value, duration = 700) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const target = Number(value) || 0;
    const from = prev.current;
    if (from === target) {
      setDisplay(target);
      return;
    }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

function StatCard({ label, value, icon: Icon, suffix, delay }) {
  const v = useCountUp(typeof value === 'number' ? value : 0);
  return (
    <Reveal as="div" delay={delay} className="stat">
      <div className="stat-top">
        <div className="stat-label">{label}</div>
        <div className="stat-icon"><Icon size={16} /></div>
      </div>
      <div className="value">
        {typeof value === 'number' ? v.toLocaleString() : <span style={{ opacity: 0.4 }}>—</span>}
        {suffix && <small> {suffix}</small>}
      </div>
    </Reveal>
  );
}

const EVENT_META = {
  error_event: { color: 'red', icon: AlertTriangle },
  rate_limit_event: { color: 'yellow', icon: AlertTriangle },
  moderation_action: { color: 'red', icon: ShieldCheck },
  automod_trigger: { color: 'pink', icon: Zap },
  member_join: { color: 'green', icon: MessageSquare },
  member_leave: { color: 'blue', icon: MessageSquare },
  member_ban: { color: 'red', icon: ShieldCheck },
  member_unban: { color: 'green', icon: ShieldCheck },
  archive_created: { color: 'orange', icon: MessageSquare },
  report_created: { color: 'blue', icon: MessageSquare },
  appeal_created: { color: 'blue', icon: MessageSquare },
};

export default function Home() {
  const [metrics, setMetrics] = useState(null);
  const [live, setLive] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();

  async function load() {
    setLoading(true);
    setError('');
    try {
      setMetrics(await api('/metrics'));
    } catch (e) {
      setError(e.message || 'Could not load metrics');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const cleanup = connectLiveLogs({
      onLog: (entry) => setLive((prev) => [entry, ...prev].slice(0, 200)),
      onMetric: (m) => setMetrics((prev) => ({ ...(prev ?? {}), ...m })),
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
    });
    return cleanup;
  }, []);

  const uptimeH = metrics ? Math.floor((metrics.uptimeSeconds ?? 0) / 3600) : null;

  if (loading && !metrics) {
    return <PageSkeleton />;
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-sub">
            Live statistics and the newest moderation events.
          </p>
        </div>
        <div className="head-actions">
          <span className={`live-pill ${connected ? 'on' : 'off'}`}>
            {connected ? <Radio size={14} /> : <WifiOff size={14} />}
            {connected ? 'Live' : 'Disconnected'}
          </span>
          <button className="btn sm secondary" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? 'spin-soft' : ''} /> Refresh</button>
        </div>
      </div>

      {error && (
        <div className="inline-error">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button className="btn sm" onClick={load}>Retry</button>
        </div>
      )}

      <div className="stats">
        <StatCard label="Messages / min" value={metrics?.messagesPerMinute} icon={MessageSquare} delay={0} />
        <StatCard label="Messages / hour" value={metrics?.messagesPerHour} icon={MessageSquare} delay={60} />
        <StatCard label="Automod / hour" value={metrics?.automodTriggersLastHour} icon={Zap} delay={120} />
        <StatCard label="Commands / hour" value={metrics?.commandsLastHour} icon={Command} delay={180} />
        <StatCard label="Failed / hour" value={metrics?.commandsFailedLastHour} icon={AlertTriangle} delay={240} />
        <StatCard label="Bot uptime" value={uptimeH} suffix={uptimeH != null ? 'h' : undefined} icon={Activity} delay={300} />
      </div>

      <Reveal delay={360} className="card">
        <div className="stream-head">
          <h3 style={{ margin: 0 }}>Live log stream</h3>
          <span className="stream-count">{live.length} events</span>
        </div>
        <div className="log-stream">
          {live.length === 0 && (
            <div className="center-state" style={{ padding: '28px 12px' }}>
              <Radio size={22} />
              <span>Waiting for events…</span>
            </div>
          )}
          {live.map((entry, i) => {
            const meta = EVENT_META[entry.event] || { color: 'blue', icon: MessageSquare };
            const Icon = meta.icon;
            return (
              <div className="log-line" key={entry.id} style={{ animationDelay: `${Math.min(i, 20) * 30}ms` }}>
                <span className={`badge ${meta.color}`}><Icon size={11} /> {entry.event}</span>{' '}
                <span className="mono dim">{new Date(entry.created_at).toLocaleTimeString()}</span> {entry.message}
              </div>
            );
          })}
        </div>
      </Reveal>
    </>
  );
}
