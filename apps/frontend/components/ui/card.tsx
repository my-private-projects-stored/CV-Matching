import * as React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'outline' | 'ghost';
  noPadding?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', noPadding = false, ...props }, ref) => {
    const baseStyles = 'rounded-2xl flex flex-col relative overflow-hidden border border-[color:var(--border)]';

    const variants = {
      default: 'bg-[var(--surface)]',
      interactive: cn(
        'bg-[var(--surface)] border border-transparent', // Initial state
        'transition-all duration-200 ease-in-out',
        'cursor-pointer group',
        'hover:z-20 hover:border-[color:var(--border)] hover:shadow-[0_18px_34px_rgba(15,27,45,0.18)] hover:-translate-y-1'
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
        className={cn(baseStyles, variants[variant], !noPadding && 'p-6 md:p-8', className)}
        {...props}
      />
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 mb-4', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-[var(--font-display)] text-2xl font-semibold leading-tight tracking-tight', className)}
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
