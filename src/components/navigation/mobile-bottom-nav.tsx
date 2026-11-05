import { Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, useInRouterContext } from 'react-router-dom'

import type { NavigationTab } from '../../types'
import type { ComponentType } from 'react'

export interface MobileBottomNavItem {
  id: NavigationTab
  path: string
  label: string
  icon: ComponentType<{ className?: string }>
  end?: boolean
}

export interface MobileBottomNavProps {
  items: MobileBottomNavItem[]
  currentView: NavigationTab
  isMenuOpen?: boolean
  syncStatus?: 'cloud' | 'local' | null
  onNavigate: (id: NavigationTab) => void
  onOpenMenu: () => void
}

const itemBaseClass =
  'relative flex flex-col items-center justify-center gap-1 h-full min-w-0 text-[10px] leading-none transition-colors'

function getItemClass(isActive: boolean) {
  return `${itemBaseClass} ${
    isActive
      ? 'text-indigo-700 dark:text-indigo-300 font-bold'
      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
  }`
}

function getIconPillClass(isActive: boolean) {
  return `flex items-center justify-center w-14 h-7 rounded-full transition-colors ${
    isActive ? 'bg-indigo-100 dark:bg-indigo-950/80' : 'bg-transparent'
  }`
}

export function MobileBottomNav({
  items,
  currentView,
  isMenuOpen = false,
  syncStatus = null,
  onNavigate,
  onOpenMenu,
}: MobileBottomNavProps) {
  const { t } = useTranslation(['common'])
  const inRouter = useInRouterContext()

  return (
    <nav
      data-testid="mobile-bottom-nav"
      aria-label={t('common:appName')}
      className="grid md:hidden fixed bottom-0 inset-x-0 z-40 grid-cols-4 h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-2px_12px_rgba(15,23,42,0.06)] select-none print:hidden transition-colors"
    >
      {items.map((item) => {
        const Icon = item.icon
        const content = (isActive: boolean) => (
          <>
            <span className={getIconPillClass(isActive)}>
              <Icon className="w-5 h-5" />
            </span>
            <span className="truncate max-w-full px-1">{item.label}</span>
          </>
        )

        if (inRouter) {
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.end}
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              className={({ isActive }) => getItemClass(isActive)}
            >
              {({ isActive }) => content(isActive)}
            </NavLink>
          )
        }

        const isActive = currentView === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            className={getItemClass(isActive)}
          >
            {content(isActive)}
          </button>
        )
      })}

      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={t('common:actions.openMenu')}
        aria-expanded={isMenuOpen}
        data-testid="mobile-bottom-nav-more"
        className={getItemClass(isMenuOpen)}
      >
        <span className={`relative ${getIconPillClass(isMenuOpen)}`}>
          <Menu className="w-5 h-5" />
          {syncStatus && (
            <span
              data-testid="mobile-bottom-nav-sync-dot"
              className={`absolute top-0.5 right-3.5 w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                syncStatus === 'cloud' ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
          )}
        </span>
        <span className="truncate max-w-full px-1">{t('common:navShort.more')}</span>
      </button>
    </nav>
  )
}
