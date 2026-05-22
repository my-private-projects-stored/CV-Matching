import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Enterprise Input Component
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-[42px] w-full rounded-[7px] border-[1.5px] border-[color:var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)]',
          'shadow-sm placeholder:text-[color:var(--text-subtle)]',
          'focus-visible:border-[var(--blue-600)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-600/10',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
