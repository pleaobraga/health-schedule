import { format } from 'date-fns'
import { Calendar, Clock, History, Package, TrendingUp, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useScheduleStore } from '../../store/use-schedule-store'
import { formatDisplayDate } from '../../utils/date-utils'
import {
  getItemHistory,
  resolveExpenseItemId,
} from '../../utils/expense-item-utils'

import type { ItemHistoryMode } from '../../utils/expense-item-utils'

export interface ItemHistoryProps {
  itemId: string
  onClose?: () => void
}

export function ItemHistory({ itemId, onClose }: ItemHistoryProps) {
  const { t, i18n } = useTranslation(['purchases', 'common'])
  const { expenseItems, expenses } = useScheduleStore()
  const [mode, setMode] = useState<ItemHistoryMode>('LAST')

  const today = format(new Date(), 'yyyy-MM-dd')

  const resolvedItem = useMemo(() => {
    const resolvedId = resolveExpenseItemId(itemId, expenseItems)
    return expenseItems.find((it) => it.id === resolvedId)
  }, [expenseItems, itemId])

  const history = useMemo(
    () => getItemHistory(itemId, expenseItems, expenses, { mode, today }),
    [expenseItems, expenses, itemId, mode, today],
  )

  return (
    <div
      data-testid="item-history"
      className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-xs text-slate-900 dark:text-slate-100"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
              {resolvedItem?.name ?? t('purchases:history.title')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('purchases:history.title')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Segmented Mode Control */}
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200/80 dark:border-slate-700/80">
            <button
              type="button"
              data-testid="item-history-mode-last"
              onClick={() => setMode('LAST')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                mode === 'LAST'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('purchases:history.modeLast')}
            </button>
            <button
              type="button"
              data-testid="item-history-mode-full"
              onClick={() => setMode('FULL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                mode === 'FULL'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t('purchases:history.modeFull')}
            </button>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title={t('purchases:history.close')}
              aria-label={t('purchases:history.close')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Summary Banner */}
      {history.lastPurchaseDate !== null &&
      history.daysSinceLastPurchase !== null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/70 flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                {t('purchases:history.lastPurchaseLabel')}
              </span>
              <span
                data-testid="item-history-last-date"
                className="text-base font-black text-emerald-700 dark:text-emerald-400 mt-0.5 block"
              >
                {formatDisplayDate(history.lastPurchaseDate, i18n.language)}
              </span>
            </div>
            <span
              data-testid="item-history-days-since"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-900/70 text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>
                {history.daysSinceLastPurchase === 0
                  ? t('purchases:history.todayBadge')
                  : t('purchases:history.daysSinceLast', {
                      days: history.daysSinceLastPurchase,
                    })}
              </span>
            </span>
          </div>

          {history.averageIntervalDays !== null ? (
            <div
              data-testid="item-history-avg-interval"
              className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/70 flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                {t('purchases:history.averageInterval', {
                  days: history.averageIntervalDays,
                })}
              </span>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 flex items-center text-xs text-slate-600 dark:text-slate-400">
              {t('purchases:history.singlePurchaseNote')}
            </div>
          )}
        </div>
      ) : null}

      {/* Entries Timeline */}
      {history.entries.length === 0 ? (
        <div
          data-testid="item-history-empty"
          className="py-8 text-center space-y-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700"
        >
          <Package className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {t('purchases:history.noPurchases')}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.entries.map((entry) => (
            <div
              key={entry.date}
              data-testid={`item-history-entry-${entry.date}`}
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-xs"
            >
              <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
                <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{formatDisplayDate(entry.date, i18n.language)}</span>
              </div>

              {entry.daysSincePrevious !== null ? (
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 text-[11px] font-semibold">
                  {t('purchases:history.intervalFromPrevious', {
                    days: entry.daysSincePrevious,
                  })}
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {t('purchases:history.firstPurchaseBadge')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

