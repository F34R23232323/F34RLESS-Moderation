import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';

// Dynamic form rendered from GET /api/appeals/:guildId/config. Text questions
// get live character counters respecting min/max; checkboxes are toggles.
export default function AppealForm({ form, onSubmit, onBack, busy }) {
  const [values, setValues] = useState({});
  const [checks, setChecks] = useState({});
  const [errors, setErrors] = useState({});

  const byId = useMemo(() => new Map(form.map((q) => [q.id, q])), [form]);

  function setText(id, v) {
    setValues((p) => ({ ...p, [id]: v }));
    if (errors[id]) setErrors((p) => ({ ...p, [id]: undefined }));
  }
  function toggle(id) {
    setChecks((p) => ({ ...p, [id]: !p[id] }));
    if (errors[id]) setErrors((p) => ({ ...p, [id]: undefined }));
  }

  function validate() {
    const next = {};
    for (const q of form) {
      if (q.type === 'checkbox') {
        if (q.required && !checks[q.id]) next[q.id] = 'This option must be checked.';
        continue;
      }
      const v = (values[q.id] ?? '').trim();
      if (q.required && v.length === 0) {
        next[q.id] = 'This question is required.';
        continue;
      }
      if (v.length > 0) {
        if (q.min_length !== undefined && v.length < q.min_length) next[q.id] = `Minimum ${q.min_length} characters.`;
        else if (q.max_length !== undefined && v.length > q.max_length) next[q.id] = `Maximum ${q.max_length} characters.`;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit() {
    if (!validate()) return;
    const answers = form.map((q) => {
      if (q.type === 'checkbox') return { questionId: q.id, bool: Boolean(checks[q.id]) };
      return { questionId: q.id, text: (values[q.id] ?? '').trim() };
    });
    onSubmit(answers);
  }

  if (form.length === 0) {
    return (
      <div className="appeal-panel">
        <div className="appeal-empty">
          <CheckCircle2 size={24} />
          <span>This server has no appeal form configured. You can still submit a request to staff.</span>
        </div>
        <div className="appeal-panel-actions">
          <button className="appeal-btn" onClick={onBack}><ArrowLeft size={15} /> Back</button>
          <button className="appeal-btn appeal-btn-primary" onClick={submit} disabled={busy}>
            Submit appeal {busy ? '…' : ''}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="appeal-panel">
      {form.map((q) => {
        const textValue = (values[q.id] ?? '').trim();
        const count = (values[q.id] ?? '').length;
        return (
          <div className="appeal-field" key={q.id}>
            <label className="appeal-label">
              {q.label}
              {q.required && <span className="appeal-required">*</span>}
            </label>
            {q.help_text && <div className="appeal-help">{q.help_text}</div>}

            {q.type === 'checkbox' ? (
              <label className="appeal-checkbox">
                <input type="checkbox" checked={Boolean(checks[q.id])} onChange={() => toggle(q.id)} />
                <span>{q.label}</span>
              </label>
            ) : q.type === 'long_text' ? (
              <>
                <textarea
                  className="appeal-input appeal-textarea"
                  value={values[q.id] ?? ''}
                  onChange={(e) => setText(q.id, e.target.value)}
                  rows={5}
                  maxLength={q.max_length ?? 2000}
                />
                <div className={'appeal-counter' + (q.max_length !== undefined && count > q.max_length ? ' over' : '')}>
                  {count}{q.max_length !== undefined ? ` / ${q.max_length}` : ''}
                </div>
              </>
            ) : (
              <>
                <input
                  className="appeal-input"
                  type="text"
                  value={values[q.id] ?? ''}
                  onChange={(e) => setText(q.id, e.target.value)}
                  maxLength={q.max_length ?? 500}
                />
                <div className={'appeal-counter' + (q.max_length !== undefined && count > q.max_length ? ' over' : '')}>
                  {count}{q.max_length !== undefined ? ` / ${q.max_length}` : ''}
                </div>
              </>
            )}
            {errors[q.id] && <div className="appeal-form-error">{errors[q.id]}</div>}
          </div>
        );
      })}

      <div className="appeal-panel-actions">
        <button className="appeal-btn" onClick={onBack}><ArrowLeft size={15} /> Back</button>
        <button className="appeal-btn appeal-btn-primary" onClick={submit} disabled={busy}>
          {busy ? 'Submitting…' : 'Submit appeal'} <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
