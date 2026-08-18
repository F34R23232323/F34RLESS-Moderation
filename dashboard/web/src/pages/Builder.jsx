import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Save, Trash2, Send, Copy, Shapes, MessageSquare, ChevronDown, ChevronUp,
  BookOpen, Eye, Palette, Rows3, Wand2, Search, Clock, Link2, CheckCircle2, X,
  AlignLeft, Hash, Image as ImageIcon, HelpCircle,
} from 'lucide-react';
import { api } from '../api';
import SearchSelect from '../components/SearchSelect';

const BTN_STYLES = ['primary', 'secondary', 'success', 'danger', 'link'];
const ACTIONS = [
  { value: 'none', label: 'Do nothing' },
  { value: 'role_add', label: 'Add role' },
  { value: 'role_remove', label: 'Remove role' },
  { value: 'role_toggle', label: 'Toggle role' },
  { value: 'reply', label: 'Reply to clicker' },
  { value: 'send_message', label: 'Send a text message' },
  { value: 'dm_user', label: 'DM the clicker' },
  { value: 'repost', label: 'Re-post this message' },
  { value: 'send_message_template', label: 'Send a saved message' },
  { value: 'edit_message_template', label: 'Replace this message with a saved message' },
];
const ACTION_HELP = {
  none: 'The button does nothing on its own.',
  role_add: 'Gives the clicker a role. Enter the Role ID.',
  role_remove: 'Removes a role from the clicker. Enter the Role ID.',
  role_toggle: 'Adds the role if missing, removes it if present.',
  reply: 'Shows a private reply to the clicker (uncheck "Ephemeral" for a public reply).',
  send_message: 'Posts a normal message into the channel.',
  dm_user: 'DMs the person who clicked.',
  repost: 'Sends this same template again into the current channel.',
  send_message_template: 'Sends another saved message as a private reply by default; uncheck "Ephemeral" to post it into the current (or chosen) channel.',
  edit_message_template: 'Replaces this very message with another saved message (pick it below).',
};

function newEmbed() {
  return { title: '', description: '', color: '#5865F2', url: '', image: '', thumbnail: '', author: { name: '' }, fields: [], footer: { text: '' } };
}
function newAction() {
  return { type: 'none' };
}
function newButton(id) {
  return { type: 'button', id, label: 'Button', style: 'primary', url: '', disabled: false, actions: [newAction()] };
}
function newSelect(id) {
  return { type: 'select', id, placeholder: 'Select an option', minValues: 1, maxValues: 1, options: [{ label: 'Option', value: 'option1' }], actions: [newAction()] };
}
function defaultSpec(kind) {
  return kind === 'v1'
    ? { kind, content: '', embeds: [newEmbed()], components: [] }
    : { kind, content: '', container: { accentColor: '#5865F2', textDisplays: [], media: [], separators: true }, components: [] };
}
function safeParse(value) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return defaultSpec('v1');
    }
  }
  return value || defaultSpec('v1');
}

let uid = 1;
const nextId = (p) => `${p}${uid++}`;

function Hint({ children }) {
  return <div className="hint">{children}</div>;
}

function Section({ icon: Icon, title, help, actions, children }) {
  return (
    <div className="builder-section card">
      <div className="builder-section-head">
        <div className="builder-section-title">
          {Icon && <Icon size={15} />}
          <strong>{title}</strong>
        </div>
        <div className="builder-section-actions">{actions}</div>
      </div>
      {help && <Hint>{help}</Hint>}
      <div className="builder-section-body">{children}</div>
    </div>
  );
}

export default function Builder() {
  const [templates, setTemplates] = useState([]);
  const [current, setCurrent] = useState(null);
  const [isNew, setIsNew] = useState(true);
  const [channels, setChannels] = useState([]);
  const [roles, setRoles] = useState([]);
  const [sendChannel, setSendChannel] = useState('');
  const [sendMode, setSendMode] = useState('send');
  const [status, setStatus] = useState({ kind: 'ok', text: '' });
  const [showGuide, setShowGuide] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);

  async function loadTemplates() {
    const data = await api('/messages').catch(() => ({ rows: [] }));
    setTemplates(data.rows || []);
  }
  async function loadChannels() {
    const data = await api('/messages/channels').catch(() => ({ rows: [] }));
    setChannels((data.rows || []).filter((c) => [0, 5, 10, 11, 12, 15, 16].includes(c.type) || c.type === 4));
  }
  async function loadRoles() {
    const data = await api('/messages/roles').catch(() => ({ rows: [] }));
    setRoles((data.rows || []).filter((r) => !r.managed));
  }
  useEffect(() => {
    loadTemplates();
    loadChannels();
    loadRoles();
  }, []);

  const channelOptions = useMemo(() => {
    const map = new Map(channels.map((c) => [c.id, c]));
    const SEND_TYPES = [0, 5, 10, 11, 12, 15, 16];
    const labelFor = (c) => {
      if (c.type === 10 || c.type === 11 || c.type === 12) return { prefix: '🧵', name: `#${c.name}` };
      if (c.type === 15) return { prefix: '💬', name: c.name };
      if (c.type === 16) return { prefix: '🖼️', name: c.name };
      if (c.type === 5) return { prefix: '📢', name: c.name };
      return { prefix: '#', name: c.name };
    };
    const catId = (c) => {
      const parent = c.parent_id ? map.get(c.parent_id) : null;
      return parent && parent.type === 4 ? parent.id : null;
    };
    const cats = channels.filter((c) => c.type === 4).sort((a, b) => (a.position || 0) - (b.position || 0));
    const groups = [];
    const orphans = channels.filter((c) => SEND_TYPES.includes(c.type) && !catId(c))
      .sort((a, b) => (a.position || 0) - (b.position || 0));
    if (orphans.length) groups.push({ label: 'Uncategorized', options: orphans.map((c) => { const l = labelFor(c); return { value: c.id, label: `${l.prefix} ${l.name}` }; }) });
    for (const cat of cats) {
      const kids = channels.filter((c) => catId(c) === cat.id)
        .sort((a, b) => {
          const ta = SEND_TYPES.includes(a.type) ? 0 : 1;
          const tb = SEND_TYPES.includes(b.type) ? 0 : 1;
          return ta - tb || (a.position || 0) - (b.position || 0);
        });
      const opts = kids.filter((c) => SEND_TYPES.includes(c.type)).map((c) => { const l = labelFor(c); return { value: c.id, label: `${l.prefix} ${l.name}` }; });
      if (opts.length) groups.push({ label: cat.name, options: opts });
    }
    return groups;
  }, [channels]);

  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r.id, keywords: r.name, label: (
      <span className="role-option"><i className="role-dot" style={{ background: r.color ? `#${(r.color & 0xffffff).toString(16).padStart(6, '0')}` : 'transparent' }} />{r.name}</span>
    ) })),
    [roles],
  );

  const filteredTemplates = useMemo(
    () => templates.filter((t) => (t.name || '').toLowerCase().includes(search.toLowerCase())),
    [templates, search],
  );

  function selectTemplate(t) {
    setCurrent({ id: t.id, name: t.name, kind: t.kind, payload: safeParse(t.payload) });
    setIsNew(false);
  }
  function newTemplate(kind) {
    setCurrent({ id: null, name: `Template ${templates.length + 1}`, kind, payload: defaultSpec(kind) });
    setIsNew(true);
    setShowGuide(false);
  }
  const setPayload = (patch) => setCurrent((c) => ({ ...c, payload: { ...c.payload, ...patch } }));

  async function save() {
    if (!current?.name.trim()) {
      setStatus({ kind: 'err', text: 'Give the template a name first.' });
      return;
    }
    try {
      if (isNew) {
        const guildId = channels[0]?.guild_id || '0';
        const res = await api('/messages', { method: 'POST', body: JSON.stringify({ guildId, name: current.name, kind: current.kind, payload: current.payload }) });
        setCurrent({ ...current, id: res.id });
        setIsNew(false);
        setStatus({ kind: 'ok', text: 'Template saved.' });
      } else {
        await api(`/messages/${current.id}`, { method: 'PATCH', body: JSON.stringify({ name: current.name, kind: current.kind, payload: current.payload }) });
        setStatus({ kind: 'ok', text: 'Template updated.' });
      }
      await loadTemplates();
    } catch (err) {
      setStatus({ kind: 'err', text: err.message });
    }
    setTimeout(() => setStatus((s) => (s.text.includes('Template') ? { ...s, text: '' } : s)), 2500);
  }

  async function duplicate() {
    if (!current) return;
    await api('/messages', { method: 'POST', body: JSON.stringify({ guildId: current.payload.guildId || channels[0]?.guild_id || '0', name: `${current.name} (copy)`, kind: current.kind, payload: current.payload }) });
    await loadTemplates();
    setStatus({ kind: 'ok', text: 'Duplicated.' });
  }

  async function removeTemplate() {
    if (!current?.id) return;
    await api(`/messages/${current.id}`, { method: 'DELETE' });
    setCurrent(null);
    setIsNew(true);
    setStatus({ kind: 'ok', text: 'Template deleted.' });
    await loadTemplates();
  }

  async function sendMessage() {
    if (sendingRef.current) return;
    if (!current?.id) {
      setStatus({ kind: 'err', text: 'Save the template before sending.' });
      return;
    }
    if (!sendChannel) {
      setStatus({ kind: 'err', text: 'Choose a channel first.' });
      return;
    }
    const channel = channels.find((c) => c.id === sendChannel);
    const body = { channelId: sendChannel, guildId: channel?.guild_id || '0', mode: sendMode };
    if (sendMode === 'edit') {
      const sent = await api(`/messages/${current.id}/sent`, { method: 'GET' }).catch(() => ({ messageId: null }));
      if (!sent?.messageId) {
        setStatus({ kind: 'err', text: 'No previously-sent message for this template — use "Send new".' });
        return;
      }
      body.targetMessageId = sent.messageId;
    }
    sendingRef.current = true;
    setSending(true);
    setStatus({ kind: 'ok', text: 'Sending…' });
    try {
      const res = await api(`/messages/${current.id}/send`, { method: 'POST', body: JSON.stringify(body) });
      setStatus({ kind: 'ok', text: `Request #${res.requestId} queued — sending now…` });
      await pollStatus(res.requestId);
    } catch (err) {
      setStatus({ kind: 'err', text: err.message });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  async function pollStatus(requestId) {
    for (let i = 0; i < 12; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const res = await api(`/messages/requests/${requestId}`).catch(() => null);
      if (!res?.request) continue;
      if (res.request.status === 'done') {
        setStatus({ kind: 'ok', text: `Sent. Message ID ${res.request.message_id ?? ''}` });
        return;
      }
      if (res.request.status === 'failed') {
        setStatus({ kind: 'err', text: `Failed: ${res.request.error}` });
        return;
      }
    }
  }

  const payload = current?.payload;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Message Builder</h1>
          <p className="page-sub">Design embeds and Components V1/V2 messages, save them, send to any channel, and give buttons/selects persistent multi-actions.</p>
        </div>
        <div className="head-actions">
          <button className="btn sm secondary" onClick={() => setShowGuide(!showGuide)}>
            {showGuide ? <ChevronUp size={14} /> : <BookOpen size={14} />} {showGuide ? 'Hide guide' : 'How it works'}
          </button>
          <button className="btn sm secondary" onClick={() => setShowPreview(!showPreview)}>
            <Eye size={14} /> {showPreview ? 'Hide preview' : 'Show preview'}
          </button>
        </div>
      </div>

      {showGuide && <Guide />}

      <div className="builder-layout">
        <div className="card builder-side">
          <div className="builder-side-head">
            <strong>Templates</strong>
            <span className="page-sub">{templates.length}</span>
          </div>
          <div className="field grow" style={{ marginBottom: 8 }}>
            <Search size={14} className="field-icon" />
            <input placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn sm" style={{ width: '100%', marginBottom: 6 }} onClick={() => newTemplate('v1')}><Plus size={14} /> New V1 embed</button>
          <button className="btn sm secondary" style={{ width: '100%', marginBottom: 12 }} onClick={() => newTemplate('v2')}><Plus size={14} /> New V2 container</button>
          <div className="log-list" style={{ gap: 4 }}>
            {filteredTemplates.map((t) => (
              <div key={t.id} className={`template-item ${current?.id === t.id ? 'active' : ''}`} onClick={() => selectTemplate(t)}>
                <span className={`badge ${t.kind === 'v2' ? 'blue' : 'green'}`}>{t.kind}</span>
                <span className="template-name">{t.name}</span>
              </div>
            ))}
            {filteredTemplates.length === 0 && <div className="page-sub" style={{ padding: 8 }}>No templates yet — create one above.</div>}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {!payload && (
            <div className="card center-state">
              <Shapes size={30} />
              <span>Select a template on the left, or create a new one.</span>
            </div>
          )}
          {payload && (
            <>
              <div className="card">
                <div className="filters" style={{ justifyContent: 'space-between' }}>
                  <div className="field grow">
                    <MessageSquare size={14} className="field-icon" />
                    <input placeholder="Template name" value={current.name} onChange={(e) => setCurrent({ ...current, name: e.target.value })} />
                  </div>
                  <div className="seg">
                    <button className={`seg-btn ${current.kind === 'v1' ? 'active' : ''}`} onClick={() => setPayload({ kind: 'v1', embeds: payload.embeds || [newEmbed()] })}>V1 · Embeds</button>
                    <button className={`seg-btn ${current.kind === 'v2' ? 'active' : ''}`} onClick={() => setPayload({ kind: 'v2', container: payload.container || defaultSpec('v2').container })}>V2 · Container</button>
                  </div>
                </div>
              </div>

              <div className="builder-grid">
                <div className="builder-editor">
                  {payload.kind === 'v1' ? <V1Editor payload={payload} setPayload={setPayload} templates={templates} roles={roles} /> : <V2Editor payload={payload} setPayload={setPayload} templates={templates} roles={roles} />}
                </div>
                {showPreview && (
                  <div className="builder-preview">
                    <MessagePreview payload={payload} />
                  </div>
                )}
              </div>

              <div className="card builder-sendbar">
                <div className="filters">
                  <div className="field grow">
                    <Hash size={14} className="field-icon" />
                    <SearchSelect value={sendChannel} onChange={setSendChannel} placeholder="Choose a channel…" options={channels.map((c) => ({ value: c.id, label: `#${c.name}` }))} />
                  </div>
                  <SearchSelect className="compact" value={sendMode} onChange={setSendMode} searchable={false} options={[{ value: 'send', label: 'Send new' }, { value: 'edit', label: 'Edit last sent' }]} />
                  <button className="btn" onClick={sendMessage} disabled={sending}><Send size={14} /> {sending ? 'Sending…' : (sendMode === 'edit' ? 'Edit in Discord' : 'Send to Discord')}</button>
                  <button className="btn sm secondary" onClick={save}><Save size={14} /> Save</button>
                  <button className="btn sm secondary" onClick={duplicate}><Copy size={14} /> Duplicate</button>
                  {current.id && <button className="btn sm danger" onClick={removeTemplate}><Trash2 size={14} /> Delete</button>}
                </div>
                {status.text && (
                  <div className={`send-status ${status.kind === 'err' ? 'err' : ''}`}>
                    {status.kind === 'err' ? <X size={13} /> : <CheckCircle2 size={13} />} {status.text}
                  </div>
                )}
                <Hint>
                  Sending is queued in the database and the bot posts it within ~5 seconds. "Edit last sent" replaces the most recent message this template sent (same channel).
                </Hint>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Guide() {
  return (
    <div className="card guide">
      <div className="builder-section-head"><strong><BookOpen size={15} /> How the Message Builder works</strong></div>
      <ul className="guide-list">
        <li><strong>Templates</strong> — saved message designs. Save, then send to any channel, or re-edit the live copy.</li>
        <li><strong>V1 · Embeds</strong> — classic embed(s) + plain content + action rows (classic Discord components).</li>
        <li><strong>V2 · Container</strong> — the newer layout: accent color bar, text blocks, separators, media gallery, and buttons/selects.</li>
        <li><strong>Components &amp; actions</strong> — each button can run a <em>list of actions in order</em>: add/remove/toggle a role, reply, send a message, DM the clicker, re-post this message, or send another saved message. Dropdown (select) menus run actions <em>per option</em>: pick an option and give it its own actions.</li>
        <li><strong>Persistent</strong> — buttons/selects keep working forever, even after restart. Customise with a "Send saved message" action to chain templates.</li>
        <li><strong>Preview</strong> — a close approximation of Discord's rendering; the real look is final.</li>
      </ul>
    </div>
  );
}

function V1Editor({ payload, setPayload, templates, roles }) {
  const setEmbeds = (embeds) => setPayload({ embeds });
  return (
    <>
      <Section icon={AlignLeft} title="Content" help="Plain text shown above the embeds (optional).">
        <textarea style={{ minHeight: 70 }} value={payload.content || ''} onChange={(e) => setPayload({ content: e.target.value })} placeholder="Write content here…" />
      </Section>

      <Section
        icon={Wand2}
        title="Embeds"
        help="Add one or more rich embeds. Every field is optional."
        actions={<button className="btn sm secondary" onClick={() => setEmbeds([...(payload.embeds || []), newEmbed()])}><Plus size={12} /> Add embed</button>}
      >
        {(payload.embeds || []).map((embed, ei) => (
          <EmbedEditor key={ei} embed={embed} index={ei} onUpdate={(e) => { const arr = [...payload.embeds]; arr[ei] = e; setEmbeds(arr); }} onRemove={() => setEmbeds(payload.embeds.filter((_, i) => i !== ei))} />
        ))}
        {(payload.embeds || []).length === 0 && <div className="page-sub">No embeds yet.</div>}
      </Section>

      <ComponentsSection payload={payload} setPayload={setPayload} templates={templates} roles={roles} />
    </>
  );
}

function V2Editor({ payload, setPayload, templates, roles }) {
  const container = payload.container || {};
  const setContainer = (patch) => setPayload({ container: { ...container, ...patch } });
  return (
    <>
      <Section icon={Palette} title="Container" help="The V2 look: an accent color bar, text blocks, separators and a media gallery.">
        <div className="filters">
          <input type="color" value={container.accentColor || '#5865F2'} onChange={(e) => setContainer({ accentColor: e.target.value })} title="Accent color" />
          <label className="btn sm secondary" style={{ cursor: 'pointer' }}>Separators
            <input type="checkbox" checked={container.separators !== false} onChange={(e) => setContainer({ separators: e.target.checked })} style={{ marginLeft: 6 }} />
          </label>
        </div>
      </Section>

      <Section icon={AlignLeft} title="Content" help="Top text block of the container (optional).">
        <textarea style={{ minHeight: 70 }} value={payload.content || ''} onChange={(e) => setPayload({ content: e.target.value })} placeholder="Write content here…" />
        <Hint>Variables: <code>{'{user}'}</code>, <code>{'{username}'}</code>, <code>{'{nowtimestamp}'}</code>. When a role action runs before a "send message" action: <code>{'${roleadded}'}</code> and <code>{'${rolesremoved}'}</code> show the role names that were added/removed.</Hint>
      </Section>

      <Section
        icon={Rows3}
        title="Text blocks"
        help="Additional text sections separated by dividers."
        actions={<button className="btn sm secondary" onClick={() => setContainer({ textDisplays: [...(container.textDisplays || []), ''] })}><Plus size={12} /> Add block</button>}
      >
        {(container.textDisplays || []).map((t, i) => (
          <div key={i} className="field-row">
            <textarea style={{ minHeight: 50 }} value={t} onChange={(e) => { const arr = [...container.textDisplays]; arr[i] = e.target.value; setContainer({ textDisplays: arr }); }} />
            <button className="btn sm danger" onClick={() => setContainer({ textDisplays: container.textDisplays.filter((_, x) => x !== i) })}><Trash2 size={13} /></button>
          </div>
        ))}
      </Section>

      <Section
        icon={ImageIcon}
        title="Media gallery"
        help="Image URLs shown below the text."
        actions={<button className="btn sm secondary" onClick={() => setContainer({ media: [...(container.media || []), ''] })}><Plus size={12} /> Add image</button>}
      >
        {(container.media || []).map((m, i) => (
          <div key={i} className="field-row">
            <input placeholder="Image URL" value={m} onChange={(e) => { const arr = [...container.media]; arr[i] = e.target.value; setContainer({ media: arr }); }} />
            <button className="btn sm danger" onClick={() => setContainer({ media: container.media.filter((_, x) => x !== i) })}><Trash2 size={13} /></button>
          </div>
        ))}
      </Section>

      <ComponentsSection payload={payload} setPayload={setPayload} templates={templates} roles={roles} />
    </>
  );
}

function EmbedEditor({ embed, index, onUpdate, onRemove }) {
  const upd = (patch) => onUpdate({ ...embed, ...patch });
  return (
    <div className="builder-subcard">
      <div className="builder-subcard-head">
        <strong>Embed {index + 1}</strong>
        <button className="btn sm danger" onClick={onRemove} title="Remove embed"><Trash2 size={13} /></button>
      </div>
      <div className="field-row">
        <input placeholder="Title" value={embed.title || ''} onChange={(e) => upd({ title: e.target.value })} />
      </div>
      <div className="field-row">
        <input placeholder="URL (title becomes a link)" value={embed.url || ''} onChange={(e) => upd({ url: e.target.value })} />
        <div className="color-wrap"><input type="color" value={embed.color || '#5865F2'} onChange={(e) => upd({ color: e.target.value })} title="Accent color" /><span className="mono">{embed.color || '#5865F2'}</span></div>
      </div>
      <div className="field-row">
        <input placeholder="Author name" value={embed.author?.name || ''} onChange={(e) => upd({ author: { ...embed.author, name: e.target.value } })} />
      </div>
      <div className="field-row">
        <input placeholder="Thumbnail URL" value={embed.thumbnail || ''} onChange={(e) => upd({ thumbnail: e.target.value })} />
        <input placeholder="Image URL" value={embed.image || ''} onChange={(e) => upd({ image: e.target.value })} />
      </div>
      <textarea style={{ minHeight: 70 }} placeholder="Description" value={embed.description || ''} onChange={(e) => upd({ description: e.target.value })} />
      <div className="field-row">
        <input placeholder="Footer text" value={embed.footer?.text || ''} onChange={(e) => upd({ footer: { ...embed.footer, text: e.target.value } })} />
        <label className="btn sm secondary" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Timestamp
          <input type="checkbox" checked={!!embed.timestamp} onChange={(e) => upd({ timestamp: e.target.checked })} style={{ marginLeft: 6 }} />
        </label>
      </div>
      <div className="fields-head">
        <strong>Fields</strong>
        <button className="btn sm secondary" onClick={() => upd({ fields: [...(embed.fields || []), { name: 'Field', value: 'Value' }] })}><Plus size={12} /> Add field</button>
      </div>
      {(embed.fields || []).map((f, fi) => (
        <div key={fi} className="field-row">
          <input placeholder="Name" value={f.name} onChange={(e) => { const fields = [...embed.fields]; fields[fi] = { ...f, name: e.target.value }; upd({ fields }); }} />
          <input placeholder="Value" value={f.value} onChange={(e) => { const fields = [...embed.fields]; fields[fi] = { ...f, value: e.target.value }; upd({ fields }); }} />
          <label className="btn sm secondary" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Inline
            <input type="checkbox" checked={!!f.inline} onChange={(e) => { const fields = [...embed.fields]; fields[fi] = { ...f, inline: e.target.checked }; upd({ fields }); }} style={{ marginLeft: 6 }} />
          </label>
          <button className="btn sm danger" onClick={() => upd({ fields: embed.fields.filter((_, x) => x !== fi) })}><Trash2 size={13} /></button>
        </div>
      ))}
    </div>
  );
}

function ComponentsSection({ payload, setPayload, templates, roles }) {
  const setComponents = (components) => setPayload({ components });
  const rows = payload.components || [];
  const add = (make) => setComponents([...rows, { components: [make()] }]);
  const addToRow = (ri, make) => { const arr = [...rows]; arr[ri] = { components: [...arr[ri].components, make()] }; setComponents(arr); };
  return (
    <Section
      icon={Wand2}
      title="Components & actions"
      help="Buttons and select menus. Each one runs its actions in order when clicked — including sending other saved messages."
      actions={
        <>
          <button className="btn sm secondary" onClick={() => add(() => newButton(nextId('b')))}><Plus size={12} /> Button</button>
          <button className="btn sm secondary" onClick={() => add(() => newSelect(nextId('s')))}><Plus size={12} /> Select</button>
        </>
      }
    >
      {rows.map((row, ri) => (
        <div key={ri} className="builder-subcard">
          <div className="builder-subcard-head">
            <strong>Row {ri + 1}</strong>
            <div>
              <button className="btn sm secondary" onClick={() => addToRow(ri, () => newButton(nextId('b')))}><Plus size={12} /> Button</button>
              <button className="btn sm secondary" onClick={() => addToRow(ri, () => newSelect(nextId('s')))}><Plus size={12} /> Select</button>
              <button className="btn sm danger" onClick={() => setComponents(rows.filter((_, i) => i !== ri))} title="Remove row"><Trash2 size={13} /></button>
            </div>
          </div>
          {row.components.map((comp, ci) => (
            <ComponentEditor key={ci} comp={comp} templates={templates} roles={roles} onUpdate={(c) => { const arr = [...rows]; arr[ri].components[ci] = c; setComponents(arr); }} onRemove={() => { const arr = [...rows]; arr[ri].components = arr[ri].components.filter((_, i) => i !== ci); setComponents(arr); }} />
          ))}
        </div>
      ))}
      {rows.length === 0 && <div className="page-sub">No components yet — add a button or select above.</div>}
    </Section>
  );
}

function ComponentEditor({ comp, templates, roles, onUpdate, onRemove }) {
  const upd = (patch) => onUpdate({ ...comp, ...patch });
  const isLink = Boolean(comp.url);
  return (
    <div className="component-editor">
      <div className="builder-subcard-head">
        <strong>{comp.type === 'button' ? 'Button' : 'Select menu'}</strong>
        <button className="btn sm danger" onClick={onRemove} title="Remove component"><Trash2 size={13} /></button>
      </div>

      {comp.type === 'button' && (
        <>
          <div className="field-row">
            <input placeholder="Label" value={comp.label} onChange={(e) => upd({ label: e.target.value })} />
            <SearchSelect className="compact" value={comp.style} onChange={(style) => upd({ style })} searchable={false} options={BTN_STYLES.map((s) => ({ value: s, label: s }))} />
          </div>
          <div className="field-row">
            <div className="field grow">
              <Link2 size={13} className="field-icon" />
              <input placeholder="URL (leave empty for actions; makes it a link button)" value={comp.url || ''} onChange={(e) => upd({ url: e.target.value })} />
            </div>
          </div>
          {isLink && <Hint>Link buttons just open the URL — they can't run actions.</Hint>}
        </>
      )}

      {comp.type === 'select' && (
        <>
          <div className="field-row">
            <input placeholder="Placeholder" value={comp.placeholder || ''} onChange={(e) => upd({ placeholder: e.target.value })} />
          </div>
          <div className="field-row" style={{ alignItems: 'center' }}>
            <label className="btn sm secondary" style={{ cursor: 'pointer', display: 'inline-flex', gap: 6, margin: 0 }}>
              <input
                type="checkbox"
                checked={(comp.maxValues ?? 1) > 1}
                onChange={(e) =>
                  upd(e.target.checked
                    ? { minValues: 1, maxValues: Math.min(2, (comp.options || []).length || 2) }
                    : { minValues: 1, maxValues: 1 })
                }
              />
              Allow multiple selections
            </label>
            {(comp.maxValues ?? 1) > 1 && (
              <div className="field-row" style={{ flex: 1 }}>
                <input
                  type="number" min={1} max={25} placeholder="Min selections"
                  value={comp.minValues ?? 1}
                  onChange={(e) => upd({ minValues: Math.max(1, Math.min(Number(e.target.value) || 1, (comp.options || []).length || 1, 25)) })}
                />
                <input
                  type="number" min={1} max={25} placeholder="Max selections"
                  value={comp.maxValues ?? 1}
                  onChange={(e) => upd({ maxValues: Math.max((comp.minValues ?? 1), Math.min(Number(e.target.value) || 1, (comp.options || []).length || 1, 25)) })}
                />
              </div>
            )}
          </div>
          <Hint>Each option runs <em>its own</em> actions when a user picks it — configure them under every option below. With multiple selections allowed, the actions for <em>every</em> chosen option run.</Hint>
          <div className="fields-head">
            <strong>Options &amp; per-option actions</strong>
            <button className="btn sm secondary" onClick={() => upd({ options: [...(comp.options || []), { label: 'Option', value: `option${(comp.options || []).length + 1}` }] })}><Plus size={12} /> Add option</button>
          </div>
          {(comp.options || []).map((o, oi) => (
            <div key={oi} className="option-editor">
              <div className="option-head">
                <strong>{o.label || `Option ${oi + 1}`}</strong>
                <button className="btn sm danger" onClick={() => upd({ options: comp.options.filter((_, x) => x !== oi) })} title="Remove option"><Trash2 size={13} /></button>
              </div>
              <div className="field-row">
                <input placeholder="Label" value={o.label} onChange={(e) => { const options = [...comp.options]; options[oi] = { ...o, label: e.target.value }; upd({ options }); }} />
                <input placeholder="Value" value={o.value} onChange={(e) => { const options = [...comp.options]; options[oi] = { ...o, value: e.target.value }; upd({ options }); }} />
              </div>
              <ActionsListEditor
                actions={o.actions || (o.action ? [o.action] : [newAction()])}
                templates={templates}
                roles={roles}
                title="Actions when selected"
                onChange={(actions) => { const options = [...comp.options]; options[oi] = { ...o, actions }; upd({ options }); }}
              />
            </div>
          ))}
        </>
      )}

      {comp.type === 'button' && !isLink && (
        <ActionsListEditor
          actions={comp.actions || (comp.action ? [comp.action] : [newAction()])}
          templates={templates}
          roles={roles}
          onChange={(actions) => upd({ actions })}
        />
      )}
    </div>
  );
}

function ActionsListEditor({ actions, templates, roles, onChange, title }) {
  const set = (list) => onChange(list.filter(Boolean));
  const roleOptions = useMemo(
    () => (roles || []).map((r) => ({ value: r.id, keywords: r.name, label: (
      <span className="role-option"><i className="role-dot" style={{ background: r.color ? `#${(r.color & 0xffffff).toString(16).padStart(6, '0')}` : 'transparent' }} />{r.name}</span>
    ) })),
    [roles],
  );
  return (
    <div className="actions-editor">
      <div className="fields-head">
        <strong>{title || `Actions (${actions.length})`}</strong>
        {!title && <span className="page-sub" style={{ fontSize: 11 }}>run in order</span>}
        <button className="btn sm secondary" onClick={() => set([...actions, newAction()])}><Plus size={12} /> Add action</button>
      </div>
      {actions.map((action, ai) => {
        const help = ACTION_HELP[action.type] || '';
        return (
          <div key={ai} className="action-card">
            <div className="field-row">
              <span className="badge blue">#{ai + 1}</span>
              <SearchSelect
                value={action.type || 'none'}
                onChange={(type) => { const arr = [...actions]; arr[ai] = { type }; set(arr); }}
                placeholder="Choose an action…"
                options={[
                  { label: 'Basic', options: ACTIONS.filter((a) => a.value === 'none') },
                  { label: 'Roles', options: ACTIONS.filter((a) => a.value.startsWith('role')) },
                  { label: 'Messages', options: ACTIONS.filter((a) => a.value !== 'none' && !a.value.startsWith('role')) },
                ]}
              />
              <button className="btn sm danger" onClick={() => set(actions.filter((_, i) => i !== ai))} title="Remove action"><Trash2 size={13} /></button>
            </div>
            {help && <Hint>{help}</Hint>}
            {(action.type === 'role_add' || action.type === 'role_remove' || action.type === 'role_toggle') && (
              <div className="field-row">
                <SearchSelect
                  value={action.roleId || ''}
                  onChange={(roleId) => { const arr = [...actions]; arr[ai] = { ...arr[ai], roleId }; set(arr); }}
                  placeholder="Select a role…"
                  options={roleOptions}
                />
                <input placeholder="Confirm text (optional)" value={action.content || ''} onChange={(e) => { const arr = [...actions]; arr[ai] = { ...arr[ai], content: e.target.value }; set(arr); }} />
              </div>
            )}
            {(action.type === 'reply' || action.type === 'send_message' || action.type === 'dm_user') && (
              <div className="field-row">
                <input placeholder="Message content" value={action.content || ''} onChange={(e) => { const arr = [...actions]; arr[ai] = { ...arr[ai], content: e.target.value }; set(arr); }} />
                {action.type === 'reply' && (
                  <label className="btn sm secondary" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Ephemeral (default)
                    <input type="checkbox" checked={action.ephemeral !== false} onChange={(e) => { const arr = [...actions]; arr[ai] = { ...arr[ai], ephemeral: e.target.checked }; set(arr); }} style={{ marginLeft: 6 }} />
                  </label>
                )}
              </div>
            )}
            {(action.type === 'send_message_template' || action.type === 'edit_message_template') && (
              <div className="field-row">
                <SearchSelect
                  value={action.messageId || ''}
                  onChange={(messageId) => { const arr = [...actions]; arr[ai] = { ...arr[ai], messageId }; set(arr); }}
                  placeholder="Select a saved message…"
                  options={templates.map((t) => ({ value: String(t.id), label: `${t.name} (#${t.id})` }))}
                />
                {action.type === 'send_message_template' ? (
                  <>
                    <input placeholder="Target channel ID (optional)" value={action.channelId || ''} onChange={(e) => { const arr = [...actions]; arr[ai] = { ...arr[ai], channelId: e.target.value }; set(arr); }} />
                    <label className="btn sm secondary" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>Ephemeral (default)
                      <input type="checkbox" checked={action.ephemeral !== false} onChange={(e) => { const arr = [...actions]; arr[ai] = { ...arr[ai], ephemeral: e.target.checked }; set(arr); }} style={{ marginLeft: 6 }} />
                    </label>
                  </>
                ) : (
                  <Hint>Replaces the current message with the selected template.</Hint>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MessagePreview({ payload }) {
  const styleFor = { primary: 'var(--accent)', secondary: 'var(--bg-3)', success: 'var(--success)', danger: 'var(--danger)', link: 'var(--accent)' };
  return (
    <div className="card preview-card">
      <div className="preview-head"><Eye size={13} /> Live preview <span className="page-sub" style={{ fontSize: 11 }}>(approximate)</span></div>
      {payload.content && <div style={{ marginBottom: 6 }}>{payload.content}</div>}
      {payload.kind === 'v2' && (
        <div className="v2-preview">
          <div className="v2-accent" style={{ background: payload.container?.accentColor || '#5865F2' }} />
          <div className="v2-body">
            {(payload.container?.textDisplays || []).map((t, i) => (
              <div key={i} className="v2-block" style={{ borderBottom: payload.container?.separators !== false ? '1px solid var(--border)' : 'none' }}>{t || ' '}</div>
            ))}
            {(payload.container?.media || []).map((m, i) => (
              <img key={i} src={m} alt="media" onError={(e) => (e.currentTarget.style.display = 'none')} />
            ))}
          </div>
        </div>
      )}
      {(payload.embeds || []).map((e, i) => (
        <div key={i} className="embed-preview" style={{ borderLeftColor: e.color || '#5865F2' }}>
          {e.author?.name && <div className="embed-author">{e.author.name}</div>}
          {e.title && <div className="embed-title">{e.title}</div>}
          {e.description && <div className="embed-desc">{e.description}</div>}
          {(e.fields || []).length > 0 && (
            <div className="embed-fields">
              {e.fields.map((f, fi) => (
                <div key={fi} className={`embed-field ${f.inline ? 'inline' : ''}`}>
                  <div className="embed-field-name">{f.name}</div>
                  <div className="embed-field-value">{f.value}</div>
                </div>
              ))}
            </div>
          )}
          {e.image && <img src={e.image} alt="embed" onError={(ev) => (ev.currentTarget.style.display = 'none')} />}
          {e.footer?.text && <div className="embed-footer">{e.footer.text}</div>}
        </div>
      ))}
      {(payload.components || []).map((row, ri) => (
        <div key={ri} className="preview-row">
          {row.components.map((c, ci) =>
            c.type === 'button' ? (
              <span key={ci} className={`preview-btn ${c.url ? 'link' : ''}`} style={!c.url ? { background: styleFor[c.style] || 'var(--bg-3)' } : {}}>{c.label}</span>
            ) : (
              <span key={ci} className="preview-select">{c.placeholder || 'Select…'}</span>
            ),
          )}
        </div>
      ))}
    </div>
  );
}