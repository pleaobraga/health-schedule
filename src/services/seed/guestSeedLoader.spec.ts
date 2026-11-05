import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getDaysInMonth,
  getRelativeMonths,
  isEnglishLanguage,
  isGuestDataEmpty,
  loadGuestSeedData,
  resolveSeedUrl,
  transformSeedData,
} from './guestSeedLoader'
import demoEnJson from '../../../public/demo/demo-en.json'
import demoJson from '../../../public/demo/demo.json'
import { i18n } from '../../i18n'
import { useScheduleStore } from '../../store/use-schedule-store'
import { StorageService } from '../storage-service'

import type { AppDataSnapshot, CalendarEvent, MonthlyAvailability } from '../../types'

describe('guestSeedLoader', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
    useScheduleStore.getState().clearAllLocalData()
  })

  describe('getRelativeMonths', () => {
    it('computes M-1, M and M+1 in the middle of the year', () => {
      const refDate = new Date(2026, 9, 20) // Outubro (mês 9 no JS, 10 no calendário)
      const { prevMonthStr, currMonthStr, nextMonthStr } = getRelativeMonths(refDate)

      expect(prevMonthStr).toBe('2026-09')
      expect(currMonthStr).toBe('2026-10')
      expect(nextMonthStr).toBe('2026-11')
    })

    it('computes M-1 across the year boundary (January -> previous December)', () => {
      const refDate = new Date(2027, 0, 15) // Janeiro 2027
      const { prevMonthStr, currMonthStr, nextMonthStr } = getRelativeMonths(refDate)

      expect(prevMonthStr).toBe('2026-12')
      expect(currMonthStr).toBe('2027-01')
      expect(nextMonthStr).toBe('2027-02')
    })

    it('computes M+1 across the year boundary (December -> next January)', () => {
      const refDate = new Date(2026, 11, 25) // Dezembro 2026
      const { prevMonthStr, currMonthStr, nextMonthStr } = getRelativeMonths(refDate)

      expect(prevMonthStr).toBe('2026-11')
      expect(currMonthStr).toBe('2026-12')
      expect(nextMonthStr).toBe('2027-01')
    })

    it('does not skip February when the reference date is the 31st (e.g. January 31 or March 31)', () => {
      const jan31 = new Date(2026, 0, 31) // 31 de Janeiro de 2026
      expect(getRelativeMonths(jan31)).toEqual({
        prevMonthStr: '2025-12',
        currMonthStr: '2026-01',
        nextMonthStr: '2026-02',
      })

      const mar31 = new Date(2026, 2, 31) // 31 de Março de 2026
      expect(getRelativeMonths(mar31)).toEqual({
        prevMonthStr: '2026-02',
        currMonthStr: '2026-03',
        nextMonthStr: '2026-04',
      })
    })
  })

  describe('getDaysInMonth', () => {
    it('returns 31 days for long months (e.g. January, March, October)', () => {
      expect(getDaysInMonth('2026-01')).toBe(31)
      expect(getDaysInMonth('2026-03')).toBe(31)
      expect(getDaysInMonth('2026-10')).toBe(31)
    })

    it('returns 30 days for 30-day months (e.g. April, June, September, November)', () => {
      expect(getDaysInMonth('2026-04')).toBe(30)
      expect(getDaysInMonth('2026-06')).toBe(30)
      expect(getDaysInMonth('2026-09')).toBe(30)
      expect(getDaysInMonth('2026-11')).toBe(30)
    })

    it('returns 28 days for February in common years and 29 in leap years', () => {
      expect(getDaysInMonth('2025-02')).toBe(28)
      expect(getDaysInMonth('2026-02')).toBe(28)
      expect(getDaysInMonth('2027-02')).toBe(28)
      expect(getDaysInMonth('2024-02')).toBe(29)
      expect(getDaysInMonth('2028-02')).toBe(29)
    })
  })

  describe('transformSeedData', () => {
    const rawDemo = demoJson as unknown as AppDataSnapshot

    it('maps the static 2026-09, 2026-10 and 2026-11 keys to months relative to today', () => {
      // Reference date in March 2027 (M-1 = 2027-02, M = 2027-03, M+1 = 2027-04)
      const refDate = new Date(2027, 2, 10)
      const transformed = transformSeedData(rawDemo, refDate)

      // monthParticipants
      expect(transformed.monthParticipants).toHaveProperty('2027-02')
      expect(transformed.monthParticipants).toHaveProperty('2027-03')
      expect(transformed.monthParticipants).toHaveProperty('2027-04')
      expect(transformed.monthParticipants).not.toHaveProperty('2026-10')
      expect(transformed.monthParticipants['2027-03']).toHaveLength(7)

      // monthActiveShifts and monthActiveRules
      expect(transformed.monthActiveShifts).toHaveProperty('2027-03')
      expect(transformed.monthActiveRules).toHaveProperty('2027-03')

      // assignments: date keys belong to 2027-02, 2027-03 or 2027-04
      const assignmentKeys = Object.keys(transformed.assignments || {})
      expect(assignmentKeys.length).toBeGreaterThan(0)
      expect(assignmentKeys.some((k) => k.startsWith('2027-02'))).toBe(true)
      expect(assignmentKeys.some((k) => k.startsWith('2027-03'))).toBe(true)
      expect(assignmentKeys.some((k) => k.startsWith('2027-04'))).toBe(true)
      expect(assignmentKeys.some((k) => k.startsWith('2026-10'))).toBe(false)

      // dayShiftAssignments
      const dayShiftKeys = Object.keys(transformed.dayShiftAssignments || {})
      expect(dayShiftKeys.length).toBeGreaterThan(0)
      expect(dayShiftKeys.some((k) => k.startsWith('2027-03'))).toBe(true)

      // availabilities
      const monthsInAvailabilities = (
        transformed.availabilities as MonthlyAvailability[]
      ).map((a) => a.month)
      expect(monthsInAvailabilities).toContain('2027-03')
      expect(monthsInAvailabilities).toContain('2027-04')
      expect(monthsInAvailabilities).not.toContain('2026-10')
    })

    it('maps the events and keeps the 4 addresses with their matching addressId', () => {
      const refDate = new Date(2027, 4, 15) // Maio 2027 (M-1 = Abril, M = Maio, M+1 = Junho)
      const transformed = transformSeedData(rawDemo, refDate)

      // Addresses are untouched
      expect(transformed.addresses).toHaveLength(4)
      const addressIds = transformed.addresses?.map((a) => a.id)
      expect(addressIds).toEqual([
        'addr_seed_01',
        'addr_seed_02',
        'addr_seed_03',
        'addr_seed_04',
      ])

      // Mapped events
      expect(transformed.events).toHaveLength(rawDemo.events.length)
      transformed.events.forEach((ev: CalendarEvent) => {
        expect(addressIds).toContain(ev.addressId)
        expect(ev.personId).toMatch(/^p_seed_/)
        expect(ev.title).toBeTruthy()
        expect(ev.time).toMatch(/^\d{2}:\d{2}$/)
        // The date starts with 2027-04, 2027-05 or 2027-06
        const monthPrefix = ev.date.slice(0, 7)
        expect(['2027-04', '2027-05', '2027-06']).toContain(monthPrefix)
      })
    })

    it('handles shorter months (e.g. a 28-day February) by clamping the days', () => {
      // February 2026 as the current month (M-1 = January [31], M = February [28], M+1 = March [31])
      const refDate = new Date(2026, 1, 10)
      const transformed = transformSeedData(rawDemo, refDate)

      // The current month is 2026-02 (28 days)
      expect(getDaysInMonth('2026-02')).toBe(28)

      // February assignments do not go past day 28
      Object.keys(transformed.assignments || {}).forEach((dateStr) => {
        if (dateStr.startsWith('2026-02')) {
          const day = parseInt(dateStr.slice(8, 10), 10)
          expect(day).toBeLessThanOrEqual(28)
          expect(day).toBeGreaterThanOrEqual(1)
        }
      })

      // February dayShiftAssignments do not go past day 28
      Object.keys(transformed.dayShiftAssignments || {}).forEach((dateStr) => {
        if (dateStr.startsWith('2026-02')) {
          const day = parseInt(dateStr.slice(8, 10), 10)
          expect(day).toBeLessThanOrEqual(28)
        }
      })

      // February (2026-02) monthDailyShifts has no day > 28
      const febDailyShifts = transformed.monthDailyShifts?.['2026-02']
      if (febDailyShifts) {
        Object.values(febDailyShifts).forEach((days) => {
          days.forEach((dayNum) => {
            expect(dayNum).toBeLessThanOrEqual(28)
          })
        })
      }

      // February availabilities have no day 29, 30 or 31
      const febAvailabilities = (
        transformed.availabilities as MonthlyAvailability[]
      ).filter((a) => a.month === '2026-02')
      febAvailabilities.forEach((avail) => {
        avail.availableDays.forEach((d: number) => {
          expect(d).toBeLessThanOrEqual(28)
        })
        if (avail.shiftAvailability) {
          Object.values(avail.shiftAvailability).forEach((days: number[]) => {
            days.forEach((d: number) => {
              expect(d).toBeLessThanOrEqual(28)
            })
          })
        }
        if (avail.shiftRates) {
          Object.values(avail.shiftRates).forEach((rates: Record<string, number>) => {
            Object.keys(rates).forEach((dStr) => {
              expect(Number(dStr)).toBeLessThanOrEqual(28)
            })
          })
        }
      })

      // February events do not go past day 28
      transformed.events.forEach((ev: CalendarEvent) => {
        if (ev.date.startsWith('2026-02')) {
          const day = parseInt(ev.date.slice(8, 10), 10)
          expect(day).toBeLessThanOrEqual(28)
        }
      })
    })

    it('clamps the days for 30-day months (e.g. April)', () => {
      // April as the current month (M-1 = March [31], M = April [30], M+1 = May [31])
      const refDate = new Date(2026, 3, 10)
      const transformed = transformSeedData(rawDemo, refDate)

      expect(getDaysInMonth('2026-04')).toBe(30)

      Object.keys(transformed.assignments || {}).forEach((dateStr) => {
        if (dateStr.startsWith('2026-04')) {
          const day = parseInt(dateStr.slice(8, 10), 10)
          expect(day).toBeLessThanOrEqual(30)
        }
      })

      const aprDailyShifts = transformed.monthDailyShifts?.['2026-04']
      if (aprDailyShifts) {
        Object.values(aprDailyShifts).forEach((days) => {
          days.forEach((dayNum) => {
            expect(dayNum).toBeLessThanOrEqual(30)
          })
        })
      }
    })

    it('maps the previous, current and next months with February in any position (28 and 29 days), in Portuguese and English', () => {
      const datasets = [
        { lang: 'pt-BR', data: demoJson as unknown as AppDataSnapshot },
        { lang: 'en-US', data: demoEnJson as unknown as AppDataSnapshot },
      ]

      // Scenarios where February is M+1 (ref: Jan), M (ref: Feb), M-1 (ref: Mar), plus a leap year (2028)
      const scenarios = [
        { refDate: new Date(2026, 0, 31), expectedMonths: ['2025-12', '2026-01', '2026-02'] },
        { refDate: new Date(2026, 1, 15), expectedMonths: ['2026-01', '2026-02', '2026-03'] },
        { refDate: new Date(2026, 2, 31), expectedMonths: ['2026-02', '2026-03', '2026-04'] },
        { refDate: new Date(2028, 1, 15), expectedMonths: ['2028-01', '2028-02', '2028-03'] },
      ]

      for (const { data } of datasets) {
        for (const { refDate, expectedMonths } of scenarios) {
          const transformed = transformSeedData(data, refDate)

          // The 3 months are mapped in every monthly structure
          expect(Object.keys(transformed.monthParticipants).sort()).toEqual(expectedMonths)
          expect(Object.keys(transformed.monthActiveShifts || {}).sort()).toEqual(expectedMonths)
          expect(Object.keys(transformed.monthActiveRules || {}).sort()).toEqual(expectedMonths)
          expect(Object.keys(transformed.monthDailyShifts || {}).sort()).toEqual(expectedMonths)

          for (const monthStr of expectedMonths) {
            const maxDays = getDaysInMonth(monthStr)

            // 1. monthDailyShifts
            const dailyShifts = transformed.monthDailyShifts?.[monthStr] || {}
            Object.values(dailyShifts).forEach((days) => {
              days.forEach((d) => {
                expect(d).toBeGreaterThanOrEqual(1)
                expect(d).toBeLessThanOrEqual(maxDays)
              })
            })

            // 2. assignments
            Object.keys(transformed.assignments || {})
              .filter((k) => k.startsWith(monthStr))
              .forEach((dateStr) => {
                const day = parseInt(dateStr.slice(8, 10), 10)
                expect(day).toBeGreaterThanOrEqual(1)
                expect(day).toBeLessThanOrEqual(maxDays)
              })

            // 3. dayShiftAssignments
            Object.keys(transformed.dayShiftAssignments || {})
              .filter((k) => k.startsWith(monthStr))
              .forEach((dateStr) => {
                const day = parseInt(dateStr.slice(8, 10), 10)
                expect(day).toBeGreaterThanOrEqual(1)
                expect(day).toBeLessThanOrEqual(maxDays)
              })

            // 4. availabilities
            const monthAvails = (transformed.availabilities as MonthlyAvailability[]).filter(
              (a) => a.month === monthStr
            )
            expect(monthAvails.length).toBeGreaterThan(0)
            monthAvails.forEach((avail) => {
              avail.availableDays.forEach((d) => {
                expect(d).toBeGreaterThanOrEqual(1)
                expect(d).toBeLessThanOrEqual(maxDays)
              })
              Object.values(avail.shiftAvailability || {}).forEach((days) => {
                days.forEach((d) => {
                  expect(d).toBeGreaterThanOrEqual(1)
                  expect(d).toBeLessThanOrEqual(maxDays)
                })
              })
              Object.values(avail.shiftRates || {}).forEach((rates) => {
                Object.keys(rates).forEach((dStr) => {
                  const d = Number(dStr)
                  expect(d).toBeGreaterThanOrEqual(1)
                  expect(d).toBeLessThanOrEqual(maxDays)
                })
              })
            })

            // 5. events
            transformed.events
              .filter((ev) => ev.date.startsWith(monthStr))
              .forEach((ev) => {
                const day = parseInt(ev.date.slice(8, 10), 10)
                expect(day).toBeGreaterThanOrEqual(1)
                expect(day).toBeLessThanOrEqual(maxDays)
              })
          }

          // When a 28-day February is the previous month (e.g. ref March 2026),
          // February 28 keeps its original schedule instead of being overwritten by days 29/30
          if (expectedMonths[0] === '2026-02') {
            expect(transformed.assignments['2026-02-28']).toEqual(['p_seed_07'])
            expect(transformed.assignments['2026-02-29']).toBeUndefined()
            expect(transformed.assignments['2026-02-30']).toBeUndefined()
          }
        }
      }
    })
  })

  describe('isGuestDataEmpty', () => {
    it('returns true when local storage has no people and no assignments', () => {
      expect(isGuestDataEmpty()).toBe(true)
    })

    it.each([
      ['people', () => StorageService.savePersons([{ id: 'p1', name: 'Dr. Teste', color: '#000000', active: true }])],
      ['assignments', () => StorageService.saveAssignments({ '2026-10-01': ['p1'] })],
    ])('returns false when %s are saved', (_label, seed) => {
      seed()
      expect(isGuestDataEmpty()).toBe(false)
    })
  })

  describe('loadGuestSeedData', () => {
    it('loads the demo JSON, maps it to the current months and fills storage and the store', async () => {
      // fetch returns the demo JSON
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => demoJson,
      } as Response)

      const refDate = new Date(2026, 9, 15) // 2026-10
      expect(isGuestDataEmpty()).toBe(true)

      const snapshot = await loadGuestSeedData({ refDate })

      expect(fetchSpy).toHaveBeenCalled()
      expect(snapshot).not.toBeNull()
      expect(snapshot.people).toHaveLength(7)

      // Local storage is filled
      expect(isGuestDataEmpty()).toBe(false)
      expect(StorageService.getPersons()).toHaveLength(7)
      expect(StorageService.getAddresses()).toHaveLength(4)
      expect(Object.keys(StorageService.getAssignments()).length).toBeGreaterThan(0)

      // The store is updated with the current month
      const state = useScheduleStore.getState()
      expect(state.currentMonth).toBe('2026-10')
      expect(state.persons).toHaveLength(7)
      expect(state.addresses).toHaveLength(4)
      expect(state.currentView).toBe('calendar')

      // Onboarding is marked as checked
      expect(StorageService.hasCheckedOnboarding()).toBe(true)
    })

    it('saves the snapshot to the active guest profile when there is one', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => demoJson,
      } as Response)

      StorageService.setActiveGuestId('guest_test_123')
      StorageService.saveGuestProfiles([
        {
          id: 'guest_test_123',
          name: 'Convidado Teste',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        },
      ])

      await loadGuestSeedData()

      const guestDataset = StorageService.getGuestDataset('guest_test_123')
      expect(guestDataset).not.toBeNull()
      expect(guestDataset?.persons).toHaveLength(7)
      expect(guestDataset?.addresses).toHaveLength(4)
    })

    it('throws a descriptive error when fetch returns a non-ok status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response)

      await expect(loadGuestSeedData()).rejects.toThrow(/Failed to load seed JSON/i)
    })

    it('loads the US English demo (demo-en.json) when the app language is English', async () => {
      await i18n.changeLanguage('en-US')

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => demoEnJson,
      } as Response)

      const refDate = new Date(2026, 9, 15) // 2026-10
      const snapshot = await loadGuestSeedData({ refDate })

      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('demo/demo-en.json'))
      expect(snapshot.people).toHaveLength(7)
      expect(snapshot.people[0].name).toBe('Dr. Emily Carter')

      // Shifts are in English
      const shifts = StorageService.getShiftDefinitions()
      expect(shifts.map((s) => s.name)).toEqual([
        '12h Day Shift',
        '12h Night Shift',
        '24h On-Call Shift',
      ])

      // Rules are in English
      const rules = StorageService.getShiftRules()
      expect(rules.map((r) => r.name)).toEqual([
        'Max 1 shift per day',
        'Max 2 shifts per week',
        'Minimum rest between shifts',
      ])

      // Addresses are US addresses
      const addresses = StorageService.getAddresses()
      expect(addresses).toHaveLength(4)
      expect(addresses[0].name).toBe('Massachusetts General Hospital')
      expect(addresses[0].city).toBe('Boston, MA')
      expect(addresses[0].street).toBe('Fruit Street')

      // Events are in English
      const events = StorageService.getEvents()
      expect(events.length).toBeGreaterThan(0)
      expect(events[0].title).toBe('Emergency Protocols Training')

      // The store holds the English data
      const state = useScheduleStore.getState()
      expect(state.persons[0].name).toBe('Dr. Emily Carter')
      expect(state.shiftDefinitions[0].name).toBe('12h Day Shift')
      expect(state.shiftRules[0].name).toBe('Max 1 shift per day')
      expect(state.addresses[0].name).toBe('Massachusetts General Hospital')
    })
  })

  describe('resolveSeedUrl & isEnglishLanguage', () => {
    it('tells English and Portuguese languages apart', async () => {
      expect(isEnglishLanguage('en')).toBe(true)
      expect(isEnglishLanguage('en-US')).toBe(true)
      expect(isEnglishLanguage('pt-BR')).toBe(false)
      expect(isEnglishLanguage('pt')).toBe(false)

      await i18n.changeLanguage('en-US')
      expect(isEnglishLanguage()).toBe(true)

      await i18n.changeLanguage('pt-BR')
      expect(isEnglishLanguage()).toBe(false)
    })

    it('uses customUrl when given', () => {
      expect(resolveSeedUrl('/custom/path.json')).toBe('/custom/path.json')
    })

    it('builds a demo/demo.json URL in Portuguese', async () => {
      await i18n.changeLanguage('pt-BR')
      const url = resolveSeedUrl()
      expect(url).toContain('demo/demo.json')
    })

    it('builds a demo/demo-en.json URL in English', async () => {
      await i18n.changeLanguage('en-US')
      const url = resolveSeedUrl()
      expect(url).toContain('demo/demo-en.json')
    })
  })
})

