'use client';

import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type ProgressProps = HTMLAttributes<HTMLDivElement> & {
  value?: number;
  indicatorClassName?: string;
};

export function Progress({
  value = 0,
  className = '',
  indicatorClassName,
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
        className={cn('h-full bg-primary transition-all duration-300 ease-out', indicatorClassName)}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}