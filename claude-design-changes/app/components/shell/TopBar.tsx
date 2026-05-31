// ============================================================================
//  app/components/shell/TopBar.tsx — Barra superior (buscador + acción)
// ============================================================================
import type { Rol } from '../../lib/types';
import { Button } from '../ui/Button';
import { SearchInput } from '../ui/Form';
import { RoleBadge } from '../ui/Badges';
import { Brand } from './Sidebar';

export function TopBar({ role, search, setSearch, onNueva, title }:
  { role: Rol; search: string; setSearch: (s: string) => void; onNueva: () => void; title?: string }) {
  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
      {/* Mobile */}
      <div className="md:hidden flex items-center justify-between px-4 h-14">
        <Brand />
        <RoleBadge rol={role} />
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
