import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import {
  UserCog,
  ShieldCheck,
  UserPlus,
  RefreshCw,
  Search,
  User as UserIcon,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CreateUserModal } from '../components/users/create-user-modal'
import { requireDb } from '../services/firebase'

import type { UserRole } from '../context/auth-context'

export interface AppUserRecord {
  uid: string
  name: string
  email: string
  role: UserRole
  createdAt?: unknown
}

export function UserManagementView() {
  const { t } = useTranslation(['users', 'common'])
  const [users, setUsers] = useState<AppUserRecord[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorFeedback(null)
      const usersRef = collection(requireDb(), 'users')
      const q = query(usersRef, orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)

      const loadedUsers: AppUserRecord[] = []
      snapshot.forEach((docSnap) => {
        const data = docSnap.data()
        loadedUsers.push({
          uid: docSnap.id,
          name: data.name || 'Sem Nome',
          email: data.email || '',
          role: data.role || 'user',
          createdAt: data.createdAt,
        })
      })

      setUsers(loadedUsers)
    } catch (err) {
      console.error('Error fetching users from Firestore:', err)
      setErrorFeedback(
        t('users:errors.fetchFailed'),
      )
    } finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase()
    return (
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term)
    )
  })

  return (
    <div
      data-testid="user-management-view"
      className="flex-1 h-full overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col gap-6 max-w-[1500px] w-full mx-auto custom-scrollbar"
    >
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
            <UserCog className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('users:title')}
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {t('users:subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchUsers}
            disabled={isLoading}
            title={t('users:reloadList')}
            aria-label={t('users:reloadList')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 shadow-xs transition disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? t('common:actions.saving') : t('users:reloadList')}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-xs transition-all shrink-0"
          >
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
            <span>{t('users:newUser')}</span>
          </button>
        </div>
      </div>

      {/* Error notification */}
      {errorFeedback && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-200 text-xs">
          {errorFeedback}
        </div>
      )}

      {/* Search and Stats */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('users:searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs md:text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs transition"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 self-end sm:self-center">
          <span className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
            {users.length === 1
              ? t('users:userCount', { count: users.length })
              : t('users:userCountPlural', { count: users.length })}
          </span>
        </div>
      </div>

      {/* User Cards / List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 space-y-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('users:loading')}
          </p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
          <UserIcon className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm md:text-base font-bold text-slate-700 dark:text-slate-300">
            {searchTerm
              ? t('users:emptySearchTitle')
              : t('users:emptyTitle')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? t('users:emptySearchSubtitle')
              : t('users:emptySubtitle')}
          </p>
          {!searchTerm && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t('users:newUser')}</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((appUser) => {
            const isAdmin = appUser.role === 'admin'

            return (
              <div
                key={appUser.uid}
                data-testid={`user-card-${appUser.uid}`}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex items-start justify-between gap-4 transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                      isAdmin
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80'
                        : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/80'
                    }`}
                  >
                    {isAdmin ? (
                      <ShieldCheck className="w-5 h-5" />
                    ) : (
                      <UserIcon className="w-5 h-5" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {appUser.name}
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {appUser.email}
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 ${
                    isAdmin
                      ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {isAdmin ? t('users:roles.admin') : t('users:roles.user')}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <CreateUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUserCreated={fetchUsers}
      />
    </div>
  )
}
