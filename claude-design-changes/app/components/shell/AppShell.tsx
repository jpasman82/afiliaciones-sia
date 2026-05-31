// ============================================================================
//  app/components/shell/AppShell.tsx — Layout: Sidebar + TopBar + main + MobileNav
//  Envolvé el contenido de page.tsx con esto.
// ============================================================================
import type { Rol, Usuario } from '../../lib/types';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import type { TabKey } from './nav';

const TITLES: Record<string, string> = {
  registros: 'Registros', nueva: 'Nueva ficha', usuarios: 'Usuarios', control: 'Control',
};

export function AppShell({
  role, userData, tab, onNav, search, setSearch, onNueva, onLogout, children,
}: {
  role: Rol;
  userData: Usuario | null;
  tab: TabKey;
  onNav: (t: TabKey) => void;
  search: string;
  setSearch: (s: string) => void;
  onNueva: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar role={role} current={tab} onNav={onNav} userData={userData} onLogout={onLogout} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar role={role} search={search} setSearch={setSearch} onNueva={onNueva} title={TITLES[tab] || ''} />
        <main className="flex-1 px-4 md:px-8 py-5 md:py-7 pb-28 md:pb-10 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
      <MobileNav role={role} current={tab} onNav={onNav} />
    </div>
  );
}
