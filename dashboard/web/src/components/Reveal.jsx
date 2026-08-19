import React from 'react';

// Wraps children so they stagger-reveal as the page enters.
// Usage: <Reveal>...</Reveal> or <Reveal as="div" delay={i * 60}>...</Reveal>
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', style, children, ...rest }) {
  return (
    <Tag
      className={`reveal ${className}`}
      style={{ ...style, animationDelay: `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
