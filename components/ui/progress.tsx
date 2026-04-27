'use client';

import type { HTMLAttributes } from 'react';

type ProgressProps = HTMLAttributes<HTMLDivElement> & {
  value?: number;
};

export function Progress({
  value = 0,
  className = '',
  ...props
}: ProgressProps) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
      className={`h-2 w-full overflow-hidden rounded-full bg-muted ${className}`}
      {...props}
    >
      <div
        className="h-full bg-primary transition-all duration-300 ease-out"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}