import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, ScrollText, ShieldAlert, Gavel, Timer,
  Settings, Braces, Clock, BarChart3, History, KeyRound, Download,
  Shapes, Archive as ArchiveIcon, MessageSquareText, Sun, Moon, Users,
} from 'lucide-react';
import { api, raw } from './api';
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

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/builder', label: 'Message Builder', icon: Shapes },
  { to: '/role-connections', label: 'Role Connections', icon: Users },
  { to: '/logs', label: 'Logs', icon: FileText },
  { to: '/automod', label: 'Automod Logs', icon: ShieldAlert },
  { to: '/cases', label: 'Cases', icon: Gavel },
  { to: '/archives', label: 'Archives', icon: ArchiveIcon },
  { to: '/message-log', label: 'Message Log', icon: MessageSquareText },
  { to: '/punishments', label: 'Punishments', icon: Timer },
  { to: '/regex', label: 'Regex Tester', icon: Braces },
  { to: '/timestamp', label: 'Timestamp Gen', icon: Clock },
  { to: '/analytics', label: 'Command Analytics', icon: BarChart3 },
  { to: '/config', label: 'Config', icon: Settings },
  { to: '/audit', label: 'Audit Trail', icon: History },
  { to: '/sessions', label: 'Sessions', icon: KeyRound },
  { to: '/export', label: 'Export / Backup', icon: Download },
];

export default function App() {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    raw('/oauth/me').then((me) => {
      setAuth(Boolean(me?.authenticated));
      setLoading(false);
    }).catch(() => {
      setAuth(false);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="login-wrap">
        <div className="spinner" />
      </div>
    );
  }

  // Public share links (no auth required — the archive code is the key).
  if (location.pathname.startsWith('/archive/')) {
    const code = location.pathname.replace(/^\/archive\//, '').split('/')[0];
    return <ArchiveView code={code} />;
  }

  // Public pages (no auth required).
  if (location.pathname === '/privacy' || location.pathname === '/privacy-policy') {
    return <Privacy />;
  }

  if (!auth) return <Login />;

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <ShieldAlert size={20} color="var(--accent)" />
          f34rless Moderation
        </div>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
        <button className="nav-link theme-toggle" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/builder" element={<Builder />} />
          <Route path="/role-connections" element={<RoleConnections />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/automod" element={<AutomodLogs />} />
          <Route path="/cases" element={<Cases />} />
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
      </main>
    </div>
  );
}