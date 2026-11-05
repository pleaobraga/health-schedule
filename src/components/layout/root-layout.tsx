import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'

import { useCloudSync } from '../../hooks/use-cloud-sync'
import { hasExistingLocalData } from '../../services/backup-service'
import { StorageService } from '../../services/storage-service'
import { useScheduleStore } from '../../store/use-schedule-store'
import { ErrorBoundary } from '../common/error-boundary'
import { ToastViewport } from '../common/toast-viewport'
import { DayEventsModal } from '../modals/day-events-modal'
import { FullScreenCalendarModal } from '../modals/fullscreen-calendar-modal'
import { UnsavedChangesModal } from '../modals/unsaved-changes-modal'
import { HoverSidebar } from '../navigation/hover-sidebar'

export function RootLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const setCurrentView = useScheduleStore((state) => state.setCurrentView)

  // Mount admin-conditional cloud sync
  useCloudSync()

  // Sync store's currentView with route changes
  useEffect(() => {
    const path = location.pathname
    if (path === '/' || path === '/calendario') {
      setCurrentView('calendar')
    } else if (path.startsWith('/compras')) {
      setCurrentView('purchases')
    } else if (path.startsWith('/medicamentos')) {
      setCurrentView('medications')
    } else if (path.startsWith('/pessoas')) {
      setCurrentView('people')
    } else if (path.startsWith('/turnos')) {
      setCurrentView('shifts')
    } else if (path.startsWith('/regras')) {
      setCurrentView('rules')
    } else if (path.startsWith('/importar')) {
      setCurrentView('import')
    } else if (path.startsWith('/enderecos')) {
      setCurrentView('addresses')
    } else if (path.startsWith('/configuracoes')) {
      if (location.search.includes('tab=importar') || location.search.includes('tab=import')) {
        setCurrentView('import')
      } else {
        setCurrentView('settings')
      }
    } else if (path.startsWith('/usuarios')) {
      setCurrentView('users')
    }
  }, [location.pathname, location.search, setCurrentView])

  // Onboarding redirection check for empty storage on initial root route
  useEffect(() => {
    const isRootOrCalendar =
      location.pathname === '/' || location.pathname === '/calendario'

    const hasChecked = StorageService.hasCheckedOnboarding()

    if (!isRootOrCalendar) {
      if (!hasChecked) {
        StorageService.setCheckedOnboarding(true)
      }
      return
    }

    if (hasChecked) {
      return
    }

    StorageService.setCheckedOnboarding(true)

    let isMounted = true
    hasExistingLocalData().then((hasData) => {
      if (isMounted && !hasData) {
        navigate('/configuracoes?tab=importar', { replace: true })
      }
    })
    return () => {
      isMounted = false
    }
  }, [location.pathname, navigate])

  return (
    <div
      data-testid="root-layout"
      className="min-h-screen lg:h-screen w-screen overflow-x-hidden lg:overflow-hidden bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row font-sans transition-colors pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-16"
    >
      {/* 1. Global Navigation: Hover Sidebar (Desktop fixed left / Mobile top header + fullscreen menu) */}
      <HoverSidebar />

      {/* 2. Main Content Area: Renders the active route through Outlet */}
      <div className="flex-1 min-h-screen lg:h-full overflow-y-auto lg:overflow-hidden flex flex-col min-w-0 custom-scrollbar">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>

      {/* 3. Global Modals */}
      <DayEventsModal />
      <FullScreenCalendarModal />
      <UnsavedChangesModal />

      {/* 4. Global Notifications */}
      <ToastViewport />
    </div>
  )
}

