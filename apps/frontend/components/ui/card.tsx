import * as React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'outline' | 'ghost';
  noPadding?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', noPadding = false, ...props }, ref) => {
    const baseStyles =
      'rounded-xl flex flex-col relative overflow-hidden border border-[color:var(--border)] shadow-[var(--shadow-elev-1)]';

    const variants = {
      default: 'bg-[var(--surface)]',
      interactive: cn(
        'bg-[var(--surface)] border border-transparent', // Initial state
        'transition-all duration-200 ease-in-out',
        'cursor-pointer group',
        'hover:z-20 hover:border-slate-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
      ),
      outline: 'bg-[var(--surface)] border border-[color:var(--border)]',
      ghost: 'bg-transparent border border-transparent shadow-none',
    };

    // Dashboard specific style that was common:
    // border-2 border-dashed border-amber-500 bg-amber-50
    // We can handle specific overrides via className, but the base interactive card
    // in dashboard had: bg-[#F0F0E8] (canvas)

    return (
      <div
        ref={ref}
        className={cn(baseStyles, variants[variant], !noPadding && 'p-5 md:p-6', className)}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('mb-4 border-b border-[color:var(--border)] pb-4', className)}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        'font-sans text-sm font-semibold leading-tight tracking-normal text-[var(--foreground)]',
        className
      )}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-[color:var(--text-muted)]', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('flex-1', className)} {...props} />
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center pt-4 mt-auto', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
