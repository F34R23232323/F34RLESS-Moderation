import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ShieldAlert, LogIn, ArrowRight, Ban, Loader2, ServerOff, AlertTriangle,
  CheckCircle2, XCircle, Clock3, MessageSquareText,
} from 'lucide-react';
import StepProgress from './StepProgress';
import AppealForm from './AppealForm';
import AppealChat from './AppealChat';
import { appealsApi, oauthMe, loginUrl, connectAppealWs, ApiError } from './appealsApi';

const STATUS_META = {
  pending: { label: 'Under review', cls: 'pending', icon: Clock3 },
  accepted: { label: 'Accepted', cls: 'accepted', icon: CheckCircle2 },
  denied: { label: 'Denied', cls: 'denied', icon: XCircle },
  ignored: { label: 'Ignored', cls: 'ignored', icon: Ban },
};

function Spinner() {
  return (
    <div className="appeal-center">
      <Loader2 size={26} className="appeal-spin" />
      <span>Loading…</span>
    </div>
  );
}

function StateShell({ icon: Icon, title, children }) {
  return (
    <div className="appeal-state">
      <div className="appeal-state-icon"><Icon size={26} /></div>
      <h2 className="appeal-state-title">{title}</h2>
      <div className="appeal-state-body">{children}</div>
    </div>
  );
}

export default function AppealsApp({ guildId }) {
  const [config, setConfig] = useState(null);
  const [auth, setAuth] = useState(null);
  const [view, setView] = useState('loading'); // loading | login | not-configured | not-member | blocked | flow | error
  const [blocked, setBlocked] = useState(null);
  const [cases, setCases] = useState([]);
  const [openAppeal, setOpenAppeal] = useState(null);
  const [step, setStep] = useState(1);
  const [selectedCase, setSelectedCase] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [flowError, setFlowError] = useState('');
  const wsRef = useRef(null);

  const stopWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current();
      wsRef.current = null;
    }
  }, []);

  const openStatusView = useCallback(
    async (appealId) => {
      stopWs();
      setFlowError('');
      try {
        const [status, msgs] = await Promise.all([
          appealsApi(`/${guildId}/${appealId}/status`),
          appealsApi(`/${guildId}/${appealId}/messages`),
        ]);
        setStatusData(status);
        setMessages(msgs.messages || []);
        setStep(status.appeal.status === 'pending' ? 4 : 5);
        wsRef.current = connectAppealWs({
          guildId,
          appealId,
          onStatus: (payload) => {
            setStatusData((prev) =>
              prev
                ? {
                    ...prev,
                    appeal: {
                      ...prev.appeal,
                      status: payload.status,
                      decidedAt: payload.decidedAt,
                      decidedBy: payload.decidedBy,
                      decisionReason: payload.decisionReason,
                    },
                  }
                : prev,
            );
            setStep((cur) => {
              if (payload.status !== 'pending') return 5;
              return Math.max(cur, 4);
            });
          },
          onMessage: (message) => {
            setMessages((prev) => (prev.some((m) => Number(m.id) === Number(message.id)) ? prev : [...prev, message]));
          },
          onClose: () => undefined,
        });
      } catch (e) {
        setFlowError(e instanceof ApiError ? (e.body.error || e.message) : String(e));
      }
    },
    [guildId, stopWs],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cfg, me] = await Promise.all([appealsApi(`/${guildId}/config`), oauthMe()]);
        if (cancelled) return;
        setConfig(cfg);
        setAuth(me);
        if (cfg.error === 'guild_not_found' || !cfg.enabled) {
          setView('not-configured');
          return;
        }
        if (!me.authenticated) {
          setView('login');
          return;
        }
        // Authenticated + member check.
        try {
          const mine = await appealsApi(`/${guildId}/my-cases`);
          if (cancelled) return;
          if (mine.blocked) {
            setBlocked(mine.blocked);
            setView('blocked');
            return;
          }
          setCases(mine.cases || []);
          if (mine.openAppeal) {
            setOpenAppeal(mine.openAppeal);
            setView('flow');
            setStep(4);
            await openStatusView(mine.openAppeal.appealId);
          } else {
            setView('flow');
            setStep(1);
          }
        } catch (e) {
          if (cancelled) return;
          if (e instanceof ApiError && e.status === 403 && e.body.error === 'not_member') {
            setView('not-member');
          } else {
            setFlowError(e instanceof ApiError ? (e.body.error || e.message) : String(e));
            setView('error');
          }
        }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          setView('not-configured');
        } else {
          setFlowError(e instanceof ApiError ? (e.body.error || e.message) : String(e));
          setView('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      stopWs();
    };
  }, [guildId, openStatusView, stopWs]);

  async function submitAppeal(answers) {
    setSubmitting(true);
    setFlowError('');
    try {
      const res = await appealsApi(`/${guildId}`, {
        method: 'POST',
        body: { caseId: selectedCase.id, answers },
      });
      setStep(3);
      setOpenAppeal({ appealId: res.appealId, status: 'pending' });
      await openStatusView(res.appealId);
    } catch (e) {
      setFlowError(e instanceof ApiError ? (e.body.error || e.message) : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function sendMessage(content) {
    const res = await appealsApi(`/${guildId}/${statusData.appeal.id}/messages`, {
      method: 'POST',
      body: { content },
    });
    const selfId = statusData.selfId;
    setMessages((prev) => [
      ...prev,
      { id: res.id, senderType: statusData.access === 'owner' ? 'user' : 'staff', senderId: selfId, content, sentAt: new Date().toISOString() },
    ]);
  }

  if (view === 'loading') {
    return (
      <div className="appeals-wrap">
        <AppealHeader guildName={config?.guildName} />
        <Spinner />
      </div>
    );
  }

  if (view === 'not-configured') {
    return (
      <div className="appeals-wrap">
        <AppealHeader guildName={config?.guildName} />
        <StateShell icon={ServerOff} title="Appeals aren't set up for this server">
          <p>This server hasn't enabled the appeals portal yet. Check back later, or contact its staff.</p>
        </StateShell>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="appeals-wrap">
        <AppealHeader guildName={config?.guildName} />
        <StateShell icon={LogIn} title="Sign in to continue">
          <p>You need a Discord account to view or submit an appeal here.</p>
          <a className="appeal-btn appeal-btn-primary" href={loginUrl(guildId)}>
            <LogIn size={15} /> Sign in with Discord <ArrowRight size={15} />
          </a>
        </StateShell>
      </div>
    );
  }

  if (view === 'not-member') {
    return (
      <div className="appeals-wrap">
        <AppealHeader guildName={config?.guildName} guildIcon={config?.guildIcon} />
        <StateShell icon={ShieldAlert} title="You're not in this server">
          <p>
            You need to be a member of <strong>{config?.guildName || 'this server'}</strong> to submit an appeal here.
          </p>
        </StateShell>
      </div>
    );
  }

  if (view === 'blocked') {
    return (
      <div className="appeals-wrap">
        <AppealHeader guildName={config?.guildName} />
        <div className="appeal-state blocked">
          <div className="appeal-state-icon"><Ban size={26} /></div>
          <h2 className="appeal-state-title">You are blocked from submitting appeals</h2>
          <div className="appeal-block-card">
            <div><strong>Reason:</strong> {blocked.reason}</div>
            <div><strong>Expires:</strong> {blocked.expiresAt ? new Date(blocked.expiresAt).toLocaleString() : 'never'}</div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'error') {
    return (
      <div className="appeals-wrap">
        <AppealHeader guildName={config?.guildName} />
        <StateShell icon={AlertTriangle} title="Something went wrong">
          <p>{flowError}</p>
          <button className="appeal-btn" onClick={() => window.location.reload()}>Try again</button>
        </StateShell>
      </div>
    );
  }

  // ── Flow (case select → form → status) ────────────────────────────────────
  const meta = statusData ? STATUS_META[statusData.appeal.status] || STATUS_META.pending : null;

  return (
    <div className="appeals-wrap">
      <AppealHeader guildName={config?.guildName} />
      <div className="appeal-card">
        <StepProgress current={step} />

        {step === 1 && (
          <div className="appeal-step-body">
            <h3 className="appeal-h3">Select a case to appeal</h3>
            <p className="appeal-sub">Only eligible punishments are shown. Cases you've already appealed are hidden.</p>
            {flowError && <div className="appeal-form-error">{flowError}</div>}
            {cases.length === 0 ? (
              <div className="appeal-empty">
                <CheckCircle2 size={24} />
                <span>You don't have any cases that can be appealed right now.</span>
              </div>
            ) : (
              <div className="appeal-cases">
                {cases.map((c) => (
                  <button
                    key={c.id}
                    className={'appeal-case' + (selectedCase?.id === c.id ? ' selected' : '')}
                    onClick={() => setSelectedCase(c)}
                  >
                    <div className="appeal-case-top">
                      <span className="mono">Case #{c.caseNumber}</span>
                      <span className={'appeal-badge ' + c.type}>{c.type}</span>
                    </div>
                    <div className="appeal-case-reason">{c.reason || 'No reason provided.'}</div>
                    <div className="appeal-case-date">{new Date(c.createdAt).toLocaleDateString()}</div>
                  </button>
                ))}
              </div>
            )}
            {cases.length > 0 && (
              <div className="appeal-panel-actions">
                <button
                  className="appeal-btn appeal-btn-primary"
                  disabled={!selectedCase}
                  onClick={() => setStep(2)}
                >
                  Continue <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="appeal-step-body">
            <h3 className="appeal-h3">Fill out the appeal form</h3>
            <p className="appeal-sub">
              Case <span className="mono">#{selectedCase?.caseNumber}</span> — <strong>{selectedCase?.type}</strong>
            </p>
            {flowError && <div className="appeal-form-error">{flowError}</div>}
            <AppealForm
              form={config.form || []}
              busy={submitting}
              onSubmit={submitAppeal}
              onBack={() => {
                setFlowError('');
                setStep(1);
              }}
            />
          </div>
        )}

        {step >= 3 && statusData && (
          <div className="appeal-step-body">
            <div className="appeal-status-head">
              <h3 className="appeal-h3">Appeal #{statusData.appeal.id}</h3>
              <span className={`appeal-badge ${meta.cls}`}>{meta.label}</span>
            </div>

            <div className="appeal-timeline">
              {statusData.timeline.map((t, i) => (
                <div className="appeal-timeline-item" key={`${t.type}-${i}`}>
                  <div className="appeal-timeline-dot" />
                  <div>
                    <div className="appeal-timeline-label">
                      {t.type === 'submitted' ? 'Submitted' : `Decided — ${t.type}`}
                    </div>
                    <div className="appeal-timeline-at">{new Date(t.at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>

            {statusData.appeal.status !== 'pending' && (
              <div className="appeal-decision">
                <div className="appeal-decision-head">
                  <span className={'appeal-badge ' + meta.cls}>{meta.label}</span>
                  <span className="appeal-decision-at">
                    {statusData.appeal.decidedAt ? new Date(statusData.appeal.decidedAt).toLocaleString() : ''}
                  </span>
                </div>
                {statusData.appeal.decisionReason && <div className="appeal-decision-reason">{statusData.appeal.decisionReason}</div>}
              </div>
            )}

            <div className="appeal-section-title"><MessageSquareText size={15} /> Appeal chat</div>
            <AppealChat
              messages={messages}
              selfId={statusData.selfId}
              canChat={statusData.access === 'owner' || statusData.access === 'staff'}
              disabled={statusData.appeal.status !== 'pending'}
              onSend={sendMessage}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function AppealHeader({ guildName, guildIcon }) {
  return (
    <header className="appeal-header">
      <div className="appeal-brand">
        <div className="appeal-brand-mark"><ShieldAlert size={18} /></div>
        <div>
          <div className="appeal-brand-name">f34rless Appeals</div>
          {guildName && <div className="appeal-brand-guild">{guildName}</div>}
        </div>
      </div>
      {guildIcon && <img className="appeal-guild-icon" src={guildIcon} alt="" />}
    </header>
  );
}
