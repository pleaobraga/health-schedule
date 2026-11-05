# Foto do mês: cadastros não alteram meses passados

Data: 2026-11-05
Status: implementado

## 1. Objetivo

Garantir que editar ou excluir pessoas, turnos e regras não mude o que um mês passado mostra: calendário, tela cheia, pagamentos, auditoria e Excel.

Mês passado é qualquer mês anterior ao atual (`month < getCurrentMonth()`). Editar diretamente um mês passado continua permitido.

## 2. Limite deste trabalho

- Sem mudança visual e sem textos novos.
- As telas de cadastro continuam mostrando os dados atuais.
- Endereços e valores de plantão não mudam, pois já ficam guardados no evento e no mês.
- O mês atual e os futuros continuam usando os cadastros atuais.
- A funcionalidade de compras é tratada em outra especificação.
- Alterações feitas antes desta entrega não podem ser desfeitas. A proteção vale a partir da primeira mudança de cadastro depois dela.

## 3. Modelo

Em `src/types/index.ts`:

```ts
export interface MonthRegistrySnapshot {
  capturedAt: string
  persons: Person[]
  shiftDefinitions: ShiftDefinition[]
  shiftRules: ShiftRule[]
  activeShiftIds: string[]
  activeRuleIds: string[]
}
```

Novo estado no store: `monthSnapshots: Record<string, MonthRegistrySnapshot>`, por mês `YYYY-MM`.

`activeShiftIds` e `activeRuleIds` existem porque um mês sem lista explícita herda turnos e regras com `enabledByDefault`. Sem isso, um turno novo apareceria em meses passados.

## 4. Captura

A captura roda antes de gravar a mudança, nestas ações: `updatePerson`, `deletePerson`, `deactivatePerson`, `reactivatePerson`, `updateShiftDefinition`, `deleteShiftDefinition`, `updateShiftRule` e `deleteShiftRule`.

Ações que só acrescentam cadastro (`addPerson`, `addShiftDefinition`, `addShiftRule`, duplicações) também capturam, porque um turno ou regra novo com `enabledByDefault` mudaria a herança dos meses passados. `addPerson` captura para manter o comportamento uniforme.

Para cada mês passado com dados, segundo `getMonthsInScheduleData`:

- **Sem foto:** cria a foto com os cadastros atuais e os ids ativos calculados por `getActiveShiftIds` e `getActiveRuleIds`.
- **Com foto:** acrescenta registros citados pelo mês que faltem na foto. Nunca sobrescreve um registro já guardado.

Registros citados pelo mês são pessoas em `assignments`, `dayShiftAssignments`, `monthParticipants`, `availabilities`, `events` e `expenses`, e turnos em `dayShiftAssignments`, `monthDailyShifts` e `monthActiveShifts`. Regras citadas são as de `monthActiveRules`.

Depois de capturar, grava no storage e, com a sincronização ligada, envia os meses alterados à nuvem.

Um mês fica congelado com os cadastros da primeira mudança feita depois do fim dele. Até essa mudança, os dados atuais são iguais aos do mês.

## 5. Leitura

Arquivo novo `src/utils/month-registry.ts`, com função pura:

```ts
export interface MonthRegistry {
  persons: Person[]
  shiftDefinitions: ShiftDefinition[]
  shiftRules: ShiftRule[]
}

export function getMonthRegistry(input: {
  month: string
  today: string // 'YYYY-MM'
  snapshot?: MonthRegistrySnapshot
  persons: Person[]
  shiftDefinitions: ShiftDefinition[]
  shiftRules: ShiftRule[]
  referencedIds: { personIds: string[]; shiftIds: string[]; ruleIds: string[] }
}): MonthRegistry
```

- Mês atual, mês futuro ou mês sem foto: devolve os cadastros atuais.
- Mês passado com foto: devolve os registros da foto, mais registros atuais citados pelo mês que faltem nela.

O segundo caso cobre a edição direta: ao escalar em outubro alguém que não estava na foto, a pessoa aparece com os dados atuais até a próxima captura, que a inclui na foto.

O store expõe `getRegistryForMonth(month)`, que os componentes chamam com o mês exibido.

## 6. Pontos que passam a usar a foto

Ações do store:

- `getActiveShiftIds` e `getActiveRuleIds`: lista explícita, depois foto, depois herança
- `getDayActiveShifts`
- `validateCurrentSchedule`

Componentes, trocando os cadastros do store pelo registro do mês exibido:

- `calendar-grid.tsx`, incluindo os dados passados para `DayCell` e para `exportScheduleToExcel`
- `day-cell.tsx`
- `fullscreen-calendar-modal.tsx`
- `month-payments-modal.tsx`
- `schedule-audit-modal.tsx`
- `day-violations-modal.tsx`
- `day-events-modal.tsx`, para exibir registros já salvos
- `sidebar.tsx`, para o painel do mês
- `month-shift-config-modal.tsx`

As listas de adicionar ao mês continuam oferecendo os cadastros atuais. No modal do dia e na configuração de turnos, os registros do mês vêm primeiro, seguidos dos cadastros atuais que ainda podem ser escolhidos. `candidate-picker.tsx` passa a usar `getActiveShiftIds`.

## 7. Exclusão de pessoa

`deletePerson` hoje remove disponibilidades, participação e escalas em todos os meses. Passa a remover apenas do mês atual em diante, preservando meses passados. Isso mantém os valores de plantão usados nos pagamentos passados.

## 8. Persistência e nuvem

- Storage: chave `scale_manager_month_snapshots_v1`, leitura, gravação, `resetToDefault`, `getCurrentDataset` e `restoreDataset`.
- `GuestDataset.monthSnapshots?` e `AppDataSnapshot.monthSnapshots?`.
- Backup: exportar, normalizar e restaurar. No merge, a foto local do mês vence, pois é a mais antiga.
- Store: estado inicial, `reloadFromStorage`, `clearAllLocalData`, `pullCloudData`, `saveSchedule` e `buildMonthCloudPayload`.
- Nuvem: campo `monthSnapshots` em `MonthScheduleData`, tratado em `getMonthsInScheduleData`, `sliceMonthScheduleData`, `replaceMonthScheduleData`, `mergeMonthDocs` e `toMonthScheduleDoc`. Cada documento mensal leva só a foto daquele mês.
- `firestore.rules` não muda.

## 9. Testes

Testes novos em `src/utils/month-registry.test.ts`:

- Mês atual e futuro usam cadastros atuais, mesmo com foto
- Mês passado sem foto usa cadastros atuais
- Mês passado com foto usa os dados da foto
- Registro citado e ausente da foto vem dos cadastros atuais
- Registro novo e não citado não aparece

Testes do store, com datas fixas:

- Renomear pessoa não muda o nome em mês passado e muda no mês atual
- Editar duração de turno não muda a validação de mês passado
- Excluir turno mantém o turno nos dias do mês passado
- Editar e excluir regra não muda a auditoria de mês passado
- Turno novo com `enabledByDefault` não entra em mês passado sem lista explícita
- Segunda mudança não sobrescreve a foto já criada
- Excluir pessoa mantém disponibilidade e participação de mês passado e remove as do mês atual
- Edição direta em mês passado continua funcionando

Testes de persistência:

- Storage, dataset, backup e merge
- Nuvem: cada documento mensal leva só a própria foto, e o pull restaura as fotos

Testes de componente:

- Pagamentos e calendário mostram o nome antigo em mês passado depois de renomear
- Excel de mês passado usa o nome antigo

## 10. Critérios de aceite

- `pnpm validate` e `pnpm build` passam
- Nenhuma mudança visual
- Renomear, editar ou excluir pessoa, turno ou regra não altera mês passado nas telas e no Excel
- Mês atual e futuro continuam refletindo os cadastros atuais
- `PROJECT_CONTEXT.md` e `CLAUDE.md` descrevem a foto do mês
