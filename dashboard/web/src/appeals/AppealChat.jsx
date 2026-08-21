import React, { useEffect, useRef, useState } from 'react';
import { Send, MessageSquareText } from 'lucide-react';

// Live appeal chat — synced two ways with the Discord thread via the WS-pushed
// appeal_message events and the REST POST endpoint.
export default function AppealChat({ messages = [], selfId, canChat, onSend, disabled }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  async function submit() {
    const content = draft.trim();
    if (!content || sending || !onSend) return;
    setSending(true);
    setError('');
    try {
      await onSend(content);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  if (messages.length === 0 && !canChat) {
    return (
      <div className="appeal-empty">
        <MessageSquareText size={22} />
        <span>No messages yet.</span>
      </div>
    );
  }

  return (
    <div className="appeal-chat">
      <div className="appeal-chat-scroll" ref={scrollRef}>
        {messages.map((m) => {
          const isSystem = m.senderType === 'staff' && m.senderId === 'system';
          const mine = !isSystem && (String(m.senderId) === String(selfId) || m.senderType === 'user');
          return (
            <div key={m.id} className={'appeal-msg' + (isSystem ? ' system' : mine ? ' mine' : ' theirs')}>
              <div className="appeal-msg-meta">
                {isSystem ? 'System' : mine ? 'You' : m.senderType === 'staff' ? 'Staff' : 'Appellant'}
                <span className="appeal-msg-time">{new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="appeal-msg-body">{m.content}</div>
            </div>
          );
        })}
      </div>

      {canChat && !disabled ? (
        <div className="appeal-chat-input">
          <textarea
            value={draft}
            maxLength={2000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Write a message… (staff replies also appear in Discord)"
            rows={2}
          />
          {error && <div className="appeal-form-error">{error}</div>}
          <button className="appeal-btn appeal-btn-primary" onClick={submit} disabled={!draft.trim() || sending}>
            <Send size={15} />
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      ) : (
        <div className="appeal-chat-locked">The appeal is closed — chat is read-only.</div>
      )}
    </div>
  );
}
