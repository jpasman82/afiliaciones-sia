// ============================================================================
//  app/components/shell/nav.ts — Items de navegación según rol
// ============================================================================
import type { Rol } from '../../lib/types';
import type { IconName } from '../ui/Icon';

export type TabKey = 'registros' | 'nueva' | 'usuarios' | 'control' | 'detalle' | 'editar';

export interface NavItem { key: TabKey; label: string; icon: IconName | string; }

export function navItems(role: Rol): NavItem[] {
  const items: NavItem[] = [
    { key: 'registros', label: 'Registros', icon: 'list' },
    { key: 'nueva', label: 'Nueva ficha', icon: 'plus' },
  ];
  if (role === 'admin' || role === 'supervisor') items.push({ key: 'usuarios', label: 'Usuarios', icon: 'users' });
  if (role === 'admin') items.push({ key: 'control', label: 'Control', icon: 'shield' });
  return items;
}
