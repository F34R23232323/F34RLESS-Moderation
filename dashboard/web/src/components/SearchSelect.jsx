import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

export default function SearchSelect({ value, onChange, options = [], placeholder = 'Select…', searchable = true, className = '' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const groups = useMemo(() => {
    const out = [];
    for (const o of options) {
      if (o && Array.isArray(o.options)) out.push({ label: o.label, options: o.options });
      else out.push({ label: null, options: [o] });
    }
    return out.filter((g) => g.options.length > 0);
  }, [options]);

  const q = query.trim().toLowerCase();
  const searchText = (o) => String(o.keywords ?? (typeof o.label === 'string' ? o.label : o.value) ?? '');
  const filtered = useMemo(() => {
    const out = [];
    for (const g of groups) {
      const opts = g.options.filter((o) => !q || searchText(o).toLowerCase().includes(q));
      if (opts.length) out.push({ label: g.label, options: opts });
    }
    return out;
  }, [groups, q]);

  const flat = useMemo(() => filtered.flatMap((g) => g.options), [filtered]);
  const selected = useMemo(
    () => groups.flatMap((g) => g.options).find((o) => o.value === value) ?? null,
    [groups, value],
  );

  useEffect(() => { setActive(0); }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); return; }
      if (e.key === 'Enter' && flat[active]) { onChange(flat[active].value); setOpen(false); setQuery(''); return; }
      if (e.key === 'Tab') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open, flat, active, onChange]);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (next) setTimeout(() => inputRef.current?.focus(), 10);
      return next;
    });
  };

  return (
    <div className={`search-select ${className}`} ref={rootRef}>
      <button type="button" className={`search-select-trigger ${open ? 'open' : ''}`} onClick={toggle}>
        <span className="search-select-value">{selected ? selected.label : <span className="search-select-placeholder">{placeholder}</span>}</span>
        <ChevronDown size={14} className={`search-select-chevron ${open ? 'up' : ''}`} />
      </button>
      {open && (
        <div className="search-select-menu">
          {searchable && (
            <div className="search-select-search">
              <Search size={13} />
              <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" />
            </div>
          )}
          <div className="search-select-list">
            {flat.length === 0 && <div className="search-select-empty">No matches</div>}
            {filtered.map((g, gi) => (
              <div key={gi} className="search-select-group">
                {g.label && <div className="search-select-cat">{g.label}</div>}
                {g.options.map((o) => {
                  const idx = flat.indexOf(o);
                  const isSel = o.value === value;
                  return (
                    <button
                      type="button"
                      key={o.value}
                      className={`search-select-item ${idx === active ? 'active' : ''} ${isSel ? 'selected' : ''}`}
                      onMouseEnter={() => setActive(idx)}
                      onMouseDown={(e) => { e.preventDefault(); onChange(o.value); setOpen(false); setQuery(''); }}
                    >
                      <span className="search-select-item-label">{o.label}</span>
                      {isSel && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}