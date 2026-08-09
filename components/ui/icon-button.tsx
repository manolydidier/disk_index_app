'use client';

import * as React from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface IconButtonProps extends Omit<ButtonProps, 'size'> {
  label: string;
  showTooltip?: boolean;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, showTooltip = true, className, variant = 'ghost', children, ...props }, ref) => {
    const button = (
      <Button
        ref={ref}
        variant={variant}
        size="icon"
        aria-label={label}
        className={cn('h-9 w-9 rounded-full [&_svg]:h-4 [&_svg]:w-4', className)}
        {...props}
      >
        {children}
      </Button>
    );

    if (!showTooltip) return button;

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  }
);
IconButton.displayName = 'IconButton';

export { IconButton };
