import React, { useEffect, useMemo, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, ShieldAlert, Gavel, Timer,
  Settings, Braces, Clock, BarChart3, History, KeyRound, Download,
  Shapes, Archive as ArchiveIcon, MessageSquareText, Sun, Moon, Users,
  Menu, X, Search, WifiOff, PanelLeftClose, PanelLeftOpen, Scale,
} from 'lucide-react';
import { raw } from './api';
import Login from './pages/Login';
import Home from './pages/Home';
import Logs from './pages/Logs';
import AutomodLogs from './pages/AutomodLogs';
import Cases from './pages/Cases';
import Punishments from './pages/Punishments';
import ConfigEditor from './pages/ConfigEditor';
import RegexTest from './pages/RegexTest';
import Timestamp from './pages/Timestamp';
import Analytics from './pages/Analytics';
import Audit from './pages/Audit';
import Sessions from './pages/Sessions';
import Export from './pages/Export';
import Builder from './pages/Builder';
import Archives from './pages/Archives';
import ArchiveView from './pages/ArchiveView';
import MessageLog from './pages/MessageLog';
import Privacy from './pages/Privacy';
import RoleConnections from './pages/RoleConnections';
import ErrorBoundary from './components/ErrorBoundary';
import AppealsAdmin from './pages/AppealsAdmin';
import AppealsApp from './appeals/AppealsApp';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
  {
    label: 'Moderation',
    items: [
      { to: '/logs', label: 'Logs', icon: FileText },
      { to: '/automod', label: 'Automod Logs', icon: ShieldAlert },
      { to: '/cases', label: 'Cases', icon: Gavel },
      { to: '/appeals-admin', label: 'Appeals', icon: Scale },
      { to: '/punishments', label: 'Punishments', icon: Timer },
      { to: '/message-log', label: 'Message Log', icon: MessageSquareText },
      { to: '/archives', label: 'Archives', icon: ArchiveIcon },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/builder', label: 'Message Builder', icon: Shapes },
      { to: '/role-connections', label: 'Role Connections', icon: Users },
      { to: '/regex', label: 'Regex Tester', icon: Braces },
      { to: '/timestamp', label: 'Timestamp Gen', icon: Clock },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/config', label: 'Config', icon: Settings },
      { to: '/audit', label: 'Audit Trail', icon: History },
      { to: '/sessions', label: 'Sessions', icon: KeyRound },
      { to: '/export', label: 'Export / Backup', icon: Download },
    ],
  },
];

function FullPageLoader() {
  return (
    <div className="login-wrap">
      <div className="brand-loader">
        <div className="brand-loader-mark">
          <ShieldAlert size={34} />
        </div>
        <div className="brand-loader-name">f34rless</div>
        <div className="brand-loader-bar"><span /></div>
      </div>
    </div>
  );
}

function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <div className="offline-banner" role="alert">
      <WifiOff size={15} /> You're offline — live data won't update until you reconnect.
    </div>
  );
}

function NavItems({ query, onNavigate, collapsed }) {
  const q = query.trim().toLowerCase();
  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
    .filter((g) => g.items.length > 0);

  if (groups.length === 0) {
    return <div className="nav-empty">No pages match “{query}”.</div>;
  }

  return groups.map((group) => (
    <div className="nav-group" key={group.label}>
      <div className="nav-group-label">{collapsed ? '' : group.label}</div>
      {group.items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          title={label}
          onClick={onNavigate}
          className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
        >
          <Icon size={18} className="nav-link-icon" />
          {!collapsed && <span className="nav-link-label">{label}</span>}
          {!collapsed && <span className="nav-link-glow" />}
        </NavLink>
      ))}
    </div>
  ));
}

function Brand({ collapsed, onClick }) {
  return (
    <div className="brand" onClick={onClick}>
      <div className="brand-mark"><ShieldAlert size={19} /></div>
      {!collapsed && (
        <div className="brand-text">
          <span className="brand-name">f34rless</span>
          <span className="brand-sub">Moderation Console</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [navQuery, setNavQuery] = useState('');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === '1');
  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    raw('/oauth/me').then((me) => {
      setAuth(Boolean(me?.authenticated));
      setLoading(false);
    }).catch(() => {
      setAuth(false);
      setLoading(false);
    });
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [drawerOpen]);

  if (loading) return <FullPageLoader />;

  // Public share links (no auth required — the archive code is the key).
  if (location.pathname.startsWith('/archive/')) {
    const code = location.pathname.replace(/^\/archive\//, '').split('/')[0];
    return <ArchiveView code={code} />;
  }

  // Public pages (no auth required).
  if (location.pathname === '/privacy' || location.pathname === '/privacy-policy') {
    return <Privacy />;
  }

  // Public appeals portal — multi-tenant per guild, with its own login flow.
  if (location.pathname.startsWith('/appeals/')) {
    const guildId = location.pathname.replace(/^\/appeals\//, '').split('/')[0];
    if (/^\d{15,20}$/.test(guildId)) {
      return <AppealsApp guildId={guildId} />;
    }
  }

  if (!auth) return <Login />;

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const sidebar = (
    <nav className="sidebar-inner" aria-label="Primary">
      <Brand collapsed={collapsed} onClick={() => !collapsed && setDrawerOpen(true)} />
      {!collapsed && (
        <div className="nav-search">
          <Search size={14} />
          <input
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
            placeholder="Search pages…"
            aria-label="Search pages"
          />
        </div>
      )}
      <div className="nav-scroll">
        <NavItems query={navQuery} collapsed={collapsed} />
      </div>
      <div className="sidebar-foot">
        <div className="live-status">
          <span className="pulse-dot" />
          <span>Systems nominal</span>
        </div>
        <div className="sidebar-foot-actions">
          <button className="icon-btn" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="icon-btn" onClick={() => setCollapsed((c) => !c)} title="Collapse sidebar" aria-label="Collapse sidebar">
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="app-bg" aria-hidden="true">
        <div className="bg-blob bg-blob-1" />
        <div className="bg-blob bg-blob-2" />
        <div className="bg-blob bg-blob-3" />
        <div className="bg-grid" />
      </div>

      <OfflineBanner />

      <aside className={`sidebar ${drawerOpen ? 'drawer-open' : ''}`}>
        {sidebar}
        <button className="drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close menu"><X size={18} /></button>
      </aside>

      {drawerOpen && <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />}

      <header className="mobile-topbar">
        <button className="icon-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
        <div className="mobile-brand">
          <div className="brand-mark"><ShieldAlert size={16} /></div>
          <span>f34rless</span>
        </div>
        <div className="mobile-topbar-right">
          <span className="live-status mobile"><span className="pulse-dot" /></span>
          <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      <main className="main">
        <ErrorBoundary>
          <div className="page-transition" key={location.pathname}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/builder" element={<Builder />} />
              <Route path="/role-connections" element={<RoleConnections />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/automod" element={<AutomodLogs />} />
              <Route path="/cases" element={<Cases />} />
              <Route path="/appeals-admin" element={<AppealsAdmin />} />
              <Route path="/archives" element={<Archives />} />
              <Route path="/message-log" element={<MessageLog />} />
              <Route path="/punishments" element={<Punishments />} />
              <Route path="/regex" element={<RegexTest />} />
              <Route path="/timestamp" element={<Timestamp />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/config" element={<ConfigEditor />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/export" element={<Export />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </ErrorBoundary>
      </main>
    </div>
  );
}
