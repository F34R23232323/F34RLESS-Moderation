import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';

function normalizeOptions(options) {
  return (options || [])
    .map((o) => {
      if (o == null) return null;
      if (typeof o === 'string' || typeof o === 'number') return { value: o, label: String(o), group: '' };
      return { value: o.value, label: o.label ?? String(o.value), group: o.group || '', desc: o.desc, icon: o.icon };
    })
    .filter(Boolean);
}

const SEARCH_THRESHOLD = 6;
const MAX_CHIPS = 2;

export default function Dropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  multiple = false,
  searchable = true,
  clearable = false,
  className = '',
  disabled = false,
  emptyText = 'No options',
  maxHeight = 320,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const menuRef = useRef(null);

  const items = useMemo(() => normalizeOptions(options), [options]);
  const selArr = multiple ? (Array.isArray(value) ? value : []) : null;
  const isSelected = (v) => (multiple ? selArr.some((x) => String(x) === String(v)) : String(v) === String(value));

  const selectedItem = multiple
    ? null
    : items.find((o) => String(o.value) === String(value)) || null;
  const selectedItems = multiple ? items.filter((o) => selArr.some((x) => String(x) === String(o.value))) : [];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = [];
    const pushGroup = (g, last) => {
      if (g && g !== last) rows.push({ kind: 'group', label: g });
      return g;
    };
    if (!q) {
      let last = '';
      for (const o of items) {
        last = pushGroup(o.group, last);
        rows.push({ kind: 'option', ...o });
      }
      return rows;
    }
    let last = '';
    for (const o of items) {
      if (!(o.label + ' ' + (o.desc || '')).toLowerCase().includes(q)) continue;
      last = pushGroup(o.group, last);
      rows.push({ kind: 'option', ...o });
    }
    return rows;
  }, [items, query]);

  const optionRows = useMemo(() => visible.filter((r) => r.kind === 'option'), [visible]);
  const showSearch = searchable !== false && items.length > SEARCH_THRESHOLD;
  const hasValue = multiple ? selArr.length > 0 : Boolean(selectedItem);

  const close = () => {
    setOpen(false);
    setPos(null);
    setQuery('');
  };

  const select = (row) => {
    if (multiple) {
      const next = isSelected(row.value)
        ? selArr.filter((x) => String(x) !== String(row.value))
        : [...selArr, row.value];
      onChange(next);
      return;
    }
    onChange(row.value);
    close();
  };

  const removeValue = (v) => {
    onChange(selArr.filter((x) => String(x) !== String(v)));
  };

  const clearAll = () => {
    onChange(multiple ? [] : '');
    close();
  };

  function openMenu() {
    if (disabled) return;
    const el = triggerRef.current;
    const r = el.getBoundingClientRect();
    const estH = Math.min(maxHeight + 64, optionRows.length * 30 + 64);
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const up = spaceBelow < estH && spaceAbove > spaceBelow;
    setPos({
      left: r.left,
      width: Math.max(r.width, 240),
      top: up ? undefined : r.bottom + 6,
      bottom: up ? window.innerHeight - (r.top - 8) : undefined,
    });
    setQuery('');
    setActive(0);
    setOpen(true);
  }

  useEffect(() => {
    if (open && searchRef.current) {
      const t = setTimeout(() => searchRef.current.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (open && optionRows.length > 0 && active >= optionRows.length) {
      setActive(optionRows.length - 1);
    }
  }, [optionRows.length, active, open]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      const inTrigger = triggerRef.current && triggerRef.current.contains(e.target);
      const inMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!inTrigger && !inMenu) close();
    }
    function onScroll() { close(); }
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  useEffect(() => {
    if (open && menuRef.current) {
      const el = menuRef.current.querySelector('[data-active="true"]');
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [active, open]);

  function onMenuKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (optionRows.length) setActive((a) => (a + 1) % optionRows.length); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (optionRows.length) setActive((a) => (a - 1 + optionRows.length) % optionRows.length); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const row = optionRows[active];
      if (row) select(row);
    }
  }

  function onTriggerKeyDown(e) {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) openMenu();
    }
  }

  let optIndex = 0;

  return (
    <div className={`dropdown ${className}`}>
      <button
        type="button"
        ref={triggerRef}
        className={`dropdown-trigger ${open ? 'open' : ''} ${hasValue ? 'has-value' : ''}`}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-multiselectable={multiple || undefined}
      >
        {multiple ? (
          <span className="dropdown-value dropdown-chips">
            {selectedItems.length === 0 && <span className="dropdown-placeholder">{placeholder}</span>}
            {selectedItems.slice(0, MAX_CHIPS).map((o) => (
              <span key={String(o.value)} className="dropdown-chip">
                {o.label}
                {!disabled && (
                  <span
                    className="dropdown-chip-x"
                    role="button"
                    tabIndex={-1}
                    title={`Remove ${o.label}`}
                    onClick={(e) => { e.stopPropagation(); removeValue(o.value); }}
                  >
                    <X size={11} />
                  </span>
                )}
              </span>
            ))}
            {selectedItems.length > MAX_CHIPS && (
              <span className="dropdown-more">+{selectedItems.length - MAX_CHIPS} more</span>
            )}
          </span>
        ) : (
          <span className="dropdown-value">{selectedItem ? selectedItem.label : placeholder}</span>
        )}
        {clearable && hasValue && !disabled && (
          <span
            className="dropdown-clear"
            role="button"
            tabIndex={-1}
            title="Clear"
            onClick={(e) => { e.stopPropagation(); clearAll(); }}
          >
            <X size={13} />
          </span>
        )}
        <ChevronDown size={15} className={`dropdown-chevron ${open ? 'open' : ''}`} />
      </button>

      {open && createPortal(
        <div
          className={`dropdown-menu ${pos?.up ? 'up' : 'down'}`}
          style={pos ? { left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom } : undefined}
          ref={menuRef}
          role="listbox"
          aria-multiselectable={multiple || undefined}
        >
          {showSearch && (
            <div className="dropdown-search">
              <Search size={13} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                placeholder="Search…"
                onKeyDown={onMenuKeyDown}
              />
            </div>
          )}
          <div className="dropdown-list" style={{ maxHeight }}>
            {visible.map((row) => {
              if (row.kind === 'group') {
                return <div key={`g:${row.label}`} className="dropdown-group">{row.label}</div>;
              }
              const index = optIndex++;
              const isActive = index === active;
              const rowSelected = isSelected(row.value);
              return (
                <button
                  key={`o:${index}`}
                  type="button"
                  role="option"
                  aria-selected={rowSelected}
                  data-active={isActive || undefined}
                  className={`dropdown-option ${isActive ? 'active' : ''} ${rowSelected ? 'selected' : ''}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => select(row)}
                >
                  <span className="dropdown-option-label">
                    {row.icon && <row.icon size={13} />}
                    <span className="dd-label">{row.label}</span>
                  </span>
                  {rowSelected && <Check size={14} className="dropdown-check" />}
                </button>
              );
            })}
            {visible.length === 0 && <div className="dropdown-empty">{emptyText}</div>}
          </div>
          {multiple && (
            <div className="dropdown-foot">
              <button type="button" className="dropdown-done" onClick={close}>
                Done{selArr.length > 0 ? ` (${selArr.length} selected)` : ''}
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
