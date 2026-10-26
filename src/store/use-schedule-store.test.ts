import { describe, it, expect, beforeEach, vi } from 'vitest'

import { useScheduleStore } from './use-schedule-store'
import { useToastStore } from './use-toast-store'
import { CloudSyncService } from '../services/cloud-sync-service'
import { StorageService } from '../services/storage-service'

describe('useScheduleStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useScheduleStore.setState({
      currentMonth: '2026-10',
      isEditMode: false,
      highlightedPersonId: null,
      persons: [{ id: 'p1', name: 'Dr. Teste', color: '#1d4ed8' }],
      monthParticipants: { '2026-10': ['p1'] },
      availabilities: [],
      assignments: {},
      savedAssignments: {},
      events: [],
      hasUnsavedChanges: false,
      isUnsavedModalOpen: false,
      hasValidated: false,
      validationErrors: [],
    })
  })


  it('navigates between months (previous, next and direct)', () => {
    const store = useScheduleStore.getState()
    expect(store.currentMonth).toBe('2026-10')

    store.goToNextMonth()
    expect(useScheduleStore.getState().currentMonth).toBe('2026-11')

    store.goToPreviousMonth()
    expect(useScheduleStore.getState().currentMonth).toBe('2026-10')

    store.setCurrentMonth('2027-05')
    expect(useScheduleStore.getState().currentMonth).toBe('2027-05')
  })

  it('toggles between edit and view mode', () => {
    const store = useScheduleStore.getState()
    expect(store.isEditMode).toBe(false)

    store.toggleEditMode()
    expect(useScheduleStore.getState().isEditMode).toBe(true)

    store.toggleEditMode()
    expect(useScheduleStore.getState().isEditMode).toBe(false)
  })

  it('toggles the availability highlight of a person', () => {
    const store = useScheduleStore.getState()
    expect(store.highlightedPersonId).toBeNull()

    store.setHighlightedPersonId('p1')
    expect(useScheduleStore.getState().highlightedPersonId).toBe('p1')

    // Clicking same member again should deactivate highlight
    store.setHighlightedPersonId('p1')
    expect(useScheduleStore.getState().highlightedPersonId).toBeNull()
  })

  it('adds, updates and deletes a person', () => {
    const store = useScheduleStore.getState()
    const initialCount = store.persons.length

    // Add
    store.addPerson('Enfermeiro Teste', '#0ea5e9', [1, 2, 3])
    const afterAdd = useScheduleStore.getState().persons
    expect(afterAdd.length).toBe(initialCount + 1)

    const addedPerson = afterAdd.find((p) => p.name === 'Enfermeiro Teste')
    expect(addedPerson).toBeDefined()

    expect(addedPerson?.active).toBe(true)

    // Delete person without assignments
    const deleteResult = store.deletePerson(addedPerson!.id)
    expect(deleteResult).toBe(true)
    const afterDelete = useScheduleStore.getState().persons
    expect(afterDelete.length).toBe(initialCount)
  })

  it('blocks deleting a person with assignments but allows deactivating and reactivating them', () => {
    const store = useScheduleStore.getState()
    const personId = store.persons[0].id
    const dateStr = '2026-10-10'

    // Link person to schedule day
    store.addPersonToDay(dateStr, personId)
    expect(store.canDeletePerson(personId)).toBe(false)

    // Attempting to delete must fail and return false (warns about referential integrity)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const deleteSuccess = store.deletePerson(personId)
    expect(deleteSuccess).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Não é possível excluir o profissional')
    )
    warnSpy.mockRestore()
    expect(useScheduleStore.getState().persons.some((p) => p.id === personId)).toBe(true)

    // Deactivate person
    store.deactivatePerson(personId)
    let person = useScheduleStore.getState().persons.find((p) => p.id === personId)
    expect(person?.active).toBe(false)

    // Schedule history remains intact
    expect(useScheduleStore.getState().assignments[dateStr]).toContain(personId)

    // Reactivate person
    store.reactivatePerson(personId)
    person = useScheduleStore.getState().persons.find((p) => p.id === personId)
    expect(person?.active).toBe(true)

    // Remove assignment and verify canDeletePerson is now true
    store.removePersonFromDay(dateStr, personId)
    expect(store.canDeletePerson(personId)).toBe(true)
  })

  it('sets availability per day and through the even, odd and clear shortcuts', () => {
    const store = useScheduleStore.getState()
    const personId = store.persons[0].id
    const month = '2026-10'

    // Shortcut: even days
    store.setQuickAvailability(personId, month, 'even')
    let avail = useScheduleStore.getState().availabilities.find(
      (a) => a.personId === personId && a.month === month
    )
    expect(avail?.availableDays.every((d) => d % 2 === 0)).toBe(true)

    // Shortcut: odd days
    store.setQuickAvailability(personId, month, 'odd')
    avail = useScheduleStore.getState().availabilities.find(
      (a) => a.personId === personId && a.month === month
    )
    expect(avail?.availableDays.every((d) => d % 2 !== 0)).toBe(true)

    // Shortcut: clear
    store.setQuickAvailability(personId, month, 'clear')
    avail = useScheduleStore.getState().availabilities.find(
      (a) => a.personId === personId && a.month === month
    )
    expect(avail?.availableDays.length).toBe(0)

    // Toggle individual day
    store.togglePersonDayAvailability(personId, month, 15)
    avail = useScheduleStore.getState().availabilities.find(
      (a) => a.personId === personId && a.month === month
    )
    expect(avail?.availableDays).toContain(15)
  })

  it('adds and removes a person from a day', () => {
    const store = useScheduleStore.getState()
    const dateStr = '2026-10-25'

    store.addPersonToDay(dateStr, 'p1')
    expect(useScheduleStore.getState().assignments[dateStr]).toContain('p1')

    store.removePersonFromDay(dateStr, 'p1')
    expect(useScheduleStore.getState().assignments[dateStr]).not.toContain('p1')
  })

  it('adds and removes calendar events', () => {
    const store = useScheduleStore.getState()
    const initialEventsCount = store.events.length

    store.addEvent({
      date: '2026-10-15',
      title: 'Plantão Extraordinário',
      time: '19:00',
    })

    const updatedEvents = useScheduleStore.getState().events
    expect(updatedEvents.length).toBe(initialEventsCount + 1)

    const added = updatedEvents.find((e) => e.title === 'Plantão Extraordinário')
    expect(added).toBeDefined()

    // Update event
    store.updateEvent(added!.id, {
      title: 'Plantão Extraordinário Atualizado',
      time: '20:00',
      description: 'Alterado pelo coordenador',
    })
    const modified = useScheduleStore.getState().events.find((e) => e.id === added!.id)
    expect(modified?.title).toBe('Plantão Extraordinário Atualizado')
    expect(modified?.time).toBe('20:00')
    expect(modified?.description).toBe('Alterado pelo coordenador')

    store.deleteEvent(added!.id)
    expect(useScheduleStore.getState().events.length).toBe(initialEventsCount)
  })

  it('runs the validation and updates the errors and status', () => {
    const store = useScheduleStore.getState()
    expect(store.hasValidated).toBe(false)

    const errors = store.validateCurrentSchedule()
    const state = useScheduleStore.getState()

    expect(state.hasValidated).toBe(true)
    expect(state.validationErrors).toEqual(errors)
  })

  it('clears every assignment of a month with clearMonthAssignments', () => {
    const store = useScheduleStore.getState()
    const month = '2026-10'

    // Ensures assignments exist for the month
    store.addPersonToDay('2026-10-01', 'p1')
    store.addPersonToDay('2026-10-02', 'p2')
    store.addPersonToDay('2026-11-01', 'p1') // Other month

    expect(useScheduleStore.getState().assignments['2026-10-01']).toBeDefined()
    expect(useScheduleStore.getState().assignments['2026-10-02']).toBeDefined()
    expect(useScheduleStore.getState().assignments['2026-11-01']).toBeDefined()

    store.clearMonthAssignments(month)

    const assignmentsAfter = useScheduleStore.getState().assignments
    expect(assignmentsAfter['2026-10-01']).toBeUndefined()
    expect(assignmentsAfter['2026-10-02']).toBeUndefined()
    // Following month should be preserved
    expect(assignmentsAfter['2026-11-01']).toBeDefined()
  })

  it('inserts every available day of a person with insertAllPersonDaysToMonth', () => {
    const store = useScheduleStore.getState()
    const month = '2026-10'
    const personId = store.persons[0].id

    // Set specific availability (days 5 and 12)
    store.setPersonAvailability(personId, month, [5, 12])

    // Clear month first
    store.clearMonthAssignments(month)

    // Insert all person available days into the month
    store.insertAllPersonDaysToMonth(personId, month)

    const assignments = useScheduleStore.getState().assignments
    expect(assignments['2026-10-05']).toContain(personId)
    expect(assignments['2026-10-12']).toContain(personId)
    expect(assignments['2026-10-06']).toBeUndefined()
  })

  it('inserts only the days of a given shift with insertAllPersonDaysToMonth and a shiftId', () => {
    const store = useScheduleStore.getState()
    const month = '2026-10'
    const personId = store.persons[0].id

    // Set shift availability (days 3 and 7 for shift_d12, days 4 and 8 for shift_n12)
    store.setPersonAvailability(personId, month, [3, 4, 7, 8], {
      shift_d12: [3, 7],
      shift_n12: [4, 8],
    })

    // Clear month first
    store.clearMonthAssignments(month)

    // Insert only days for shift_d12
    store.insertAllPersonDaysToMonth(personId, month, 'shift_d12')

    const state = useScheduleStore.getState()
    expect(state.assignments['2026-10-03']).toContain(personId)
    expect(state.assignments['2026-10-07']).toContain(personId)
    expect(state.assignments['2026-10-04']).toBeUndefined()
    expect(state.dayShiftAssignments['2026-10-03']?.shift_d12).toBe(personId)
    expect(state.dayShiftAssignments['2026-10-07']?.shift_d12).toBe(personId)
  })

  it('asks before leaving edit mode with unsaved changes and reverts them on discard', () => {
    const store = useScheduleStore.getState()
    const month = '2026-10'

    // Save clean initial state
    store.clearMonthAssignments(month)
    store.saveSchedule()

    const savedState = { ...useScheduleStore.getState().assignments }
    expect(savedState['2026-10-20']).toBeUndefined()

    // Enter edit mode
    store.setEditMode(true)
    expect(useScheduleStore.getState().isEditMode).toBe(true)

    // Make changes to the schedule
    store.addPersonToDay('2026-10-20', 'p1')
    expect(useScheduleStore.getState().assignments['2026-10-20']).toEqual(['p1'])
    expect(useScheduleStore.getState().hasUnsavedChanges).toBe(true)

    // Try to exit edit mode WITHOUT saving
    store.setEditMode(false)

    // Should open warning modal and keep edit mode active for user decision
    expect(useScheduleStore.getState().isUnsavedModalOpen).toBe(true)
    expect(useScheduleStore.getState().isEditMode).toBe(true)

    // When discarding changes via the modal
    store.discardChanges()
    useScheduleStore.setState({ isEditMode: false })

    // Should have reverted to saved state and exited edit mode
    expect(useScheduleStore.getState().isEditMode).toBe(false)
    expect(useScheduleStore.getState().assignments['2026-10-20']).toBeUndefined()
    expect(useScheduleStore.getState().hasUnsavedChanges).toBe(false)
  })

  it('commits and keeps the changes on saveSchedule', () => {
    const store = useScheduleStore.getState()
    store.setEditMode(true)
    store.addPersonToDay('2026-10-28', 'p1')

    store.saveSchedule()
    expect(useScheduleStore.getState().hasUnsavedChanges).toBe(false)
    expect(useScheduleStore.getState().savedAssignments['2026-10-28']).toEqual(['p1'])

    // When exiting edit mode now, changes remain
    store.setEditMode(false)
    expect(useScheduleStore.getState().assignments['2026-10-28']).toEqual(['p1'])
  })

  it('propagates address updates and deletions to future events only, keeping past events as history', () => {
    const store = useScheduleStore.getState()

    // 1. Add Address
    const address = store.addAddress({
      name: 'Clínica Central',
      street: 'Av. Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
    })
    expect(address.id).toBeDefined()
    expect(useScheduleStore.getState().addresses.some((a) => a.id === address.id)).toBe(true)

    // 2. Add past event and future event associated with this address
    store.addEvent({
      date: '2020-01-10',
      title: 'Atendimento Passado',
      addressId: address.id,
      address: 'Clínica Central - Av. Paulista, 1000 - Bela Vista - São Paulo/SP',
    })

    store.addEvent({
      date: '2099-01-10',
      title: 'Atendimento Futuro',
      addressId: address.id,
      address: 'Clínica Central - Av. Paulista, 1000 - Bela Vista - São Paulo/SP',
    })

    const initialEvents = useScheduleStore.getState().events
    const pastEvInitial = initialEvents.find((e) => e.title === 'Atendimento Passado')!
    const futureEvInitial = initialEvents.find((e) => e.title === 'Atendimento Futuro')!
    expect(pastEvInitial.addressId).toBe(address.id)
    expect(futureEvInitial.addressId).toBe(address.id)

    // 3. Update Address: only future event should be updated
    store.updateAddress(address.id, {
      name: 'Clínica Central - Unidade 2',
      street: 'Rua Augusta',
      number: '500',
    })

    const eventsAfterUpdate = useScheduleStore.getState().events
    const pastEvAfterUpdate = eventsAfterUpdate.find((e) => e.title === 'Atendimento Passado')!
    const futureEvAfterUpdate = eventsAfterUpdate.find((e) => e.title === 'Atendimento Futuro')!

    // Past event: untouched!
    expect(pastEvAfterUpdate.address).toBe('Clínica Central - Av. Paulista, 1000 - Bela Vista - São Paulo/SP')
    expect(pastEvAfterUpdate.addressId).toBe(address.id)

    // Future event: updated to new address!
    expect(futureEvAfterUpdate.address).toContain('Clínica Central - Unidade 2')
    expect(futureEvAfterUpdate.address).toContain('Rua Augusta, 500')
    expect(futureEvAfterUpdate.addressId).toBe(address.id)

    // 4. Delete Address: only future event should have address cleared
    store.deleteAddress(address.id)

    expect(useScheduleStore.getState().addresses.some((a) => a.id === address.id)).toBe(false)

    const eventsAfterDelete = useScheduleStore.getState().events
    const pastEvAfterDelete = eventsAfterDelete.find((e) => e.title === 'Atendimento Passado')!
    const futureEvAfterDelete = eventsAfterDelete.find((e) => e.title === 'Atendimento Futuro')!

    // Past event: address and addressId still preserved as history
    expect(pastEvAfterDelete.address).toBe('Clínica Central - Av. Paulista, 1000 - Bela Vista - São Paulo/SP')
    expect(pastEvAfterDelete.addressId).toBe(address.id)

    // Future event: address and addressId removed
    expect(futureEvAfterDelete.address).toBeUndefined()
    expect(futureEvAfterDelete.addressId).toBeUndefined()
  })

  it('force-pushes the data without changing the sync toggle', async () => {
    localStorage.setItem('scale_manager_cloud_sync_enabled', 'false')
    const pushSpy = vi.spyOn(CloudSyncService, 'pushAllToCloud').mockResolvedValueOnce(true)
    const store = useScheduleStore.getState()

    const res = await store.forcePushCloudData(true)
    expect(res.success).toBe(true)
    expect(pushSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        monthData: expect.any(Object),
        persons: expect.any(Array),
        addresses: expect.any(Array),
      }),
      true,
      true,
      expect.arrayContaining(['2026-10']),
    )
    expect(localStorage.getItem('scale_manager_cloud_sync_enabled')).toBe('false')
  })

  it('assigns and removes a professional on a specific shift with assignPersonToShift and removePersonFromShift', () => {
    const store = useScheduleStore.getState()
    const dateStr = '2026-10-15'

    // Assign p1 to shift_d12
    store.assignPersonToShift(dateStr, 'shift_d12', 'p1')

    let state = useScheduleStore.getState()
    expect(state.dayShiftAssignments[dateStr]?.shift_d12).toBe('p1')
    expect(state.assignments[dateStr]).toContain('p1')
    expect(state.hasUnsavedChanges).toBe(true)

    // Assign p2 to shift_n12 on the same day (2 people on different 12h shifts)
    store.assignPersonToShift(dateStr, 'shift_n12', 'p2')

    state = useScheduleStore.getState()
    expect(state.dayShiftAssignments[dateStr]?.shift_d12).toBe('p1')
    expect(state.dayShiftAssignments[dateStr]?.shift_n12).toBe('p2')
    expect(state.assignments[dateStr]).toEqual(['p1', 'p2'])

    // Remove p1 from shift_d12
    store.removePersonFromShift(dateStr, 'shift_d12')

    state = useScheduleStore.getState()
    expect(state.dayShiftAssignments[dateStr]?.shift_d12).toBeUndefined()
    expect(state.dayShiftAssignments[dateStr]?.shift_n12).toBe('p2')
    expect(state.assignments[dateStr]).toEqual(['p2'])

    // Clearing the month also clears dayShiftAssignments
    store.clearMonthAssignments('2026-10')
    state = useScheduleStore.getState()
    expect(state.dayShiftAssignments[dateStr]).toBeUndefined()
    expect(state.assignments[dateStr]).toBeUndefined()
  })

  it('getDayActiveShifts returns an empty list when the month has no daily shifts', () => {
    const store = useScheduleStore.getState()
    const month = '2026-11'
    useScheduleStore.setState({
      monthDailyShifts: { [month]: {} },
    })

    // 2026-11 has no daily shifts configured, so the list is empty
    const activeShifts = store.getDayActiveShifts('2026-11-05')
    expect(activeShifts).toEqual([])
  })

  it('getDayActiveShifts returns only the shifts set for that day', () => {
    const store = useScheduleStore.getState()
    const month = '2026-12'
    store.setMonthDailyShifts(month, {
      shift_d12: [1, 2, 3],
      shift_n12: [3, 4, 5],
    })

    // Day 1: shift_d12 only
    expect(store.getDayActiveShifts('2026-12-01').map((s) => s.id)).toEqual(['shift_d12'])
    // Day 3: shift_d12 and shift_n12
    expect(store.getDayActiveShifts('2026-12-03').map((s) => s.id)).toEqual(['shift_d12', 'shift_n12'])
    // Day 10: no shift
    expect(store.getDayActiveShifts('2026-12-10')).toEqual([])
  })

  it('removes calendar assignments that no longer match a changed availability', () => {
    const store = useScheduleStore.getState()
    const month = '2026-10'
    const personId = 'p1'

    // Initial availability, assigned on the calendar (with shift and day assignment)
    store.setPersonAvailability(personId, month, [5, 12], {
      shift_d12: [5, 12],
    })
    store.insertAllPersonDaysToMonth(personId, month, 'shift_d12')
    // Another person on the same day and the same professional in another month, to check isolation
    store.assignPersonToShift('2026-10-05', 'shift_n12', 'p2')
    store.addPersonToDay('2026-11-05', personId)

    let state = useScheduleStore.getState()
    expect(state.assignments['2026-10-05']).toContain(personId)
    expect(state.assignments['2026-10-12']).toContain(personId)
    expect(state.dayShiftAssignments['2026-10-05']?.shift_d12).toBe(personId)
    expect(state.dayShiftAssignments['2026-10-12']?.shift_d12).toBe(personId)

    // Change p1 availability: remove day 12 and add day 18
    store.setPersonAvailability(personId, month, [5, 18], {
      shift_d12: [5, 18],
    })

    state = useScheduleStore.getState()
    // Day 5 (still available) stays on the calendar, day 12 (removed) is unassigned
    expect(state.assignments['2026-10-05']).toContain(personId)
    expect(state.dayShiftAssignments['2026-10-05']?.shift_d12).toBe(personId)
    expect(state.assignments['2026-10-12']).not.toContain(personId)
    expect(state.dayShiftAssignments['2026-10-12']?.shift_d12).toBeUndefined()

    // The other person (p2) and the same professional in another month (2026-11) are untouched
    expect(state.assignments['2026-10-05']).toContain('p2')
    expect(state.dayShiftAssignments['2026-10-05']?.shift_n12).toBe('p2')
    expect(state.assignments['2026-11-05']).toContain(personId)
  })

  it('with sync on, auto-syncs shifts, rules, participants, availability and daily shifts of a month without assignments', () => {
    CloudSyncService.setSyncEnabled(true)
    const saveShiftsSpy = vi.spyOn(CloudSyncService, 'saveShiftsToCloud').mockResolvedValue(true)
    const saveRulesSpy = vi.spyOn(CloudSyncService, 'saveRulesToCloud').mockResolvedValue(true)
    const saveMonthSpy = vi.spyOn(CloudSyncService, 'saveMonthToCloud').mockResolvedValue(true)

    const store = useScheduleStore.getState()
    const unscheduledMonth = '2026-11'

    // 1. Create a shift
    const newShift = store.addShiftDefinition({
      name: 'Plantão Noturno Extra',
      code: 'N12E',
      color: '#6366f1',
      durationHours: 12,
      startTime: '19:00',
      enabledByDefault: true,
    })
    expect(saveShiftsSpy).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: newShift.id, name: 'Plantão Noturno Extra' })]),
    )

    // 2. Create a rule
    const newRule = store.addShiftRule({
      name: 'Regra Teste',
      description: 'Descanso mínimo de 11h',
      type: 'MIN_REST_HOURS',
      parameters: { minRestHours: 11 },
      severity: 'ERROR',
      enabledByDefault: true,
    })
    expect(saveRulesSpy).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: newRule.id, name: 'Regra Teste' })]),
    )

    // 3. Set the daily shifts of the month without assignments (2026-11)
    saveMonthSpy.mockClear()
    store.setMonthDailyShifts(unscheduledMonth, {
      [newShift.id]: [1, 2, 10],
    })
    expect(saveMonthSpy).toHaveBeenCalledWith(
      unscheduledMonth,
      expect.objectContaining({
        monthDailyShifts: expect.objectContaining({
          [unscheduledMonth]: { [newShift.id]: [1, 2, 10] },
        }),
      }),
    )

    // 4. Link professionals to that month (2026-11)
    saveMonthSpy.mockClear()
    store.addPersonsToMonth(['p1', 'p2'], unscheduledMonth)
    expect(saveMonthSpy).toHaveBeenCalledWith(
      unscheduledMonth,
      expect.objectContaining({
        monthParticipants: expect.objectContaining({
          [unscheduledMonth]: ['p1', 'p2'],
        }),
      }),
    )

    // 5. Set p1 availability in that month (2026-11)
    saveMonthSpy.mockClear()
    store.setPersonAvailability('p1', unscheduledMonth, [1, 10], {
      [newShift.id]: [1, 10],
    })
    expect(saveMonthSpy).toHaveBeenCalledWith(
      unscheduledMonth,
      expect.objectContaining({
        availabilities: expect.arrayContaining([
          expect.objectContaining({
            personId: 'p1',
            month: unscheduledMonth,
            availableDays: [1, 10],
          }),
        ]),
      }),
    )
  })

  it('pullCloudData replaces the whole local schedule with the cloud data, removed days included', async () => {
    useScheduleStore.setState({
      assignments: { '2026-10-01': ['p1'], '2026-10-02': ['p1'] },
      savedAssignments: { '2026-10-01': ['p1'], '2026-10-02': ['p1'] },
      dayShiftAssignments: { '2026-10-02': { shift_d12: 'p1' } },
      savedDayShiftAssignments: { '2026-10-02': { shift_d12: 'p1' } },
    })
    vi.spyOn(CloudSyncService, 'pullAllFromCloud').mockResolvedValueOnce({
      status: 'ok',
      monthData: {
        assignments: { '2026-10-01': ['p1'] },
        monthParticipants: { '2026-11': ['p1'] },
        availabilities: [{ personId: 'p1', month: '2026-11', availableDays: [5, 15] }],
        monthDailyShifts: { '2026-11': { shift_d12: [5, 15] } },
      },
      persons: [{ id: 'p1', name: 'Dra. Helena', color: '#10b981' }],
      addresses: [],
      shifts: [],
      rules: [],
    })

    localStorage.setItem('scale_manager_cloud_sync_enabled', 'false')
    const res = await useScheduleStore.getState().pullCloudData(true)

    expect(res.success).toBe(true)
    // An on-demand pull never changes the sync toggle
    expect(localStorage.getItem('scale_manager_cloud_sync_enabled')).toBe('false')
    const state = useScheduleStore.getState()
    expect(state.assignments).toEqual({ '2026-10-01': ['p1'] })
    expect(state.savedAssignments).toEqual({ '2026-10-01': ['p1'] })
    expect(state.dayShiftAssignments).toEqual({})
    expect(state.monthParticipants).toEqual({ '2026-11': ['p1'] })
    expect(state.availabilities).toEqual([
      { personId: 'p1', month: '2026-11', availableDays: [5, 15] },
    ])
    expect(state.monthDailyShifts['2026-11']).toEqual({ shift_d12: [5, 15] })
  })

  it('keeps the local data when the pull fails while offline', async () => {
    vi.spyOn(CloudSyncService, 'pullAllFromCloud').mockResolvedValueOnce({
      status: 'offline',
      monthData: null,
      persons: null,
      addresses: null,
      shifts: null,
      rules: null,
    })

    const res = await useScheduleStore.getState().pullCloudData(true)

    expect(res).toEqual(expect.objectContaining({ success: false, code: 'offline' }))
    expect(useScheduleStore.getState().persons).toEqual([
      { id: 'p1', name: 'Dr. Teste', color: '#1d4ed8' },
    ])
  })

  it('does not force-push while offline', async () => {
    const pushSpy = vi.spyOn(CloudSyncService, 'pushAllToCloud')
    pushSpy.mockClear()
    vi.spyOn(CloudSyncService, 'isOnline').mockReturnValueOnce(false)

    const res = await useScheduleStore.getState().forcePushCloudData(true)

    expect(res).toEqual(expect.objectContaining({ success: false, code: 'offline' }))
    expect(pushSpy).not.toHaveBeenCalled()
  })

  it('never sends the edit mode draft to the cloud when auto-syncing', () => {
    CloudSyncService.setSyncEnabled(true)
    const saveMonthSpy = vi.spyOn(CloudSyncService, 'saveMonthToCloud').mockResolvedValue(true)
    useScheduleStore.setState({
      assignments: { '2026-10-01': ['p1'] },
      savedAssignments: { '2026-10-01': ['p1'] },
    })

    const store = useScheduleStore.getState()
    store.setEditMode(true)
    store.addPersonToDay('2026-10-02', 'p1')
    store.addEvent({ date: '2026-10-03', title: 'Reunião' })

    expect(saveMonthSpy).toHaveBeenCalledWith(
      '2026-10',
      expect.objectContaining({ assignments: { '2026-10-01': ['p1'] } }),
    )
    expect(useScheduleStore.getState().assignments['2026-10-02']).toEqual(['p1'])
  })

  it('removes the person from the month in the draft and the saved schedule, without persisting the draft', () => {
    useScheduleStore.setState({
      assignments: { '2026-10-01': ['p1'] },
      savedAssignments: { '2026-10-01': ['p1'] },
    })

    const store = useScheduleStore.getState()
    store.setEditMode(true)
    store.addPersonToDay('2026-10-05', 'p2')
    store.removePersonFromMonth('p1', '2026-10')

    const state = useScheduleStore.getState()
    expect(state.assignments).toEqual({ '2026-10-01': [], '2026-10-05': ['p2'] })
    expect(state.savedAssignments).toEqual({ '2026-10-01': [] })
    expect(JSON.parse(localStorage.getItem('scale_manager_assignments_v1') ?? '{}')).toEqual({
      '2026-10-01': [],
    })
  })
  it('shows a success toast on local save, and no toast for schedule violations', async () => {
    useToastStore.setState({ toasts: [] })
    // Days with nobody assigned produce validation violations
    await useScheduleStore.getState().saveSchedule()

    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({ type: 'success', message: 'Escala salva neste dispositivo.' }),
    ])
    expect(useScheduleStore.getState().isSaving).toBe(false)
  })

  it('shows an error toast when the local save works but the cloud fails', async () => {
    useToastStore.setState({ toasts: [] })
    CloudSyncService.setSyncEnabled(true)
    vi.spyOn(CloudSyncService, 'saveMonthsToCloud').mockResolvedValueOnce(false)
    vi.spyOn(CloudSyncService, 'savePeopleToCloud').mockResolvedValueOnce(true)
    vi.spyOn(CloudSyncService, 'saveAddressesToCloud').mockResolvedValueOnce(true)
    vi.spyOn(CloudSyncService, 'saveShiftsToCloud').mockResolvedValueOnce(true)
    vi.spyOn(CloudSyncService, 'saveRulesToCloud').mockResolvedValueOnce(true)

    await useScheduleStore.getState().saveSchedule()

    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({
        type: 'error',
        message: 'Escala salva neste dispositivo, mas não foi possível sincronizar com a nuvem.',
      }),
    ])
  })

  it('creates, updates and deletes daily expenses with offline-first persistence and cloud sync', async () => {
    CloudSyncService.setSyncEnabled(true)
    const saveMonthSpy = vi.spyOn(CloudSyncService, 'saveMonthToCloud').mockResolvedValue(true)

    useScheduleStore.setState({ expenses: [] })

    // 1. Add expense
    const created = await useScheduleStore.getState().addExpense({
      date: '2026-10-15',
      description: 'Medicamentos Farmácia',
      amount: 120.5,
      personId: 'p1',
      category: 'MEDICATION',
    })

    expect(created.id).toBeDefined()
    expect(created.description).toBe('Medicamentos Farmácia')
    expect(useScheduleStore.getState().expenses).toHaveLength(1)
    expect(StorageService.getExpenses()).toHaveLength(1)
    expect(saveMonthSpy).toHaveBeenCalledWith('2026-10', expect.objectContaining({
      expenses: expect.arrayContaining([expect.objectContaining({ id: created.id, amount: 120.5 })]),
    }))

    // 2. Update expense
    await useScheduleStore.getState().updateExpense(created.id, {
      amount: 150.0,
      description: 'Medicamentos Farmácia e Curativos',
    })

    const updatedExpense = useScheduleStore.getState().expenses.find((e) => e.id === created.id)
    expect(updatedExpense?.amount).toBe(150.0)
    expect(updatedExpense?.description).toBe('Medicamentos Farmácia e Curativos')
    expect(StorageService.getExpenses()[0].amount).toBe(150.0)

    // 3. Delete expense
    await useScheduleStore.getState().deleteExpense(created.id)
    expect(useScheduleStore.getState().expenses).toHaveLength(0)
    expect(StorageService.getExpenses()).toHaveLength(0)
  })
})

