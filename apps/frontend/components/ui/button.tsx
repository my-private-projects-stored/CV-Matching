import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Enterprise Button Component
 *
 * Design Principles:
 * - Rounded, confident shapes
 * - Soft elevation with clear focus
 * - Semantic color variants for action clarity
 */

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual variant determining color and purpose:
   * - `default`: Hyper Blue (#1D4ED8) - Primary actions (save, submit, create)
   * - `destructive`: Alert Red (#DC2626) - Destructive actions (delete, remove)
   * - `success`: Signal Green (#15803D) - Positive actions (download, confirm, complete)
   * - `warning`: Alert Orange (#F97316) - Caution actions (reset, clear, undo)
   * - `outline`: Transparent + black border - Secondary actions (cancel, back)
   * - `secondary`: Panel Grey (#E5E5E0) - Tertiary actions
   * - `ghost`: No background - Subtle actions (icon buttons, navigation)
   * - `link`: Text only with underline - Inline links
   */
  variant?:
    | 'default'
    | 'destructive'
    | 'success'
    | 'warning'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link';
  /**
   * Button size:
   * - `default`: Standard button (h-10)
   * - `sm`: Small button (h-8)
   * - `lg`: Large button (h-12)
   * - `icon`: Square icon button (h-9 w-9)
   */
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    // Base styles applied to ALL buttons
    const baseStyles = cn(
      // Layout & Typography
      'inline-flex items-center justify-center gap-2',
      'whitespace-nowrap text-sm font-semibold',
      // Transitions
      'transition-all duration-200 ease-out',
      // Focus state - sharp blue ring (not soft glow)
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] focus-visible:ring-offset-2',
      // Disabled state
      'disabled:pointer-events-none disabled:opacity-50',
      // SVG icon sizing
      "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
      // Design system radius
      'rounded-[7px] active:scale-[0.98]'
    );

    // Variant styles - each has distinct purpose and color
    const variants = {
      // PRIMARY - Hyper Blue (#1D4ED8 / blue-700)
      // Use for: Save, Submit, Create, Primary CTA
      default: cn(
        'bg-[color:var(--primary)] text-white',
        'shadow-[0_1px_3px_rgba(29,78,216,0.20)]',
        'relative overflow-hidden before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(135deg,rgba(255,255,255,0.10),transparent_55%)]',
        'hover:bg-[var(--blue-800)] hover:shadow-[0_4px_18px_rgba(29,78,216,0.32)]'
      ),

      // DESTRUCTIVE - Alert Red (#DC2626 / red-600)
      // Use for: Delete, Remove, Destroy, Dangerous actions
      destructive: cn(
        'bg-[color:var(--danger)] text-white',
        'shadow-[0_1px_3px_rgba(220,38,38,0.20)]',
        'hover:bg-red-700'
      ),

      // SUCCESS - Signal Green (#15803D / green-700)
      // Use for: Download, Confirm, Complete, Positive actions
      success: cn(
        'bg-[color:var(--success)] text-white',
        'shadow-[0_1px_3px_rgba(22,163,74,0.20)]',
        'hover:bg-green-700'
      ),

      // WARNING - Alert Orange (#F97316 / orange-500)
      // Use for: Reset, Clear, Undo, Caution actions
      warning: cn(
        'bg-[color:var(--warning)] text-white',
        'shadow-[0_1px_3px_rgba(217,119,6,0.20)]',
        'hover:bg-amber-700'
      ),

      // OUTLINE - Canvas background with black border
      // Use for: Cancel, Back, Secondary actions, Navigation
      outline: cn(
        'bg-white text-[var(--foreground)]',
        'border-[1.5px] border-[color:var(--border)]',
        'shadow-none',
        'hover:border-slate-400 hover:bg-white'
      ),

      // SECONDARY - Panel Grey (#E5E5E0)
      // Use for: Less prominent actions, Toolbar buttons
      secondary: cn(
        'bg-[color:var(--secondary)] text-[var(--foreground)]',
        'shadow-none',
        'hover:bg-slate-200'
      ),

      // GHOST - No background, minimal styling
      // Use for: Icon buttons, Subtle navigation, Toolbars
      ghost: cn(
        'bg-transparent text-[var(--foreground)]',
        'border-none shadow-none',
        'hover:bg-[color:var(--surface-muted)]'
      ),

      // LINK - Text only with underline
      // Use for: Inline links, Text navigation
      link: cn(
        'bg-transparent text-[color:var(--primary)]',
        'border-none shadow-none',
        'underline-offset-4 hover:underline',
        'p-0 h-auto'
      ),
    };

    // Size styles
    const sizes = {
      default: 'h-10 px-6',
      sm: 'h-8 px-3 text-[13px]',
      lg: 'h-12 px-6 text-[15px]',
      icon: 'h-9 w-9 p-0',
    };

    const variantClass = variants[variant];
    const sizeClass = sizes[size];

    return (
      <button ref={ref} className={cn(baseStyles, variantClass, sizeClass, className)} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button };
