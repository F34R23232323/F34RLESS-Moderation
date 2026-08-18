import React from 'react';
import { LogIn } from 'lucide-react';

export default function Login() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1 style={{ marginTop: 0 }}>f34rless Moderation</h1>
        <p className="page-sub">Control panel for the moderation bot. Sign in with Discord to continue.</p>
        <a className="btn" href="/oauth/login">
          <LogIn size={16} />
          Sign in with Discord
        </a>
      </div>
    </div>
  );
}