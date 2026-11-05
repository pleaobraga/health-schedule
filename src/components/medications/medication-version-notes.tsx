import { format, parseISO } from 'date-fns'
import { useTranslation } from 'react-i18next'

import { cn } from '../../utils/cn'

import type { MedicationVersionNote } from '../../types'

export interface MedicationVersionNotesProps {
  notes?: MedicationVersionNote[]
  // The printed sheet is always light, so it must not pick up `dark:` colors.
  printable?: boolean
}

export function MedicationVersionNotes({
  notes,
  printable = false,
}: MedicationVersionNotesProps) {
  const { t, i18n } = useTranslation('medications')

  if (!notes || notes.length === 0) return null

  const dateFormat = i18n.language.startsWith('en') ? 'MM/dd/yyyy' : 'dd/MM/yyyy'

  return (
    <div data-testid="medication-version-notes" className="mt-1">
      <span
        className={cn(
          'block text-[11px] font-bold text-slate-500',
          !printable && 'dark:text-slate-400',
        )}
      >
        {t('notesTitle')}
      </span>
      <ul className="mt-0.5 space-y-1">
        {notes.map((note) => (
          <li
            key={note.id}
            className={cn(
              'text-xs text-slate-700',
              !printable && 'dark:text-slate-300',
            )}
          >
            {[
              note.date && format(parseISO(note.date), dateFormat),
              note.professional,
              note.text,
            ]
              .filter(Boolean)
              .join(' • ')}
          </li>
        ))}
      </ul>
    </div>
  )
}
