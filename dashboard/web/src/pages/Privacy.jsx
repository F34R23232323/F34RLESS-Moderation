import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Database, Clock, Trash2, Users, Cookie, Mail } from 'lucide-react';

const SECTIONS = [
  {
    icon: Database,
    title: 'What data we collect',
    body: (
      <>
        <p>This bot provides moderation, logging, and message-archiving tools for Discord servers. To work, it stores:</p>
        <ul>
          <li><strong>Message content, attachments, embeds, and components</strong> from servers where it operates — captured as snapshots and, where requested, as archives.</li>
          <li><strong>Deleted and edited messages</strong> (including the before/after content of edits) for moderation evidence.</li>
          <li><strong>Archives</strong> you create with the archive command, case evidence archives (warns, mutes, bans, kicks, automod triggers), and archives of deleted/edited messages. Archives can include <strong>copies of images, GIFs, videos, and other attachments</strong> so they don't expire.</li>
          <li><strong>Moderation records:</strong> cases, warnings, punishments, notes, appeals, and audit/log entries.</li>
          <li><strong>User information</strong> needed to display messages correctly: usernames, display names, avatars, and user IDs.</li>
          <li><strong>Anonymous command usage statistics</strong> for diagnostics.</li>
        </ul>
      </>
    ),
  },
  {
    icon: Shield,
    title: 'Why we collect it',
    body: (
      <p>
        Moderation, abuse prevention, auditing, and the archive/transcript features you've asked for. Evidence archives preserve context (message history, attachments, before/after of edits) so server staff can fairly review warnings, mutes, bans, kicks, and automod actions.
      </p>
    ),
  },
  {
    icon: Clock,
    title: 'Retention',
    body: (
      <>
        <ul>
          <li><strong>Message snapshots</strong> (the always-on capture of deleted/edited messages) are automatically purged after <strong>90 days</strong>.</li>
          <li><strong>Archives</strong> are kept until an administrator deletes them — they may include media (images/GIFs/videos) stored on our servers.</li>
          <li><strong>Logs and moderation records</strong> are retained as needed for auditing and appeals.</li>
        </ul>
      </>
    ),
  },
  {
    icon: Trash2,
    title: 'Deletion & your choices',
    body: (
      <>
        <p>Server administrators can, from the dashboard:</p>
        <ul>
          <li>Delete individual archives or remove specific images/media from an archive.</li>
          <li>Clear the message log or purge messages older than a chosen retention period.</li>
          <li>Delete saved message records.</li>
        </ul>
        <p>If you're not an administrator, you can request deletion by contacting the server's administrators or the bot owner — they can remove the relevant data for you.</p>
      </>
    ),
  },
  {
    icon: Users,
    title: 'Who can access your data',
    body: (
      <p>
        Only the server's administrators/moderators can access the management dashboard (protected by login). <strong>Archives have shareable links</strong> — anyone with the link can view that archive's content, so only share links you intend to be seen. We do not sell or share your data with third parties.
      </p>
    ),
  },
  {
    icon: Cookie,
    title: 'Cookies',
    body: (
      <p>
        The dashboard uses a single session cookie so you can stay logged in. No advertising or tracking cookies are used.
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <div className="privacy-wrap">
      <div className="privacy-topbar">
        <Link to="/" className="privacy-back"><ArrowLeft size={16} /> Back to dashboard</Link>
        <span className="privacy-brand">f34rless Moderation</span>
      </div>

      <div className="privacy-head">
        <h1>Privacy Policy</h1>
        <p className="privacy-sub">
          Last updated: {new Date().toLocaleDateString()} · This policy applies to the f34rless moderation bot and its web dashboard.
        </p>
      </div>

      <div className="privacy-summary">
        <p>
          This bot provides moderation, logging, and message-archiving tools. It stores message snapshots (including deleted and edited messages) for up to 90 days, and archives that you or your moderators create — archives persist until deleted and may host copies of images, GIFs, videos, and other attachments so they never expire. Only server staff can manage this data through the protected dashboard.
        </p>
      </div>

      <div className="privacy-sections">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <section className="privacy-card" key={s.title}>
              <h2><Icon size={18} /> {s.title}</h2>
              <div className="privacy-body">{s.body}</div>
            </section>
          );
        })}
      </div>

      <section className="privacy-card">
        <h2><Mail size={18} /> Contact</h2>
        <div className="privacy-body">
          <p>
            For privacy questions, data requests, or to request deletion, contact the administrators of the server you're in, or the operator of this bot.
          </p>
        </div>
      </section>

      <footer className="privacy-footer">
        <p>We may update this policy from time to time — changes will be reflected on this page.</p>
      </footer>
    </div>
  );
}
