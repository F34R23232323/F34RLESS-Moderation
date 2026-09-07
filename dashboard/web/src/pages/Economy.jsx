import React, { useEffect, useState } from 'react';
import { Coins, ShoppingCart, Users, BarChart3, ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react';
import { raw } from '../api';

function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-icon"><Icon size={20} /></div>
      <div className="stat-body">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        {sub && <div className="stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

function formatCurrency(amount) {
  return `$${Number(amount || 0).toLocaleString()}`;
}

export default function Economy() {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [guildId, setGuildId] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const fetchData = async (gid) => {
    if (!gid) return;
    setLoading(true);
    setError(null);
    try {
      const [ov, us, sh] = await Promise.all([
        raw(`/api/economy/overview?guild_id=${gid}`),
        raw(`/api/economy/users?guild_id=${gid}`),
        raw(`/api/economy/shops?guild_id=${gid}`),
      ]);
      setOverview(ov);
      setUsers(us?.users || []);
      setShops(sh?.shops || []);
    } catch (err) {
      setError('Failed to load economy data');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (guildId) fetchData(guildId);
  }, [guildId]);

  if (!guildId) {
    return (
      <div className="page">
        <h1 className="page-title"><Coins size={22} /> Economy</h1>
        <p className="page-desc">Enter a Guild ID to manage the economy system.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder="Guild ID"
            value={guildId}
            onChange={(e) => setGuildId(e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => {}}>Load</button>
        </div>
      </div>
    );
  }

  const stats = overview?.stats || {};
  const recentActivity = overview?.recent_activity || {};

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title"><Coins size={22} /> Economy</h1>
        <button className="btn btn-ghost" onClick={() => fetchData(guildId)}><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className="tab-bar">
        {['overview', 'users', 'shops', 'ledger'].map((tab) => (
          <button key={tab} className={`tab-btn ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {loading && <div className="loading">Loading…</div>}
      {error && <div className="error-banner">{error}</div>}

      {!loading && activeTab === 'overview' && (
        <>
          <div className="stat-grid">
            <StatCard icon={Coins} label="Total Supply" value={formatCurrency(stats.total_supply)} />
            <StatCard icon={ArrowDownCircle} label="Wallet Total" value={formatCurrency(stats.wallet_total)} />
            <StatCard icon={ArrowUpCircle} label="Bank Total" value={formatCurrency(stats.bank_total)} />
            <StatCard icon={Users} label="Active Users" value={stats.active_users || 0} />
            <StatCard icon={BarChart3} label="24h Transactions" value={recentActivity.tx_count || 0} />
            <StatCard icon={BarChart3} label="24h Volume" value={formatCurrency(recentActivity.total_volume)} />
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Economy Status</h3>
            <p>
              Status: <span className={`badge ${overview?.enabled ? 'badge-green' : 'badge-red'}`}>
                {overview?.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </p>
            <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 13 }}>
              Configure economy settings in your config.yml under the <code>economy</code> section.
            </p>
          </div>
        </>
      )}

      {!loading && activeTab === 'users' && (
        <div className="card">
          <h3>Economy Users ({users.length})</h3>
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Wallet</th>
                <th>Bank</th>
                <th>Total</th>
                <th>Level</th>
                <th>Job</th>
                <th>Daily Streak</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id}>
                  <td><code>{u.user_id}</code></td>
                  <td>{formatCurrency(u.wallet)}</td>
                  <td>{formatCurrency(u.bank)}</td>
                  <td>{formatCurrency(Number(u.wallet) + Number(u.bank))}</td>
                  <td>{u.level}</td>
                  <td>{u.job_id || '—'}</td>
                  <td>{u.daily_streak}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No economy users yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && activeTab === 'shops' && (
        <div className="card">
          <h3><ShoppingCart size={16} /> Shops ({shops.length})</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Emoji</th>
                <th>Name</th>
                <th>Slug</th>
                <th>Enabled</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((s) => (
                <tr key={s.id}>
                  <td>{s.emoji || '—'}</td>
                  <td>{s.name}</td>
                  <td><code>{s.shop_slug}</code></td>
                  <td><span className={`badge ${s.enabled ? 'badge-green' : 'badge-red'}`}>{s.enabled ? 'Yes' : 'No'}</span></td>
                  <td>{s.source}</td>
                </tr>
              ))}
              {shops.length === 0 && (
                <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No shops created yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && activeTab === 'ledger' && (
        <LedgerView guildId={guildId} />
      )}
    </div>
  );
}

function LedgerView({ guildId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    raw(`/api/economy/ledger?guild_id=${guildId}`)
      .then((d) => setEntries(d?.entries || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [guildId]);

  if (loading) return <div className="loading">Loading ledger…</div>;

  return (
    <div className="card">
      <h3>Transaction Ledger ({entries.length} recent)</h3>
      <table className="table">
        <thead>
          <tr>
            <th>TX ID</th>
            <th>Type</th>
            <th>Actor</th>
            <th>Target</th>
            <th>Amount</th>
            <th>Direction</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.tx_id}>
              <td><code>{e.tx_id?.slice(0, 8)}…</code></td>
              <td><code>{e.tx_type}</code></td>
              <td><code>{e.actor_id}</code></td>
              <td><code>{e.target_id || '—'}</code></td>
              <td>{formatCurrency(e.amount)}</td>
              <td><span className={`badge ${e.direction === 'credit' ? 'badge-green' : 'badge-red'}`}>{e.direction}</span></td>
              <td style={{ fontSize: 12 }}>{new Date(e.created_at).toLocaleString()}</td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr><td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No transactions yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
