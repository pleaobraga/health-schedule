import type { ShiftDefinition, ShiftRule } from './scheduleConfig'

export interface Person {
  id: string;
  name: string;
  color: string; // Tailwind hex code
  active?: boolean; // Defaults to true
  [key: string]: unknown;
}

export interface MonthlyAvailability {
  personId: string;
  month: string; // 'YYYY-MM'
  availableDays: number[]; // 1 to 31
  shiftAvailability?: Record<string, number[]>; // shiftId -> available days for this specific shift
  shiftRates?: Record<string, Record<number, number>>; // shiftId -> dayNumber -> rate in R$
}

export interface DayAssignment {
  date: string; // 'YYYY-MM-DD'
  personId?: string; // Definitive assigned person
  personIds?: string[]; // In draft/edit mode, can have multiple or empty
}

export interface Address {
  id: string
  name: string // Nome / Identificação do endereço (ex: Residência Principal, Clínica Sul)
  street: string // Logradouro (Rua, Avenida, etc.)
  number: string // Número
  complement?: string // Complemento (Apto, Bloco, etc.)
  neighborhood?: string // Bairro
  city?: string // Cidade
}

export interface CalendarEvent {
  id: string
  date: string // 'YYYY-MM-DD'
  title: string
  time?: string // 'HH:mm'
  description?: string
  address?: string // Endereço do evento (opcional, texto multi-linha)
  addressId?: string // ID do endereço cadastrado (opcional)
  personId?: string // Cuidadora / Profissional associada ao evento
}

export type DailyExpenseCategory = 'MEDICATION' | 'TRANSPORT' | 'SUPPLIES' | 'OTHER'

export interface DailyExpense {
  id: string
  date: string // 'YYYY-MM-DD'
  description: string // Motivo do gasto (ex: "Farmácia", "Alimentação")
  amount: number // Valor monetário em reais
  personId?: string // ID opcional do profissional (para fins de reembolso direto)
  category?: DailyExpenseCategory
  createdAt: string
  updatedAt: string
}

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationError {
  id: string;
  rule: 'consecutive_days' | 'weekly_limit' | 'multi_assigned' | 'empty_day' | 'not_available' | (string & {});
  severity: ValidationSeverity;
  date: string; // 'YYYY-MM-DD'
  personId?: string;
  personName?: string;
  message: string;
}

export type MonthParticipants = Record<string, string[]>; // 'YYYY-MM' -> personId[]
export type NavigationTab =
  | 'calendar'
  | 'people'
  | 'shifts'
  | 'rules'
  | 'addresses'
  | 'import'
  | 'settings'
  | 'users';

export interface AppDataSnapshot {
  exportedAt: string; // ISO timestamp of export time
  people: Array<Person | (Person & { [key: string]: unknown })>;
  monthParticipants: Record<string, string[]>; // 'YYYY-MM' -> array of personId
  availabilities: Record<string, unknown> | MonthlyAvailability[]; // Monthly availability mapping for each person
  assignments: Record<string, unknown>; // Schedule assignments and daily allocations
  events: Array<CalendarEvent | (CalendarEvent & { [key: string]: unknown })>;
  expenses?: Array<DailyExpense | (DailyExpense & { [key: string]: unknown })>;
  addresses?: Address[];
  shiftDefinitions?: ShiftDefinition[];
  shiftRules?: ShiftRule[];
  monthActiveShifts?: Record<string, string[]>;
  monthActiveRules?: Record<string, string[]>;
  monthDailyShifts?: Record<string, Record<string, number[]>>;
  dayShiftAssignments?: Record<string, Record<string, string>>;
  theme?: string;
  [key: string]: unknown; // Extensible for global settings, themes, or future properties
}

export interface GuestProfile {
  id: string;
  name: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface GuestDataset {
  persons: Person[];
  availabilities: MonthlyAvailability[];
  assignments: Record<string, string[]>;
  events: CalendarEvent[];
  expenses?: DailyExpense[];
  monthParticipants: Record<string, string[]>;
  addresses?: Address[];
  shiftDefinitions?: ShiftDefinition[];
  shiftRules?: ShiftRule[];
  monthActiveShifts?: Record<string, string[]>;
  monthActiveRules?: Record<string, string[]>;
  monthDailyShifts?: Record<string, Record<string, number[]>>;
  dayShiftAssignments?: Record<string, Record<string, string>>;
}

export * from './scheduleConfig'

