import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Braces, MessageSquare, Download, ExternalLink } from 'lucide-react';

const MEDIA_API = '/api/archive/media';

function hashId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function colorFor(authorId) {
  return `hsl(${hashId(authorId) % 360}, 70%, 60%)`;
}

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function dayLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today - day) / 86400000);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diff === 0) return `Today at ${time}`;
  if (diff === 1) return `Yesterday at ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })} at ${time}`;
}

function formatBytes(n) {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// --- Minimal Discord-like markdown renderer ---------------------------------

const TOKEN_RE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(__[^_\n]+__)|(~~[^~\n]+~~)|(\[[^\]]+\]\([^)\s]+\))|(<@!?\d+>|<#\d+>|<@&\d+>)|(https?:\/\/[^\s<]+)/g;

function renderInline(text, ctx) {
  const out = [];
  let last = 0;
  let m;
  TOKEN_RE.lastIndex = 0;
  let key = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) out.push(...splitLines(text.slice(last, m.index), key++));
    const tok = m[0];
    if (m[1]) {
      out.push(<code key={key++} className="arc-inline-code">{m[1].slice(1, -1)}</code>);
    } else if (m[2]) {
      out.push(<strong key={key++}>{m[2].slice(2, -2)}</strong>);
    } else if (m[3]) {
      out.push(<em key={key++}>{m[3].slice(1, -1)}</em>);
    } else if (m[4]) {
      out.push(<u key={key++}>{m[4].slice(2, -2)}</u>);
    } else if (m[5]) {
      out.push(<s key={key++}>{m[5].slice(2, -2)}</s>);
    } else if (m[6]) {
      const link = m[6];
      const inner = link.slice(1, link.lastIndexOf(']('));
      const url = link.slice(link.lastIndexOf('](') + 2, -1);
      out.push(<a key={key++} href={url} target="_blank" rel="noreferrer">{inner}</a>);
    } else if (m[7]) {
      const tok7 = m[7];
      if (tok7.startsWith('<@')) {
        const id = tok7.replace(/[<@!>]/g, '');
        const user = ctx.users[id];
        out.push(
          <span key={key++} className="arc-mention">@{user?.authorNickname || user?.authorUsername || 'unknown'}</span>,
        );
      } else if (tok7.startsWith('<#')) {
        const id = tok7.replace(/[<#>]/g, '');
        out.push(<span key={key++} className="arc-channel">#{ctx.channelNames[id] || 'archived-channel'}</span>);
      } else if (tok7.startsWith('<@&')) {
        out.push(<span key={key++} className="arc-role">@role</span>);
      }
    } else if (m[8]) {
      out.push(<a key={key++} href={m[8]} target="_blank" rel="noreferrer">{m[8]}</a>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(...splitLines(text.slice(last), key++));
  return out;
}

function splitLines(text, keyBase) {
  const parts = text.split(/\n/);
  const out = [];
  parts.forEach((p, i) => {
    out.push(<React.Fragment key={`${keyBase}-${i}`}>{p}</React.Fragment>);
    if (i < parts.length - 1) out.push(<br key={`${keyBase}-br-${i}`} />);
  });
  return out;
}

function MessageContent({ content, ctx }) {
  const blocks = [];
  const lines = content.split('\n');
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <pre key={key++} className="arc-code-block"><code>{buf.join('\n')}</code></pre>,
      );
      continue;
    }
    blocks.push(<div key={key++} className="arc-line">{renderInline(line, ctx)}</div>);
    i++;
  }
  return <>{blocks}</>;
}

// --- Attachment / embed rendering ------------------------------------------

function AttachmentGrid({ media }) {
  if (!media || media.length === 0) return null;
  const items = media.filter((m) => m.kind !== 'avatar');
  const images = items.filter((m) => m.kind === 'image' || m.kind === 'gif');
  const videos = items.filter((m) => m.kind === 'video');
  const audios = items.filter((m) => m.kind === 'audio');
  const files = items.filter((m) => m.kind === 'file');
  return (
    <div className="arc-attachments">
      {images.length > 0 && (
        <div className={'arc-img-grid' + (images.length === 1 ? ' single' : images.length <= 4 ? ' multi' : '')}>
          {images.map((m) => (
            <div key={m.id} className="arc-img-cell">
              <a href={m.url} target="_blank" rel="noreferrer" className="arc-img-link">
                <img src={m.url} alt={m.name || 'attachment'} loading="lazy" />
              </a>
              <a className="arc-dl" href={m.url} download title="Download">
                <Download size={13} />
              </a>
            </div>
          ))}
        </div>
      )}
      {videos.map((m) => (
        <div key={m.id} className="arc-video-wrap">
          <video controls preload="metadata" src={m.url} className="arc-video" />
          <a className="arc-dl" href={m.url} download title="Download"><Download size={13} /></a>
        </div>
      ))}
      {audios.map((m) => (
        <audio key={m.id} controls preload="metadata" src={m.url} className="arc-audio" />
      ))}
      {files.map((m) => (
        <a key={m.id} className="arc-file" href={m.url} download>
          <span className="arc-file-icon">📄</span>
          <span className="arc-file-info">
            <span className="arc-file-name">{m.name || 'file'}</span>
            <span className="arc-file-meta">{formatBytes(m.size)}</span>
          </span>
          <Download size={14} />
        </a>
      ))}
    </div>
  );
}

const BTN_STYLES = { 1: 'primary', 2: 'secondary', 3: 'success', 4: 'danger', 5: 'link' };

// Legacy draft numbering used by older discord.js builds — kept so old
// archives still render. Maps old -> current.
const LEGACY_TYPES = { 25: 12, 26: 17, 27: 9, 28: 10, 29: 14, 30: 11 };

function normType(comp) {
  const t = comp?.type;
  return typeof t === 'number' ? (LEGACY_TYPES[t] ?? t) : null;
}

function Emoji({ emoji }) {
  if (!emoji) return null;
  if (typeof emoji === 'string') return <span className="arc-comp-emoji">{emoji}</span>;
  if (emoji.id) return <img className="arc-comp-emoji" src={`https://cdn.discordapp.com/emojis/${emoji.id}.png`} alt="" />;
  return <span className="arc-comp-emoji">{emoji.name || ''}</span>;
}

function mediaUrlOf(comp) {
  return comp?.media?.url ?? comp?.url ?? null;
}

function ComponentItem({ comp, ctx }) {
  if (!comp || typeof comp !== 'object') return null;
  const type = normType(comp);
  if (type === 1) {
    return <span className="arc-comp-row">{Array.isArray(comp.components) ? comp.components.map((c, i) => <ComponentItem key={i} comp={c} ctx={ctx} />) : null}</span>;
  }
  if (type === 17) {
    const accent = typeof comp.accent_color === 'number' ? `#${comp.accent_color.toString(16).padStart(6, '0')}` : undefined;
    return (
      <span className="arc-comp-container-v2" style={accent ? { borderLeftColor: accent } : undefined}>
        {Array.isArray(comp.components) ? comp.components.map((c, i) => <ComponentItem key={i} comp={c} ctx={ctx} />) : null}
      </span>
    );
  }
  if (type === 2) {
    const style = BTN_STYLES[comp.style] || 'secondary';
    if (style === 'link') {
      return <a className={'arc-comp-btn link'} href={comp.url} target="_blank" rel="noreferrer"><Emoji emoji={comp.emoji} />{comp.label || ''}</a>;
    }
    return (
      <span className={'arc-comp-btn ' + style + (comp.disabled ? ' disabled' : '')}>
        <Emoji emoji={comp.emoji} />{comp.label || ''}
      </span>
    );
  }
  if (type === 3 || type === 5 || type === 6 || type === 7 || type === 8) {
    return <span className="arc-comp-select">{comp.placeholder || 'Select an option'} ▾</span>;
  }
  if (type === 9) {
    return (
      <span className="arc-comp-section">
        <span className="arc-comp-section-body">
          {Array.isArray(comp.components) ? comp.components.map((c, i) => <ComponentItem key={i} comp={c} ctx={ctx} />) : null}
        </span>
        {comp.accessory ? <ComponentItem comp={comp.accessory} ctx={ctx} /> : null}
      </span>
    );
  }
  if (type === 10) {
    return <span className="arc-comp-text">{renderInline(comp.content || '', ctx)}</span>;
  }
  if (type === 11) {
    const url = mediaUrlOf(comp);
    return url ? <img src={url} alt="" className="arc-comp-thumb" /> : null;
  }
  if (type === 12) {
    return (
      <span className="arc-comp-gallery">
        {Array.isArray(comp.items) ? comp.items.map((it, i) => {
          const url = mediaUrlOf(it);
          return url ? <img key={i} src={url} alt="" className="arc-comp-gallery-img" /> : null;
        }) : null}
      </span>
    );
  }
  if (type === 13) {
    return <span className="arc-comp-file">📄 {comp.label || 'File'}</span>;
  }
  if (type === 14) {
    return <span className="arc-comp-sep" />;
  }
  if (type === 18) {
    return <span className="arc-comp-text arc-comp-label">{comp.component?.content ?? comp.content ?? ''}</span>;
  }
  return <span className="arc-comp-unknown" title={JSON.stringify(comp)}>[component]</span>;
}

function ComponentRow({ comp, ctx }) {
  return (
    <span className="arc-comp-container">
      {Array.isArray(comp) ? comp.map((c, i) => <ComponentItem key={i} comp={c} ctx={ctx} />) : <ComponentItem comp={comp} ctx={ctx} />}
    </span>
  );
}

function EmbedCard({ embed, mediaUrl }) {
  const color = embed.color != null ? `#${embed.color.toString(16).padStart(6, '0')}` : '#202225';
  const img = embed.image?.media_id != null ? mediaUrl(embed.image.media_id) : embed.image?.url;
  const thumb = embed.thumbnail?.media_id != null ? mediaUrl(embed.thumbnail.media_id) : embed.thumbnail?.url;
  return (
    <div className="arc-embed" style={{ borderLeftColor: color }}>
      <div className="arc-embed-body">
        {embed.author?.name && (
          <div className="arc-embed-author">
            {embed.author.icon_url && <img src={embed.author.icon_url} alt="" className="arc-embed-author-icon" />}
            {embed.author.url ? <a href={embed.author.url} target="_blank" rel="noreferrer">{embed.author.name}</a> : <span>{embed.author.name}</span>}
          </div>
        )}
        {embed.title && (
          <div className="arc-embed-title">
            {embed.url ? <a href={embed.url} target="_blank" rel="noreferrer">{embed.title}</a> : <span>{embed.title}</span>}
          </div>
        )}
        {embed.description && <div className="arc-embed-desc">{renderInline(embed.description, { users: {}, channelNames: {} })}</div>}
        {embed.fields && embed.fields.length > 0 && (
          <div className="arc-embed-fields">
            {embed.fields.map((f, i) => (
              <div key={i} className={'arc-embed-field' + (f.inline ? ' inline' : '')}>
                <div className="arc-embed-field-name">{f.name}</div>
                <div className="arc-embed-field-value">{f.value}</div>
              </div>
            ))}
          </div>
        )}
        {thumb && <img src={thumb} alt="" className="arc-embed-thumb" />}
        {img && <img src={img} alt="" className="arc-embed-image" loading="lazy" />}
        {(embed.footer?.text || embed.timestamp) && (
          <div className="arc-embed-footer">
            {embed.footer?.icon_url && <img src={embed.footer.icon_url} alt="" className="arc-embed-footer-icon" />}
            {embed.footer?.text && <span>{embed.footer.text}</span>}
            {embed.footer?.text && embed.timestamp && <span className="arc-embed-sep">•</span>}
            {embed.timestamp && <span>{new Date(embed.timestamp).toLocaleString()}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBody({ message, mediaByMsg, mediaUrl, ctx }) {
  const media = mediaByMsg[message.id] || [];
  return (
    <div className="arc-msg-body">
      {message.status === 'deleted' && <span className="arc-status-badge deleted">Deleted</span>}
      {message.status === 'edited_before' && <span className="arc-status-badge edited-before">Edited (before)</span>}
      {message.status === 'edited_after' && <span className="arc-status-badge edited-after">Edited (after)</span>}
      {message.referenced_message?.messageId && (
        <div className="arc-reply">
          <span className="arc-reply-arrow">↪</span>
          <span className="arc-reply-author" style={{ color: colorFor(message.referenced_message.authorId || '0') }}>
            {ctx.users[message.referenced_message.authorId]?.authorNickname || ctx.users[message.referenced_message.authorId]?.authorUsername || 'unknown'}
          </span>
          <span className="arc-reply-snippet">{(message.referenced_message.content || '').slice(0, 80)}</span>
        </div>
      )}
      {message.editBefore && (
        <div className="arc-edit-before">
          <span className="arc-edit-label">Before</span>
          {message.content ? <MessageContent content={message.content} ctx={ctx} /> : null}
        </div>
      )}
      {message.isEdited && <span className="arc-edit-chip">✏️ Edited</span>}
      {message.content && !message.editBefore ? (
        <MessageContent content={message.content} ctx={ctx} />
      ) : !message.editBefore && media.length === 0 && (!message.embeds || message.embeds.length === 0) && (!message.stickers || message.stickers.length === 0) && !message.components?.length ? (
        <span className="arc-msg-dim">(content only available in JSON view)</span>
      ) : null}
      {message.stickers && message.stickers.length > 0 && (
        <div className="arc-stickers">
          {message.stickers.map((s) => (
            <img key={s.id} src={s.url} alt={s.name || 'sticker'} className="arc-sticker" />
          ))}
        </div>
      )}
      <AttachmentGrid media={media} />
      {message.embeds && message.embeds.map((e, i) => <EmbedCard key={i} embed={e} mediaUrl={mediaUrl} />)}
      {message.components && message.components.length > 0 && <ComponentRow comp={message.components} ctx={ctx} />}
    </div>
  );
}

function MessageGroup({ group, mediaByMsg, mediaUrl, ctx }) {
  const first = group.msgs[0];
  return (
    <div className="arc-group">
      <div className="arc-avatar-wrap">
        {group.avatarUrl ? <img src={group.avatarUrl} alt="" className="arc-avatar" /> : <div className="arc-avatar arc-avatar-fallback">{group.authorUsername?.[0]?.toUpperCase() || '?'}</div>}
      </div>
      <div className="arc-group-body">
        <div className="arc-head">
          <span className="arc-name" style={{ color: group.color }}>{group.displayName}</span>
          <span className="arc-bot" style={{ visibility: group.isBot ? 'visible' : 'hidden' }}>BOT</span>
          <span className="arc-time">{fmtTime(first.created_at)}</span>
        </div>
        {group.msgs.map((m) => (
          <MessageBody key={m.id} message={m} mediaByMsg={mediaByMsg} mediaUrl={mediaUrl} ctx={ctx} />
        ))}
      </div>
    </div>
  );
}

// --- Page --------------------------------------------------------------------

export default function ArchiveView({ code: codeProp }) {
  const { code: routeCode } = useParams();
  const code = codeProp || routeCode || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('chat');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/archive/${encodeURIComponent(code)}`)
      .then((r) => {
        const ctype = r.headers.get('content-type') || '';
        if (ctype.includes('text/html')) throw new Error('html_response');
        if (!r.ok) {
          if (r.status === 404) throw new Error('not_found');
          throw new Error(`http_${r.status}`);
        }
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message || String(e)));
  }, [code]);

  const { groups, users, mediaByMsg, mediaUrl, channelNames } = useMemo(() => {
    if (!data) return { groups: [], users: {}, mediaByMsg: {}, mediaUrl: () => '', channelNames: {} };
    const mediaUrlFn = (id) => `${MEDIA_API}/${id}`;
    const users = {};
    for (const m of data.messages) {
      users[m.author_id] = { authorUsername: m.author_username, authorNickname: m.author_nickname };
    }
    const mediaByMsg = {};
    for (const md of data.media) {
      if (md.archiveMessageId != null) {
        (mediaByMsg[md.archiveMessageId] = mediaByMsg[md.archiveMessageId] || []).push(md);
      }
    }
    const channelNames = {};
    if (data.archive?.channel_id) channelNames[data.archive.channel_id] = 'archived-channel';
    const sorted = [...data.messages].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const groups = [];
    let cur = null;
    for (const m of sorted) {
      const d = new Date(m.created_at);
      const avatar = data.media.find((md) => md.kind === 'avatar' && md.authorId === m.author_id);
      if (!cur || cur.authorId !== m.author_id || d - cur.lastTime > 5 * 60 * 1000) {
        cur = {
          authorId: m.author_id,
          authorUsername: m.author_username,
          displayName: m.author_nickname || m.author_username,
          color: colorFor(m.author_id),
          isBot: m.author_is_bot,
          avatarUrl: avatar ? mediaUrlFn(avatar.id) : m.author_avatar,
          msgs: [],
          lastTime: d,
        };
        groups.push(cur);
      }
      cur.msgs.push(m);
      cur.lastTime = d;
    }
    for (const g of groups) {
      for (let i = 0; i < g.msgs.length; i++) {
        if (i > 0 && g.msgs[i].message_id === g.msgs[i - 1].message_id) {
          g.msgs[i - 1].editBefore = true;
          g.msgs[i].isEdited = true;
        }
      }
    }
    return { groups, users, mediaByMsg, mediaUrl: mediaUrlFn, channelNames };
  }, [data]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  if (error) {
    const notFound = error === 'not_found';
    const staleBackend = error === 'html_response';
    return (
      <div className="arc-shell">
        <div className="arc-notfound">
          <h2>Archive not found</h2>
          <p className="mono" style={{ opacity: 0.8 }}>{code}</p>
          {staleBackend ? (
            <p>This dashboard build doesn't include the archive feature yet — rebuild and restart the dashboard service, then reload.</p>
          ) : notFound ? (
            <p>No archive exists with this code. It may have been deleted, or the link is incorrect.</p>
          ) : (
            <p>The dashboard API returned an error (HTTP {error.replace('http_', '')}). If you just ran the archive command, make sure the dashboard has been rebuilt and restarted so it includes the archive routes.</p>
          )}
          <a href="/" className="btn sm">Back to dashboard</a>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="arc-shell">
        <div className="arc-loading"><div className="spinner" /> Loading archive…</div>
      </div>
    );
  }

  const a = data.archive;
  const jsonExport = `/api/archive/${encodeURIComponent(a.code)}/export`;
  const htmlExport = `/api/archive/${encodeURIComponent(a.code)}/transcript`;

  return (
    <div className="arc-shell">
      <div className="arc-toolbar">
        <a href="/" className="arc-back"><ArrowLeft size={16} /> Dashboard</a>
        <div className="arc-title-wrap">
          <span className="arc-hash">#</span>
          <div>
            <div className="arc-title">{a.title || 'Message Archive'}</div>
            <div className="arc-sub">
              {a.kind.replace('_', ' ')} • {a.message_count} messages • {a.media_count} media • {formatBytes(a.total_bytes)} • {a.code}
            </div>
          </div>
        </div>
        <div className="arc-actions">
          <button className="btn sm secondary" onClick={() => setView(view === 'chat' ? 'json' : 'chat')}>
            {view === 'chat' ? <Braces size={14} /> : <MessageSquare size={14} />} {view === 'chat' ? 'JSON view' : 'Chat view'}
          </button>
          <a className="btn sm secondary" href={htmlExport}><Download size={14} /> Transcript</a>
          <a className="btn sm secondary" href={jsonExport}><Download size={14} /> Export JSON</a>
          <button className="btn sm" onClick={copyLink}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy link'}</button>
        </div>
      </div>

      {view === 'chat' ? (
        <div className="arc-chat">
          <div className="arc-messages">
            {(() => {
              let lastDay = null;
              const nodes = [];
              for (const group of groups) {
                const day = dayLabel(group.msgs[0].created_at);
                if (day !== lastDay) {
                  lastDay = day;
                  nodes.push(<div key={`sep-${day}-${nodes.length}`} className="arc-separator"><span>{day}</span></div>);
                }
                nodes.push(<MessageGroup key={group.authorId + '-' + group.msgs[0].id} group={group} mediaByMsg={mediaByMsg} mediaUrl={mediaUrl} ctx={{ users, channelNames }} />);
              }
              return nodes;
            })()}
          </div>
        </div>
      ) : (
        <div className="arc-json">
          <pre>{JSON.stringify(data, null, 2)}</pre>
          <a className="btn sm secondary" href={jsonExport}><ExternalLink size={14} /> Open full export</a>
        </div>
      )}
    </div>
  );
}
