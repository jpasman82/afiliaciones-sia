// ============================================================================
//  app/components/shell/TopBar.tsx — Barra superior (buscador + acción)
// ============================================================================
import type { Rol } from '../../lib/types';
import { Button } from '../ui/Button';
import { SearchInput } from '../ui/Form';
import { Icon } from '../ui/Icon';
import { RoleBadge } from '../ui/Badges';
import { Brand } from './Sidebar';

export function TopBar({ role, search, setSearch, onNueva, onLogout, title }:
  { role: Rol; search: string; setSearch: (s: string) => void; onNueva: () => void; onLogout: () => void; title?: string }) {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
      {/* Mobile */}
      <div className="md:hidden flex items-center justify-between px-4 h-14">
        <Brand />
        <div className="flex items-center gap-2">
          <RoleBadge rol={role} />
          {role === 'afiliador' && (
            <a
              href="/guia.html"
              title="Ver guía"
              aria-label="Ver guía"
              className="h-9 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-100 active:bg-brand-100"
            >
              <Icon name="doc" className="w-4 h-4" strokeWidth={2} />
              Guía
            </a>
          )}
          <button
            type="button"
            onClick={onLogout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="ml-1 w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 active:bg-rose-50 active:text-rose-600"
          >
            <Icon name="logout" className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
      </div>
      {/* Desktop */}
      <div className="hidden md:flex items-center gap-4 px-6 h-16">
        <h2 className="text-sm font-semibold text-slate-400 w-40 shrink-0">{title}</h2>
        <div className="flex-1 max-w-md">
          <SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por DNI, nombre o apellido…" />
        </div>
        <div className="flex-1" />
        <Button icon="plus" onClick={onNueva}>Nueva ficha</Button>
      </div>
    </header>
  );
}
