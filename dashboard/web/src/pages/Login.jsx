import React from 'react';
import { LogIn, ShieldAlert, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Login() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand-mark login-mark" style={{ width: 58, height: 58, margin: '0 auto 18px', borderRadius: 17 }}>
          <ShieldAlert size={26} />
        </div>
        <h1>f34rless Moderation</h1>
        <p className="page-sub">Control panel for the moderation bot. Sign in with Discord to continue.</p>
        <a className="btn" href="/oauth/login">
          <LogIn size={16} />
          Sign in with Discord
          <ArrowRight size={15} />
        </a>
        <p className="login-privacy">
          <Link to="/privacy">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
