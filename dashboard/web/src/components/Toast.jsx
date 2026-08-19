import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { onApiError, messageOf } from '../api';

const ToastContext = createContext(null);

let uid = 1;

const ICONS = {
  success: { icon: CheckCircle2, className: 'toast-success' },
  error: { icon: XCircle, className: 'toast-error' },
  warning: { icon: AlertTriangle, className: 'toast-warning' },
  info: { icon: Info, className: 'toast-info' },
};

const DURATION = { success: 3200, error: 6000, warning: 4500, info: 3500 };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const push = useCallback((type, title, message) => {
    const id = uid++;
    setToasts((prev) => [...prev.slice(-3), { id, type, title, message }]);
    timers.current.set(id, setTimeout(() => dismiss(id), DURATION[type] ?? 4000));
    return id;
  }, [dismiss]);

  const toast = useCallback((message, type = 'info', title) => {
    push(type, title, message);
  }, [push]);

  const success = useCallback((message, title) => push('success', title, message), [push]);
  const error = useCallback((message, title) => push('error', title, message), [push]);
  const warning = useCallback((message, title) => push('warning', title, message), [push]);
  const info = useCallback((message, title) => push('info', title, message), [push]);

  // Auto-report any unhandled API error anywhere in the app.
  useEffect(() => {
    const off = onApiError((err) => {
      push('error', 'Request failed', messageOf(err));
    });
    return off;
  }, [push]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      <div className="toast-viewport" aria-live="polite">
        {toasts.map((t) => {
          const { icon: Icon, className } = ICONS[t.type] || ICONS.info;
          return (
            <div key={t.id} className={`toast ${className}`} role="status">
              <Icon size={18} className="toast-icon" />
              <div className="toast-body">
                {t.title && <div className="toast-title">{t.title}</div>}
                {t.message && <div className="toast-message">{t.message}</div>}
              </div>
              <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

export default ToastProvider;
