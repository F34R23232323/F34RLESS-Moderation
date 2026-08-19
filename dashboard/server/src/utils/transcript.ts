interface TMessage {
  id: number;
  message_id: string;
  channel_id: string | null;
  author_id: string;
  author_username: string;
  author_nickname: string | null;
  author_avatar: string | null;
  author_is_bot: number;
  content: string | null;
  embeds: unknown;
  components: unknown;
  stickers: unknown;
  referenced_message: unknown;
  created_at: Date;
  position: number;
}

interface TMedia {
  id: number;
  archive_message_id: number | null;
  author_id: string | null;
  kind: string;
  name: string | null;
  contentType: string | null;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function colorFor(id: string): string {
  return `hsl(${hashId(id) % 360}, 70%, 60%)`;
}

function fmtTime(iso: Date): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '';
  }
}

function renderContent(content: string): string {
  let s = esc(content);
  s = s.replace(/```([\s\S]*?)```/g, (_m, code) => `<pre class="code">${code}</pre>`);
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_\n]+)__/g, '<u>$1</u>');
  s = s.replace(/~~([^~\n]+)~~/g, '<s>$1</s>');
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  s = s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');
  return s.replace(/\n/g, '<br/>');
}

function renderEmbed(embed: any): string {
  if (!embed || typeof embed !== 'object') return '';
  const color = embed.color != null ? `#${Number(embed.color).toString(16).padStart(6, '0')}` : '#202225';
  const parts: string[] = ['<div class="embed" style="border-left-color:' + color + '">'];
  if (embed.author?.name) parts.push(`<div class="embed-author">${esc(embed.author.name)}</div>`);
  if (embed.title) parts.push(`<div class="embed-title">${embed.url ? `<a href="${esc(embed.url)}">${esc(embed.title)}</a>` : esc(embed.title)}</div>`);
  if (embed.description) parts.push(`<div class="embed-desc">${renderContent(String(embed.description))}</div>`);
  if (Array.isArray(embed.fields)) {
    parts.push('<div class="embed-fields">');
    for (const f of embed.fields) {
      parts.push(`<div class="embed-field${f.inline ? ' inline' : ''}"><div class="embed-fn">${esc(f.name)}</div><div class="embed-fv">${renderContent(String(f.value ?? ''))}</div></div>`);
    }
    parts.push('</div>');
  }
  if (embed.image?.url) parts.push(`<img class="embed-img" src="${esc(embed.image.url)}"/>`);
  if (embed.thumbnail?.url) parts.push(`<img class="embed-thumb" src="${esc(embed.thumbnail.url)}"/>`);
  if (embed.footer?.text || embed.timestamp) {
    parts.push(`<div class="embed-footer">${embed.footer?.text ? esc(embed.footer.text) : ''}${embed.footer?.text && embed.timestamp ? ' • ' : ''}${embed.timestamp ? esc(new Date(embed.timestamp).toLocaleString()) : ''}</div>`);
  }
  parts.push('</div>');
  return parts.join('');
}

function renderComponents(components: any): string {
  if (!Array.isArray(components) || components.length === 0) return '';
  const out: string[] = [];
  const renderRow = (row: any): string => {
    if (row.type === 1 && Array.isArray(row.components)) {
      return `<div class="comp-row">${row.components.map(renderComp).join('')}</div>`;
    }
    if (row.type === 17) {
      return `<div class="comp-row">${(row.components || []).map(renderComp).join('')}</div>`;
    }
    return renderComp(row);
  };
  const renderComp = (comp: any): string => {
    if (!comp || typeof comp !== 'object') return '';
    switch (comp.type) {
      case 2:
        const style = ['primary', 'secondary', 'success', 'danger', 'link'][comp.style ?? 1] ?? 'secondary';
        const emoji = comp.emoji ? `<span class="comp-emoji">${comp.emoji?.name ? esc(comp.emoji.name) : ''}</span>` : '';
        return `<span class="comp-btn ${style}">${emoji}${esc(comp.label ?? '')}</span>`;
      case 3:
      case 5:
      case 6:
      case 7:
      case 8:
        return `<span class="comp-select">${esc(comp.placeholder ?? 'Select an option')} ▾</span>`;
      case 17:
        return `<span class="comp-row">${(comp.components || []).map(renderComp).join('')}</span>`;
      case 28:
        return `<span class="comp-text">${renderContent(String(comp.content ?? ''))}</span>`;
      case 29:
        return `<hr class="comp-sep"/>`;
      case 25:
        return `<span class="comp-gallery">🖼️ ${esc(comp.items?.length ?? 0)} media</span>`;
      default:
        return `<span class="comp-unknown" title="${esc(JSON.stringify(comp))}">[component]</span>`;
    }
  };
  for (const row of components) out.push(renderRow(row));
  return out.join('');
}

export function buildTranscriptHtml(
  archive: any,
  messages: TMessage[],
  media: TMedia[],
  baseUrl: string,
): string {
  const byMsg = new Map<number, TMedia[]>();
  const avatarByAuthor = new Map<string, TMedia>();
  for (const m of media) {
    if (m.kind === 'avatar') {
      if (m.author_id && !avatarByAuthor.has(m.author_id)) avatarByAuthor.set(m.author_id, m);
      continue;
    }
    if (m.archive_message_id != null) {
      const arr = byMsg.get(m.archive_message_id) || [];
      arr.push(m);
      byMsg.set(m.archive_message_id, arr);
    }
  }
  const sorted = [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  let body = '';
  let lastDay = '';
  for (const m of sorted) {
    const day = new Date(m.created_at).toDateString();
    if (day !== lastDay) {
      lastDay = day;
      body += `<div class="daysep">${esc(new Date(m.created_at).toLocaleDateString())}</div>`;
    }
    const avatar = avatarByAuthor.get(m.author_id);
    const avatarUrl = avatar ? `${baseUrl}${avatar.url}` : (m.author_avatar ?? '');
    const display = m.author_nickname || m.author_username;
    const msgMedia = byMsg.get(m.id) || [];
    const images = msgMedia.filter((x) => x.kind === 'image' || x.kind === 'gif');
    const videos = msgMedia.filter((x) => x.kind === 'video');
    const files = msgMedia.filter((x) => x.kind === 'file');
    const embeds = Array.isArray(m.embeds) ? m.embeds : [];
    const components = Array.isArray(m.components) ? m.components : [];
    const stickers = Array.isArray(m.stickers) ? m.stickers : [];
    let attachments = '';
    if (images.length > 0) {
      attachments += `<div class="attachments">${images.map((im) => `<a href="${baseUrl}${im.url}" target="_blank"><img class="att-img" src="${baseUrl}${im.url}"/></a>`).join('')}</div>`;
    }
    if (videos.length > 0) {
      attachments += `<div class="attachments">${videos.map((v) => `<video controls preload="metadata" src="${baseUrl}${v.url}"></video>`).join('')}</div>`;
    }
    if (files.length > 0) {
      attachments += `<div class="attachments">${files.map((f) => `<a class="att-file" href="${baseUrl}${f.url}" download>📄 ${esc(f.name || 'file')} (${esc(formatBytes(f.size))})</a>`).join('')}</div>`;
    }
    const stickersHtml = stickers.map((s: any) => `<img class="sticker" src="${esc(s.url)}"/>`).join('');

    body += `<div class="msg">
      <div class="avatar">${avatarUrl ? `<img src="${esc(avatarUrl)}"/>` : ''}</div>
      <div class="msg-body">
        <div class="msg-head"><span class="name" style="color:${colorFor(m.author_id)}">${esc(display)}</span>${m.author_is_bot ? ' <span class="bot">BOT</span>' : ''}<span class="time">${esc(fmtTime(m.created_at))}</span></div>
        ${m.content ? `<div class="content">${renderContent(m.content)}</div>` : ''}
        ${stickersHtml}
        ${attachments}
        ${embeds.map(renderEmbed).join('')}
        ${renderComponents(components)}
      </div>
    </div>`;
  }

  const title = archive.title || 'Message Archive';
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)} — ${esc(archive.code)}</title>
<style>
  body{margin:0;background:#313338;color:#dbdee1;font-family:'Segoe UI',system-ui,sans-serif;line-height:1.4}
  .wrap{max-width:860px;margin:0 auto;padding:16px}
  .header{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #26272b;margin-bottom:16px}
  .header h1{font-size:18px;margin:0}
  .header .sub{color:#949ba4;font-size:12px}
  .badge{background:#2b2d31;border:1px solid #3a3c42;border-radius:4px;padding:2px 8px;font-size:11px;color:#b5bac1}
  .daysep{display:flex;align-items:center;gap:12px;margin:22px 0 10px;color:#949ba4;font-size:12px}
  .daysep::before,.daysep::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.06)}
  .msg{display:flex;gap:14px;padding:4px 0}
  .avatar{width:40px;flex-shrink:0}.avatar img{width:40px;height:40px;border-radius:50%;background:#5865f2}
  .msg-body{flex:1;min-width:0}
  .msg-head{display:flex;align-items:baseline;gap:8px}
  .name{font-weight:600}.bot{font-size:9.5px;background:#5865f2;color:#fff;border-radius:3px;padding:1px 3px}
  .time{color:#949ba4;font-size:11.5px}
  .content{font-size:14.5px;margin-top:2px;word-wrap:break-word;overflow-wrap:break-word}
  a{color:#00a8fc;text-decoration:none}
  code{background:#1e1f22;border-radius:3px;padding:1px 4px;font-family:Consolas,monospace;font-size:13px}
  pre.code{background:#1e1f22;border:1px solid #26272b;border-radius:6px;padding:10px;overflow-x:auto}
  .attachments{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
  .att-img{max-width:360px;max-height:320px;border-radius:8px;background:#000}
  video{max-width:480px;border-radius:8px;background:#000}
  .att-file{display:inline-flex;align-items:center;gap:8px;background:#2b2d31;border:1px solid #26272b;border-radius:8px;padding:8px 12px;color:#dbdee1}
  .sticker{width:120px;height:120px}
  .embed{border-left:4px solid #202225;background:#2b2d31;border-radius:4px;margin-top:6px;padding:10px 14px;max-width:520px;position:relative}
  .embed-title{font-weight:600;margin-top:4px}.embed-desc{font-size:13.5px;white-space:pre-wrap}
  .embed-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 10px;margin-top:8px}
  .embed-field.inline{grid-column:span 1}.embed-fn{font-weight:600}.embed-fv{white-space:pre-wrap}
  .embed-img{max-width:100%;max-height:260px;border-radius:4px;margin-top:8px}
  .embed-thumb{position:absolute;top:10px;right:10px;max-width:80px;max-height:80px;border-radius:4px}
  .embed-footer{color:#949ba4;font-size:12px;margin-top:8px}
  .comp-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
  .comp-btn{border-radius:4px;padding:8px 12px;font-size:13px;font-weight:500;color:#fff;cursor:not-allowed}
  .comp-btn.primary{background:#5865f2}.comp-btn.secondary{background:#4e5058}.comp-btn.success{background:#248046}.comp-btn.danger{background:#da373c}.comp-btn.link{background:none;color:#00a8fc;border:1px solid #00a8fc}
  .comp-select{border:1px solid #3a3c42;border-radius:4px;padding:8px 12px;font-size:13px;color:#b5bac1;background:#1e1f22}
  .comp-sep{border:none;border-top:1px solid rgba(255,255,255,.1);margin:8px 0}
  .comp-text{color:#dbdee1}
  .comp-unknown{color:#949ba4;border:1px dashed #3a3c42;border-radius:4px;padding:4px 8px;font-size:12px}
</style></head><body><div class="wrap">
  <div class="header">
    <div><h1>${esc(title)}</h1><div class="sub">${esc(archive.kind)} • ${archive.message_count} messages • ${archive.media_count} media • ${esc(archive.code)}</div></div>
    <span class="badge">${esc(new Date(archive.created_at).toLocaleString())}</span>
  </div>
  ${body}
</div></body></html>`;
  return html;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
