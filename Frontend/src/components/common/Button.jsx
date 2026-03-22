import React from 'react';

export function Button({ children, variant = 'primary', size, className = '', disabled, type = 'button', ...props }) {
  const classes = ['btn', 'btn-' + variant];
  if (size === 'sm') classes.push('btn-sm');
  if (className) classes.push(className);
  return (
    <button type={type} className={classes.join(' ')} disabled={disabled} {...props}>
      {children}
    </button>
  );
}
