// ============================================================================
//  app/components/ui/Primitives.tsx — Avatar, Card, StatCard, PageHeader, EmptyState
// ============================================================================
import { Icon, type IconName } from './Icon';

export function Avatar({ nombre = '', apellido = '', size = 'md' }:
  { nombre?: string; apellido?: string; size?: 'sm' | 'md' | 'lg' }) {
  const ini = `${nombre[0] || ''}${apellido[0] || ''}`.toUpperCase() || '–';
  const sz = size === 'sm' ? 'w-7 h-7 text-[11px]' : size === 'lg' ? 'w-11 h-11 text-base' : 'w-9 h-9 text-xs';
  return <span className={`inline-flex items-center justify-center rounded-full bg-brand-100 text-brand-700 font-bold shrink-0 ${sz}`}>{ini}</span>;
}

export function Card({ children, className = '', ...rest }:
  React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`bg-white rounded-xl ring-1 ring-slate-200 shadow-card ${className}`} {...rest}>{children}</div>;
}

export function StatCard({ label, value, active, accent, onClick }:
  { label: string; value: number | string; active?: boolean; accent?: string | null; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className={`text-left rounded-xl px-3.5 py-3 ring-1 transition focus:outline-none
        ${active ? 'bg-brand-700 ring-brand-700 text-white shadow-sm' : 'bg-white ring-slate-200 hover:ring-slate-300 hover:bg-slate-50'}`}>
      <div className={`tnum text-2xl font-bold leading-none ${active ? 'text-white' : 'text-slate-900'}`}>{value}</div>
      <div className="flex items-center gap-1.5 mt-1.5">
        {accent && !active && <span className={`w-1.5 h-1.5 rounded-full ${accent}`} />}
        <span className={`text-[11px] font-semibold uppercase tracking-wide ${active ? 'text-brand-100' : 'text-slate-500'}`}>{label}</span>
      </div>
    </button>
  );
}

export function PageHeader({ title, sub, actions }:
  { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
        {sub && <p className="text-sm text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, sub, action }:
  { icon?: IconName | string; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
        <Icon name={icon} className="w-7 h-7" />
      </div>
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      {sub && <p className="text-sm text-slate-400 mt-1 max-w-xs">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
