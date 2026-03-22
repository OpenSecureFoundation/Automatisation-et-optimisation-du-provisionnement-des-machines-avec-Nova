import React from 'react';
import './Skeleton.css';

export default function Skeleton({ 
  variant = 'text', 
  width, 
  height, 
  className = '',
  count = 1 
}) {
  const baseClass = `skeleton skeleton-${variant}`;
  const style = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  if (count > 1) {
    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={`${baseClass} ${className}`} style={style} />
        ))}
      </>
    );
  }

  return <div className={`${baseClass} ${className}`} style={style} />;
}
