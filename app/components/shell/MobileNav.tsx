// ============================================================================
//  app/components/shell/MobileNav.tsx — Navegación inferior (mobile) + FAB
// ============================================================================
import type { Rol } from '../../lib/types';
import { Icon } from '../ui/Icon';
import { navItems, type NavItem, type TabKey } from './nav';

export function MobileNav({ role, current, onNav }:
  { role: Rol; current: TabKey; onNav: (t: TabKey) => void }) {
  const items = navItems(role).filter(i => i.key !== 'nueva');
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-4 h-16 relative">
        {items.slice(0, 2).map(it => <Tab key={it.key} it={it} active={current === it.key} onNav={onNav} />)}
        <div className="flex items-start justify-center">
          <button onClick={() => onNav('nueva')}
            className="-mt-5 w-14 h-14 rounded-full bg-brand-700 text-white shadow-pop flex items-center justify-center active:scale-95 transition ring-4 ring-white">
            <Icon name="plus" className="w-6 h-6" strokeWidth={2.4} />
          </button>
        </div>
        {items.slice(2).map(it => <Tab key={it.key} it={it} active={current === it.key} onNav={onNav} />)}
        {Array.from({ length: Math.max(0, 3 - items.length) }).map((_, i) => <span key={'sp' + i} />)}
      </div>
    </nav>
  );
}

function Tab({ it, active, onNav }: { it: NavItem; active: boolean; onNav: (t: TabKey) => void }) {
  return (
    <button onClick={() => onNav(it.key)} className={`flex flex-col items-center justify-center gap-0.5 ${active ? 'text-brand-700' : 'text-slate-400'}`}>
      <Icon name={it.icon} className="w-[22px] h-[22px]" strokeWidth={active ? 2.2 : 1.8} />
      <span className="text-[10px] font-semibold">{it.label}</span>
    </button>
  );
}
