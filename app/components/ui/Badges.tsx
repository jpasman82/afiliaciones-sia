// ============================================================================
//  app/components/ui/Badges.tsx — StatusBadge, RoleBadge, FileChip
// ============================================================================
import { ESTADOS, ROLES } from '../../lib/estados';
import type { Rol } from '../../lib/types';
import { Icon } from './Icon';

export function StatusBadge({ estado, size = 'md' }: { estado?: string; size?: 'sm' | 'md' }) {
  const cfg = ESTADOS[estado || 'pendiente'] || ESTADOS.pendiente;
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset ${cfg.cls} ${pad}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export function RoleBadge({ rol }: { rol: Rol }) {
  const cfg = ROLES[rol] || ROLES.pendiente;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export function FileChip({ ok, label }: { ok?: boolean | string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset
      ${ok ? 'bg-emerald-50 text-emerald-600 ring-emerald-200' : 'bg-slate-50 text-slate-400 ring-slate-200'}`}>
      <Icon name={ok ? 'check' : 'x'} className="w-3 h-3" strokeWidth={2.5} />
      {label}
    </span>
  );
}
