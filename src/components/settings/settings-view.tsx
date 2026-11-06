import {
  Calendar,
  Check,
  Clock,
  Cloud,
  CloudOff,
  Download,
  Globe,
  HardDrive,
  Info,
  MapPin,
  Moon,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { use, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { ConfirmClearLocalDataModal } from './confirm-clear-local-data-modal'
import { EnableCloudSyncModal } from './enable-cloud-sync-modal'
import { AuthContext } from '../../context/auth-context'
import { exportAppData } from '../../services/backup-service'
import { CloudSyncService } from '../../services/cloud-sync-service'
import { useScheduleStore } from '../../store/use-schedule-store'
import { showErrorToast, showSuccessToast } from '../../store/use-toast-store'
import { notifyPullResult, notifyPushResult } from '../../utils/cloud-feedback'
import { LanguageSelector } from '../common/language-selector'
import { ImportView } from '../import/import-view'

import type { EnableCloudSyncChoice } from './enable-cloud-sync-modal'

export function SettingsView() {
  const { t } = useTranslation(['settings', 'common'])
  const {
    isDarkMode,
    toggleDarkMode,
    persons,
    assignments,
    events,
    shiftDefinitions,
    addresses,
    pullCloudData,
    forcePushCloudData,
    clearAllLocalData,
  } = useScheduleStore()
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)
  const [isClearingLocalData, setIsClearingLocalData] = useState(false)
  const [clearFeedback, setClearFeedback] = useState<string | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab =
    tabParam === 'importar' || tabParam === 'import' ? 'import' : 'general'

  const handleTabChange = (tab: 'general' | 'import') => {
    if (tab === 'import') {
      setSearchParams({ tab: 'importar' })
    } else {
      setSearchParams({})
    }
  }

  const auth = use(AuthContext)
  // Show admin cloud sync controls if authenticated as admin (or in isolated test/dev)
  const isAdmin = auth ? auth.isAdmin : true

  const [syncEnabled, setSyncEnabled] = useState<boolean>(() =>
    CloudSyncService.isSyncEnabled(),
  )
  const [isEnableSyncModalOpen, setIsEnableSyncModalOpen] = useState(false)
  const [pendingSyncChoice, setPendingSyncChoice] = useState<EnableCloudSyncChoice | null>(null)

  const totalAssignedDays = Object.keys(assignments).filter(
    (k) => (assignments[k] || []).length > 0,
  ).length


  // Enabling sync asks which side wins, so a stale device never silently overwrites the cloud
  const handleToggleSync = () => {
    if (syncEnabled) {
      setSyncEnabled(false)
      CloudSyncService.setSyncEnabled(false)
      return
    }
    setIsEnableSyncModalOpen(true)
  }

  const handleChooseSyncSource = async (choice: EnableCloudSyncChoice) => {
    setPendingSyncChoice(choice)
    try {
      if (choice === 'pull') {
        const result = await pullCloudData(isAdmin)
        // An empty cloud is fine to start syncing from: the next saves will fill it
        if (result.success || result.code === 'no_data') {
          setSyncEnabled(true)
          CloudSyncService.setSyncEnabled(true)
          showSuccessToast(t('settings:cloudSyncSection.enabledFromCloud'))
        } else {
          notifyPullResult(result)
        }
      } else {
        const result = await forcePushCloudData(isAdmin)
        if (result.success) {
          setSyncEnabled(true)
          CloudSyncService.setSyncEnabled(true)
          showSuccessToast(t('settings:cloudSyncSection.pushSuccess'))
        } else {
          notifyPushResult(result)
        }
      }
    } catch (err) {
      console.error('Failed to enable cloud sync:', err)
      showErrorToast(t('settings:cloudSyncSection.pushError'))
    } finally {
      setPendingSyncChoice(null)
      setIsEnableSyncModalOpen(false)
    }
  }

  const handlePullCloudData = async () => {
    try {
      setIsPulling(true)
      notifyPullResult(await pullCloudData(isAdmin))
    } catch {
      showErrorToast(t('common:toast.pullError'))
    } finally {
      setIsPulling(false)
    }
  }

  const handleExport = async () => {
    try {
      setIsExporting(true)
      await exportAppData()
      setExportSuccess(true)
      setTimeout(() => setExportSuccess(false), 2500)
    } catch (err) {
      console.error('Erro ao exportar backup nas configurações:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleConfirmClear = () => {
    try {
      setIsClearingLocalData(true)
      clearAllLocalData()
      setIsClearModalOpen(false)
      setClearFeedback(t('dangerSection.clearedFeedback'))
      setTimeout(() => setClearFeedback(null), 5000)
    } catch (err) {
      console.error('Erro ao limpar dados locais:', err)
    } finally {
      setIsClearingLocalData(false)
    }
  }

  return (
    <div
      data-testid="settings-view"
      className="flex-1 h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 md:p-8 flex flex-col items-center custom-scrollbar"
    >
      <div className="w-full max-w-4xl space-y-6 pb-12">
        {/* Header */}
        <div className="flex items-center gap-3.5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            {activeTab === 'import' ? (
              <Upload className="w-5 h-5" />
            ) : (
              <Settings className="w-5 h-5" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              {activeTab === 'import'
                ? t('settings:tabs.import', { defaultValue: 'Importar Dados' })
                : t('settings:title', { defaultValue: 'Configurações Gerais' })}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeTab === 'import'
                ? t('settings:backupSection.importOrRestore', {
                    defaultValue: 'Restaure backups ou inicie a configuração da equipe',
                  })
                : t('settings:subtitle', {
                    defaultValue: 'Preferências do sistema, persistência e sincronização de dados',
                  })}
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div role="tablist" className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'general'}
            onClick={() => handleTabChange('general')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'general'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>{t('settings:tabs.general', { defaultValue: 'Geral' })}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'import'}
            onClick={() => handleTabChange('import')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'import'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>{t('settings:tabs.import', { defaultValue: 'Importar Dados' })}</span>
          </button>
        </div>

        {activeTab === 'import' ? (
          <ImportView embedded />
        ) : (
          <>

        {/* Section: Idioma / Language (Visível para Todos os Usuários) */}
        <div
          data-testid="language-settings-card"
          className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                  {t('languageSection.title', { defaultValue: 'Idioma / Language' })}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {t('languageSection.description', { defaultValue: 'Selecione o idioma de exibição do sistema' })}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('languageSection.helper', { defaultValue: 'Alterne entre Português e Inglês com suporte em tempo real em todas as telas.' })}
                </p>
              </div>
            </div>

            <div className="w-full sm:w-64 shrink-0">
              <LanguageSelector variant="full" align="bottom" className="w-full" />
            </div>
          </div>
        </div>

        {/* Section 1: Administrator Cloud Sync Switch & On-Demand Pull Button */}
        {isAdmin && (
          <div
            data-testid="admin-sync-card"
            className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-indigo-200/80 dark:border-indigo-900/60 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t('settings:cloudSyncSection.title')}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('settings:cloudSyncSection.subtitle')}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div
                data-testid="sync-status-badge"
                className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold border transition ${
                  syncEnabled
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                }`}
              >
                {syncEnabled ? (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{t('common:sync.cloudActive')}</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="w-3.5 h-3.5 text-slate-500" />
                    <span>{t('common:sync.localOnly')}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <p>
                  {t('settings:cloudSyncSection.toggleActiveDesc')}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {t('settings:cloudSyncSection.toggleInactiveDesc')}
                </p>
              </div>

              {/* Toggle switch button */}
              <button
                type="button"
                role="switch"
                aria-checked={syncEnabled}
                onClick={handleToggleSync}
                data-testid="toggle-sync-button"
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                  syncEnabled
                    ? 'bg-indigo-600'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span className="sr-only">{t('settings:cloudSyncSection.toggleLabel')}</span>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    syncEnabled ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Pull Cloud Data Button & Feedback (ALWAYS VISIBLE in Admin Sync Card) */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    {t('settings:cloudSyncSection.pullButton')}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('settings:cloudSyncSection.pullButtonDesc')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handlePullCloudData}
                  disabled={isPulling}
                  data-testid="pull-cloud-data-button"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin' : ''}`}
                  />
                  <span>
                    {isPulling
                      ? t('settings:cloudSyncSection.pulling')
                      : t('settings:cloudSyncSection.pullButton')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Appearance Preferences */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
            {t('settings:appearanceSection.title')}
          </h2>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {isDarkMode ? (
                  <Moon className="w-5 h-5 text-indigo-400" />
                ) : (
                  <Sun className="w-5 h-5 text-amber-500" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {t('settings:appearanceSection.theme')}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isDarkMode
                    ? t('settings:appearanceSection.darkActive')
                    : t('settings:appearanceSection.lightActive')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleDarkMode}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition"
            >
              {isDarkMode
                ? t('settings:appearanceSection.switchToLight')
                : t('settings:appearanceSection.switchToDark')}
            </button>
          </div>
        </div>

        {/* Section 3: Local Storage Summary */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
              {t('settings:storageSection.title')}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 min-w-0">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2 min-w-0">
                <Users className="w-4 h-4 shrink-0" />
                <span
                  className="text-xs font-medium whitespace-nowrap truncate"
                  title={t('settings:storageSection.staff')}
                >
                  {t('settings:storageSection.staff')}
                </span>
              </div>
              <p className="text-2xl font-black leading-none text-slate-900 dark:text-white my-1">
                {persons.length}
              </p>
              <p
                className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1"
                title={t('settings:storageSection.activeStaff', {
                  count: persons.filter((p) => p.active !== false).length,
                })}
              >
                {t('settings:storageSection.activeStaff', { count: persons.filter((p) => p.active !== false).length })}
              </p>
            </div>

            <div className="flex flex-col justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 min-w-0">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2 min-w-0">
                <Calendar className="w-4 h-4 shrink-0" />
                <span
                  className="text-xs font-medium whitespace-nowrap truncate"
                  title={t('settings:storageSection.assignedDays')}
                >
                  {t('settings:storageSection.assignedDays')}
                </span>
              </div>
              <p className="text-2xl font-black leading-none text-slate-900 dark:text-white my-1">
                {totalAssignedDays}
              </p>
              <p
                className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1"
                title={t('settings:storageSection.assignedDaysDesc')}
              >
                {t('settings:storageSection.assignedDaysDesc')}
              </p>
            </div>

            <div className="flex flex-col justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 min-w-0">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2 min-w-0">
                <Calendar className="w-4 h-4 shrink-0" />
                <span
                  className="text-xs font-medium whitespace-nowrap truncate"
                  title={t('settings:storageSection.events')}
                >
                  {t('settings:storageSection.events')}
                </span>
              </div>
              <p className="text-2xl font-black leading-none text-slate-900 dark:text-white my-1">
                {events.length}
              </p>
              <p
                className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1"
                title={t('settings:storageSection.eventsDesc')}
              >
                {t('settings:storageSection.eventsDesc')}
              </p>
            </div>

            <div
              data-testid="storage-summary-shifts"
              className="flex flex-col justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 min-w-0"
            >
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2 min-w-0">
                <Clock className="w-4 h-4 shrink-0" />
                <span
                  className="text-xs font-medium whitespace-nowrap truncate"
                  title={t('settings:storageSection.shifts')}
                >
                  {t('settings:storageSection.shifts')}
                </span>
              </div>
              <p className="text-2xl font-black leading-none text-slate-900 dark:text-white my-1">
                {shiftDefinitions.length}
              </p>
              <p
                className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1"
                title={t('settings:storageSection.shiftsDesc')}
              >
                {t('settings:storageSection.shiftsDesc')}
              </p>
            </div>

            <div
              data-testid="storage-summary-addresses"
              className="flex flex-col justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 min-w-0"
            >
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2 min-w-0">
                <MapPin className="w-4 h-4 shrink-0" />
                <span
                  className="text-xs font-medium whitespace-nowrap truncate"
                  title={t('settings:storageSection.addresses')}
                >
                  {t('settings:storageSection.addresses')}
                </span>
              </div>
              <p className="text-2xl font-black leading-none text-slate-900 dark:text-white my-1">
                {addresses.length}
              </p>
              <p
                className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1"
                title={t('settings:storageSection.addressesDesc')}
              >
                {t('settings:storageSection.addressesDesc')}
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: Backup & Restore Actions */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
            {t('settings:backupSection.title')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition disabled:opacity-50"
            >
              {exportSuccess ? (
                <Check className="w-4 h-4" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>
                {exportSuccess
                  ? t('settings:backupSection.downloadSuccess')
                  : t('settings:backupSection.downloadBackup')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('import')}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
            >
              <Upload className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{t('settings:backupSection.importOrRestore')}</span>
            </button>
          </div>
        </div>

        {/* Section 5: Gerenciamento e Limpeza de Dados Locais (Visível para Todos os Usuários) */}
        <div
          data-testid="clear-local-data-card"
          className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-rose-200/80 dark:border-rose-900/60 shadow-xs space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                  {t('settings:dangerSection.title')}
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {t('settings:dangerSection.description')}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('settings:dangerSection.note')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsClearModalOpen(true)}
              aria-label={t('settings:dangerSection.clearButton')}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-2 shrink-0 self-start sm:self-center"
            >
              <Trash2 className="w-4 h-4" />
              <span>{t('settings:dangerSection.clearButton')}</span>
            </button>
          </div>

          {clearFeedback && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{clearFeedback}</span>
            </div>
          )}
        </div>

        {/* Section 6: System Information */}
        <div className="bg-slate-100 dark:bg-slate-900/60 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400">
          <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-900 dark:text-slate-200">
              {t('settings:systemSection.title')}
            </p>
            <p>
              {t('settings:systemSection.description')}
            </p>
          </div>
        </div>
          </>
        )}
      </div>

      {/* Confirmation Modal */}
      <EnableCloudSyncModal
        isOpen={isEnableSyncModalOpen}
        onClose={() => setIsEnableSyncModalOpen(false)}
        onChoose={handleChooseSyncSource}
        pendingChoice={pendingSyncChoice}
      />
      <ConfirmClearLocalDataModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        onConfirm={handleConfirmClear}
        isClearing={isClearingLocalData}
      />
    </div>
  )
}
