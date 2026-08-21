import React from 'react';
import { Check } from 'lucide-react';

// 1) Select Case → 2) Fill Form → 3) Submitted → 4) Under Review → 5) Decided
const STEPS = ['Select Case', 'Fill Form', 'Submitted', 'Under Review', 'Decided'];

export default function StepProgress({ current }) {
  // current is 1-based active step.
  const active = Math.max(1, Math.min(5, current));
  return (
    <div className="appeal-steps" role="list" aria-label="Appeal progress">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < active;
        const isActive = step === active;
        return (
          <div key={label} className={'appeal-step' + (done ? ' done' : '') + (isActive ? ' active' : '')} role="listitem">
            <div className="appeal-step-dot">
              {done ? <Check size={13} /> : <span>{step}</span>}
            </div>
            <div className="appeal-step-label">{label}</div>
          </div>
        );
      })}
    </div>
  );
}
