// ============================================================================
//  app/components/ui/Button.tsx
// ============================================================================
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' | 'success';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:   'bg-brand-700 text-white hover:bg-brand-800 shadow-sm',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
  ghost:     'text-slate-600 hover:bg-slate-100',
  danger:    'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  soft:      'bg-brand-50 text-brand-700 hover:bg-brand-100',
  success:   'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
};
const SIZES: Record<Size, string> = {
  sm: 'text-xs px-2.5 py-1.5',
  md: 'text-sm px-3.5 py-2',
  lg: 'text-sm px-5 py-2.5',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName | string;
}

export function Button({ variant = 'primary', size = 'md', icon, children, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap
        ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {icon && <Icon name={icon} className={size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]'} strokeWidth={2} />}
      {children}
    </button>
  );
}
