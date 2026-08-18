import React, { useEffect, useState } from 'react';
import { api, connectLiveLogs } from '../api';

export default function Home() {
  const [metrics, setMetrics] = useState(null);
  const [live, setLive] = useState([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    api('/metrics').then(setMetrics).catch(() => {});
    const cleanup = connectLiveLogs({
      onLog: (entry) => setLive((prev) => [entry, ...prev].slice(0, 200)),
      onMetric: (m) => setMetrics((prev) => ({ ...(prev ?? {}), ...m })),
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
    });
    return cleanup;
  }, []);

  const stats = [
    { label: 'Messages / min', value: metrics?.messagesPerMinute ?? '-' },
    { label: 'Messages / hour', value: metrics?.messagesPerHour ?? '-' },
    { label: 'Automod triggers / hour', value: metrics?.automodTriggersLastHour ?? '-' },
    { label: 'Commands / hour', value: metrics?.commandsLastHour ?? '-' },
    { label: 'Failed commands / hour', value: metrics?.commandsFailedLastHour ?? '-' },
    { label: 'Bot uptime', value: metrics ? `${Math.floor((metrics.uptimeSeconds ?? 0) / 3600)}h` : '-' },
  ];

  return (
    <>
      <h1 className="page-title">Overview</h1>
      <p className="page-sub">
        Live statistics and the newest log entries.{' '}
        <span className={`badge ${connected ? 'green' : 'red'}`}>{connected ? 'Live' : 'Disconnected'}</span>
      </p>

      <div className="stats">
        {stats.map((s) => (
          <div className="stat" key={s.label}>
            <div className="label">{s.label}</div>
            <div className="value">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Live log stream</h3>
        <div className="log-stream">
          {live.length === 0 && <div className="page-sub">Waiting for events...</div>}
          {live.map((entry) => (
            <div className="log-line" key={entry.id}>
              <span className="badge blue">{entry.event}</span>{' '}
              <span className="mono">{new Date(entry.created_at).toLocaleTimeString()}</span> {entry.message}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}