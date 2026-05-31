// ============================================================================
//  app/components/shell/Sidebar.tsx — Navegación lateral (desktop)
// ============================================================================
import Image from 'next/image';
import type { Rol, Usuario } from '../../lib/types';
import { Icon } from '../ui/Icon';
import { RoleBadge } from '../ui/Badges';
import { Avatar } from '../ui/Primitives';
import { navItems, type TabKey } from './nav';

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Image src="/logo.png" alt="SIA" width={36} height={36} className="w-9 h-9 object-contain shrink-0" />
      {!compact && (
        <div className="leading-tight">
          <div className="font-bold text-[15px] text-slate-900">Afiliaciones</div>
          <div className="text-[10px] font-semibold tracking-[0.18em] text-brand-700">SIA</div>
        </div>
      )}
    </div>
  );
}

export function Sidebar({ role, current, onNav, userData, onLogout }:
  { role: Rol; current: TabKey; onNav: (t: TabKey) => void; userData: Usuario | null; onLogout: () => void }) {
  const items = navItems(role);
  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-white border-r border-slate-200 h-screen sticky top-0">
      <div className="px-5 h-16 flex items-center border-b border-slate-100"><Brand /></div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Menú</div>
        {items.map(it => {
          const active = current === it.key;
          return (
            <button key={it.key} onClick={() => onNav(it.key)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition
                ${active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
              <Icon name={it.icon} className="w-5 h-5" strokeWidth={active ? 2.1 : 1.8} />
              {it.label}
              {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-600" />}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar nombre={userData?.nombre} apellido={userData?.apellido} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-800 truncate">{userData?.nombre} {userData?.apellido}</div>
            <div className="mt-0.5"><RoleBadge rol={role} /></div>
          </div>
          <button onClick={onLogout} title="Salir" className="text-slate-400 hover:text-rose-600 p-1.5 rounded-md hover:bg-rose-50 transition">
            <Icon name="logout" className="w-[18px] h-[18px]" strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}
