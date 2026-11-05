# Plano de implementação: compras com itens e histórico de recompra

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar o gasto diário em uma compra com vários itens, com rota própria `/compras` e histórico de recompra por item.

**Architecture:** `DailyExpense` ganha `items`, e um cadastro global `expenseItems` é preenchido automaticamente. Regras e cálculos ficam em funções puras em `src/utils/expense-item-utils.ts`. O store persiste, sincroniza e expõe as ações, e a interface só consome esse contrato.

**Tech Stack:** React 19, TypeScript strict, Zustand 5, Tailwind 4, i18next, date-fns 4, Vitest, Testing Library, Storybook 10, Firebase 13.

**Spec:** `docs/superpowers/specs/2026-11-05-expense-purchases-design.md`. Leia a especificação inteira antes da Task 1. Leia também `CLAUDE.md`, em especial "Adding a persisted field" e "History rule".

## Global Constraints

- Date fields always use `DatePicker` from `src/components/ui/date-picker.tsx`, the shadcn date picker (`Popover` + `Calendar`, built on `radix-ui` and `react-day-picker`). Never use a native `type="date"` or write another calendar; ESLint blocks native date inputs everywhere except that file.
- Time fields use the native `<input type="time">` with the same classes as the day events field in `day-events-modal.tsx`.
- Trabalhe na branch `main`, sem criar branch nova, com um commit por task. Não faça push: o usuário fará o push no final.
- Antes de cada commit, `pnpm typecheck` e os testes tocados precisam passar.
- Toda mudança de comportamento segue TDD: teste falhando primeiro.
- Sem `any`, sem default export, sem ponto e vírgula, com `import type` para tipos.
- Sem texto fixo na interface. Toda chave nova existe em `pt-BR` e `en-US`.
- Todo componente novo tem `.stories.tsx`, variantes `dark:*` e funciona em telas de até 640px sem rolagem horizontal.
- Mudança de cadastro não pode alterar meses passados. Telas leem pessoas por `getRegistryForMonth(month)`, e compras mostram `itemName` e `personName` salvos.
- Mudança em célula do calendário vale para `day-cell.tsx` e `fullscreen-calendar-modal.tsx`.
- Não incluir gastos no Excel. Não criar campo de unidade, previsão de compra nem exclusão de item.
- Aparência, layout, ícones e textos ficam a seu critério. O plano fixa comportamento e nomes de código.

## Review Focus

1. **Ciclo em `mergedIntoId`** vindo de backup ou da nuvem (A → B, B → A): a resolução termina e não trava a tela. Teste na Task 2.
2. **Cadastro ausente depois de um pull:** uma linha aponta para `itemId` que não existe em `expenseItems`. A linha continua exibindo `itemName`, e o histórico funciona pelo id. Teste na Task 3.
3. **Data da compra vazia ou inválida** enquanto o formulário é preenchido: `searchExpenseItems` e `getItemLastPurchase` devolvem datas e dias nulos, sem `NaN` nem exceção. Teste na Task 3.
4. **Arredondamento de centavos:** linhas de 0,10 e 0,20 com total 0,30 têm `difference` igual a 0, não `-5.55e-17`. Teste na Task 4.
5. **Quantidade digitada com vírgula**, como `1,5`: a interface converte com `parseNumericRate` antes de chamar o store. Teste na Task 9.

---

### Task 1: Tipos e gasto com `items`

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/store/use-schedule-store.ts`
- Modify (fixtures, com `items: []`): `src/store/use-schedule-store.test.ts`, `src/utils/shift-rate-utils.test.ts`, `src/utils/month-registry.test.ts`, `src/components/modals/month-payments-modal.test.tsx`, `src/services/storage-service.test.ts`, `src/components/modals/day-events-modal.test.tsx`, `src/components/calendar/day-cell.test.tsx`

**Interfaces:**
- Produces: `ExpenseItem`, `ExpenseLine`, `ExpenseLineInput`, `ExpenseInput`, `ExpenseUpdateInput` e `DailyExpense.items`, `DailyExpense.personName`, exatamente como na seção 5 da especificação.

- [ ] **Step 1: Escreva o teste em `src/store/use-schedule-store.test.ts`**

```ts
it('saves an expense without lines using an empty items list', async () => {
  const expense = await useScheduleStore.getState().addExpense({
    date: '2026-10-15',
    description: 'Mercado',
    amount: 50,
  })

  expect(expense.items).toEqual([])
})
```

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/store/use-schedule-store.test.ts -t 'empty items list'`
Expected: FAIL, com `expense.items` igual a `undefined`.

- [ ] **Step 3: Adicione os tipos da seção 5 da especificação em `src/types/index.ts`**

`ExpenseInput` e `ExpenseUpdateInput` são os da especificação. Atualize `GuestDataset` e `AppDataSnapshot` só na Task 5.

- [ ] **Step 4: Faça `addExpense` receber `ExpenseInput`**

Nesta task, descarte `input.items` e salve `items: []`, mantendo o retorno atual. `updateExpense` fica como está até a Task 6.

- [ ] **Step 5: Adicione `items: []` às fixtures listadas**

Run: `pnpm typecheck`
Expected: sem erros.

- [ ] **Step 6: Rode os testes afetados**

Run: `pnpm test:run`
Expected: PASS em todos.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(expenses): add items to the expense model"
```

### Task 2: Nomes e cadeia de itens juntados

**Files:**
- Create: `src/utils/expense-item-utils.ts`
- Create: `src/utils/expense-item-utils.test.ts`

**Interfaces:**
- Consumes: `ExpenseItem`.
- Produces:
  - `normalizeItemName(name: string): string`
  - `findExpenseItemByName(name: string, items: ExpenseItem[]): ExpenseItem | undefined`
  - `resolveExpenseItemId(itemId: string, items: ExpenseItem[]): string`
  - `getMergedItemIds(itemId: string, items: ExpenseItem[]): string[]`

- [ ] **Step 1: Escreva os testes**

```ts
const item = (id: string, name: string, mergedIntoId?: string): ExpenseItem => ({
  id, name, mergedIntoId, createdAt: '2026-01-01', updatedAt: '2026-01-01',
})

it.each([
  ['  Fralda   G ', 'fralda g'],
  ['LENÇO', 'lenco'],
  ['Água', 'agua'],
])('normalizes %s', (input, expected) => {
  expect(normalizeItemName(input)).toBe(expected)
})

it('finds an item ignoring case, accents and spaces', () => {
  expect(findExpenseItemByName(' lenco ', [item('a', 'Lenço')])?.id).toBe('a')
})

it('finds a merged item by its old name', () => {
  const items = [item('a', 'Fraldas', 'b'), item('b', 'Fralda')]
  expect(findExpenseItemByName('fraldas', items)?.id).toBe('a')
})

it('follows a merge chain to the final item', () => {
  const items = [item('a', 'A', 'b'), item('b', 'B', 'c'), item('c', 'C')]
  expect(resolveExpenseItemId('a', items)).toBe('c')
})

it('returns the same id for an unknown item', () => {
  expect(resolveExpenseItemId('x', [])).toBe('x')
  expect(getMergedItemIds('x', [])).toEqual(['x'])
})

it('lists an item and every item that leads to it', () => {
  const items = [item('a', 'A', 'b'), item('b', 'B', 'c'), item('c', 'C'), item('d', 'D')]
  expect([...getMergedItemIds('c', items)].sort()).toEqual(['a', 'b', 'c'])
})

it('ends on a merge cycle', () => {
  const items = [item('a', 'A', 'b'), item('b', 'B', 'a')]
  expect(['a', 'b']).toContain(resolveExpenseItemId('a', items))
  expect([...getMergedItemIds('a', items)].sort()).toEqual(['a', 'b'])
})
```

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/utils/expense-item-utils.test.ts`
Expected: FAIL, porque o módulo não existe.

- [ ] **Step 3: Implemente as quatro funções**

Normalização conforme a seção 6.11 da especificação. `resolveExpenseItemId` e `getMergedItemIds` usam um `Set` de ids visitados para terminar em ciclos. `getMergedItemIds` não resolve o id recebido: quem chama passa o id final.

- [ ] **Step 4: Rode e confirme que passa**

Run: `pnpm vitest run src/utils/expense-item-utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/expense-item-utils.ts src/utils/expense-item-utils.test.ts
git commit -m "feat(expenses): add item name and merge helpers"
```

### Task 3: Última compra, busca e histórico

**Files:**
- Modify: `src/utils/expense-item-utils.ts`
- Modify: `src/utils/expense-item-utils.test.ts`

**Interfaces:**
- Consumes: funções da Task 2.
- Produces, com os tipos da seção 7 da especificação:
  - `ITEM_SEARCH_MIN_LENGTH = 3`, `ITEM_SEARCH_MAX_RESULTS = 4`
  - `getItemLastPurchase(itemId, items, expenses, options): ItemLastPurchase`
  - `searchExpenseItems(query, items, expenses, options): ExpenseItemSuggestion[]`
  - `getItemHistory(itemId, items, expenses, { mode, today }): ItemHistory`

- [ ] **Step 1: Escreva os testes**

Crie um helper `purchase(id, date, itemIds)` que monte um `DailyExpense` com uma linha para cada id.

```ts
describe('getItemLastPurchase', () => {
  const expenses = [
    purchase('e1', '2026-10-20', ['a']),
    purchase('e2', '2026-11-01', ['a']),
    purchase('e3', '2026-11-20', ['a']),
  ]
  const items = [item('a', 'Fralda')]

  it('counts days to the most recent earlier purchase', () => {
    expect(getItemLastPurchase('a', items, expenses, { referenceDate: '2026-11-01', excludeExpenseId: 'e2' }))
      .toEqual({ lastPurchaseDate: '2026-10-20', daysSinceLastPurchase: 12 })
  })

  it('ignores purchases on or after the reference date', () => {
    expect(getItemLastPurchase('a', items, expenses, { referenceDate: '2026-10-20' }))
      .toEqual({ lastPurchaseDate: null, daysSinceLastPurchase: null })
  })

  it('counts purchases of merged items', () => {
    const merged = [item('a', 'Fraldas', 'b'), item('b', 'Fralda')]
    expect(getItemLastPurchase('b', merged, expenses, { referenceDate: '2026-11-02' }).lastPurchaseDate)
      .toBe('2026-11-01')
  })

  it.each(['', 'invalida'])('returns nulls for the reference date "%s"', (referenceDate) => {
    expect(getItemLastPurchase('a', items, expenses, { referenceDate }))
      .toEqual({ lastPurchaseDate: null, daysSinceLastPurchase: null })
  })
})

describe('searchExpenseItems', () => {
  const options = { referenceDate: '2026-11-10' }

  it('returns nothing below 3 normalized characters', () => {
    expect(searchExpenseItems('  fr ', [item('a', 'Fralda')], [], options)).toEqual([])
  })

  it('matches anywhere in the name, ignoring accents', () => {
    const result = searchExpenseItems('lenc', [item('a', 'Pacote de Lenço')], [], options)
    expect(result.map((s) => s.item.id)).toEqual(['a'])
  })

  it('hides merged items', () => {
    const items = [item('a', 'Fraldas', 'b'), item('b', 'Fralda')]
    expect(searchExpenseItems('fral', items, [], options).map((s) => s.item.id)).toEqual(['b'])
  })

  it('orders by most recent purchase, limits to 4 and adds days', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map((id) => item(id, `Fralda ${id}`))
    const expenses = [purchase('e1', '2026-11-01', ['c']), purchase('e2', '2026-10-01', ['d'])]

    const result = searchExpenseItems('fralda', items, expenses, options)

    expect(result.map((s) => s.item.id)).toEqual(['c', 'd', 'a', 'b'])
    expect(result[0].daysSinceLastPurchase).toBe(9)
    expect(result[2].lastPurchaseDate).toBeNull()
  })
})

describe('getItemHistory', () => {
  const items = [item('a', 'Fralda')]
  const expenses = [
    purchase('e1', '2026-10-03', ['a']),
    purchase('e2', '2026-10-21', ['a']),
    purchase('e3', '2026-10-21', ['a']),
    purchase('e4', '2026-11-05', ['a']),
  ]

  it('returns every date with gaps in FULL mode', () => {
    expect(getItemHistory('a', items, expenses, { mode: 'FULL', today: '2026-11-10' })).toEqual({
      itemId: 'a',
      lastPurchaseDate: '2026-11-05',
      daysSinceLastPurchase: 5,
      averageIntervalDays: 16.5,
      entries: [
        { date: '2026-10-03', daysSincePrevious: null },
        { date: '2026-10-21', daysSincePrevious: 18 },
        { date: '2026-11-05', daysSincePrevious: 15 },
      ],
    })
  })

  it('returns only the latest entry in LAST mode, keeping the average', () => {
    const history = getItemHistory('a', items, expenses, { mode: 'LAST', today: '2026-11-10' })
    expect(history.entries).toEqual([{ date: '2026-11-05', daysSincePrevious: 15 }])
    expect(history.averageIntervalDays).toBe(16.5)
  })

  it('keeps working when the item is missing from the registry', () => {
    expect(getItemHistory('a', [], expenses, { mode: 'LAST', today: '2026-11-10' }).lastPurchaseDate)
      .toBe('2026-11-05')
  })

  it('crosses a year boundary', () => {
    const yearEnd = [purchase('e1', '2026-12-31', ['a']), purchase('e2', '2027-01-01', ['a'])]
    expect(getItemHistory('a', items, yearEnd, { mode: 'FULL', today: '2027-01-02' }).entries[1].daysSincePrevious)
      .toBe(1)
  })

  it('never reports negative days for a future purchase', () => {
    const future = [purchase('e1', '2026-12-01', ['a'])]
    expect(getItemHistory('a', items, future, { mode: 'LAST', today: '2026-11-10' }).daysSinceLastPurchase)
      .toBe(0)
  })

  it('returns nulls for an item with no purchases', () => {
    expect(getItemHistory('a', items, [], { mode: 'FULL', today: '2026-11-10' })).toEqual({
      itemId: 'a', lastPurchaseDate: null, daysSinceLastPurchase: null, averageIntervalDays: null, entries: [],
    })
  })
})
```

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/utils/expense-item-utils.test.ts`
Expected: FAIL, porque as funções não existem.

- [ ] **Step 3: Implemente as funções**

Siga as seções 6.1 a 6.3 da especificação. Use `parseISO`, `isValid` e `differenceInCalendarDays`, de `date-fns`. Cada função começa com `getMergedItemIds(resolveExpenseItemId(itemId, items), items)`. Compare datas como texto `YYYY-MM-DD`.

- [ ] **Step 4: Rode e confirme que passa**

Run: `pnpm vitest run src/utils/expense-item-utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/expense-item-utils.ts src/utils/expense-item-utils.test.ts
git commit -m "feat(expenses): add item search and purchase history"
```

### Task 4: Filtro, resumo, validação e resolução de linhas

**Files:**
- Modify: `src/utils/expense-item-utils.ts`
- Modify: `src/utils/expense-item-utils.test.ts`

**Interfaces:**
- Produces, com os tipos da seção 7 da especificação:
  - `createDefaultExpenseFilters(now?: Date): ExpenseFilters`
  - `filterExpenses(expenses, items, filters): DailyExpense[]`
  - `getExpenseLinesSummary(expense): ExpenseLinesSummary`
  - `validateExpenseInput(input, items): ExpenseValidationError[]`
  - Função interna, exportada para o store:

```ts
export function resolveExpenseLines(input: {
  lines: ExpenseLineInput[]
  items: ExpenseItem[]
  savedLines?: ExpenseLine[]
  now: string
  createId: () => string
}): { lines: ExpenseLine[]; items: ExpenseItem[] }
```

- [ ] **Step 1: Escreva os testes**

Cubra estes casos, com valores literais:

| Teste | Esperado |
| :--- | :--- |
| `filterExpenses` com `month: '2026-10'` e gastos de 09, 10 e 11 | Só o de outubro |
| `category`, `personId` e `itemId`, sozinhos e combinados | Combinam com E |
| `itemId` de item com outro juntado a ele | Inclui as compras do juntado |
| Gasto com `items: []` no mês | Aparece |
| Mesma data, `createdAt` diferente | `createdAt` mais recente primeiro; datas mais novas antes |
| `createDefaultExpenseFilters(new Date(2026, 10, 5))` | `{ month: '2026-11' }` |
| Resumo: linhas 30 e 20, total 45 | `{ subtotal: 50, allLinesHaveAmount: true, difference: -5 }` |
| Resumo: linha 30 e linha sem valor, total 45 | `{ subtotal: 30, allLinesHaveAmount: false, difference: null }` |
| Resumo: sem linhas | `{ subtotal: 0, allLinesHaveAmount: false, difference: null }` |
| Resumo: linhas 0.1 e 0.2, total 0.3 | `difference` igual a `0` |
| Validação de cada código da seção 6.5 | Código certo, com `lineIndex` nos erros de linha |
| Duas linhas com `name` igual a um item existente e o `itemId` dele | `DUPLICATE_ITEM` |
| Duas linhas `'Fralda'` e `' fralda '` | `DUPLICATE_ITEM` |
| Linha com `amount: 0` | Sem erros |
| `date: '2026-02-30'` | `DATE_INVALID` |
| `resolveExpenseLines` com nome novo | Cria o item uma vez, com nome `'Fralda G'` para a entrada `' Fralda   G '` |
| `resolveExpenseLines` com nome existente | Reaproveita, sem novo item |
| `resolveExpenseLines` com nome de item juntado | Usa o item de destino e o nome dele |
| `resolveExpenseLines` sem `quantity` | `quantity: 1` |
| Linha cujo `itemId` está em `savedLines` | Mantém o `itemName` salvo, mesmo com o cadastro renomeado |
| Linha nova ao editar | Usa o nome atual do cadastro |

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/utils/expense-item-utils.test.ts`
Expected: FAIL, porque as funções não existem.

- [ ] **Step 3: Implemente as funções**

Siga as seções 6.4, 6.5, 6.6 e 6.10 da especificação. Em `getExpenseLinesSummary`, arredonde com `Math.round(valor * 100) / 100`, inclusive a subtração, e normalize `-0` para `0`. `resolveExpenseLines` assume entrada já validada e não altera os arrays recebidos.

- [ ] **Step 4: Rode e confirme que passa**

Run: `pnpm vitest run src/utils/expense-item-utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/expense-item-utils.ts src/utils/expense-item-utils.test.ts
git commit -m "feat(expenses): add filters, summaries and validation"
```

### Task 5: Persistência do cadastro e correções de backup

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/services/storage-service.ts`, `src/services/storage-service.test.ts`
- Modify: `src/services/backup-service.ts`, `src/services/backup-service.spec.ts`
- Modify: `src/services/cloud-sync-service.ts`, `src/services/cloud-sync-service.spec.ts`
- Modify: `src/store/use-schedule-store.ts`

**Interfaces:**
- Produces:
  - `StorageService.getExpenseItems(): ExpenseItem[]`, `StorageService.saveExpenseItems(items: ExpenseItem[]): void`
  - `CloudSyncService.saveExpenseItemsToCloud(items, isAdmin?, ignoreSyncEnabled?): Promise<boolean>`
  - `CloudPullData.expenseItems: ExpenseItem[] | null`
  - Estado `expenseItems: ExpenseItem[]`

- [ ] **Step 1: Escreva os testes**

- `storage-service.test.ts`: salvar e ler; `resetToDefault` limpa; dataset preserva com `getCurrentDataset` e `restoreDataset`.
- `backup-service.spec.ts`:
  - Exportação inclui `expenseItems`.
  - `validateAndParseBackup` transforma valor que não é array em `[]`.
  - `restoreAppData` atualiza storage **e** `useScheduleStore.getState().expenses` e `expenseItems`.
  - `mergeAppData` combina por `id` e atualiza os dois no store.
  - Com a sincronização ligada, `forcePushCloudData` já recebe os gastos restaurados no store.
- `cloud-sync-service.spec.ts`:
  - `saveExpenseItemsToCloud` grava em `schedules/_master_expense_items` no campo `items`.
  - `pullAllFromCloud` devolve `expenseItems`, ou `null` sem o documento.
  - `pushAllToCloud` grava o cadastro quando ele é informado.
  - Linhas de `items` e `personName` chegam ao documento do mês por `sliceMonthScheduleData`.

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/services`
Expected: FAIL nos testes novos.

- [ ] **Step 3: Implemente conforme a seção 9 da especificação**

Pontos do store: estado inicial, `saveSchedule`, `pullCloudData`, `forcePushCloudData`, `reloadFromStorage`, `clearAllLocalData`. Em `pullCloudData`, grave o cadastro só quando `expenseItems` for array, como em `rules`. Em `saveSchedule`, inclua `saveExpenseItemsToCloud` no `Promise.all`.

Nos dois `setState` de `backup-service.ts`, inclua `expenses` e `expenseItems` antes do `forcePushCloudData`. Essa é a correção 2 da seção 11.

- [ ] **Step 4: Rode e confirme que passa**

Run: `pnpm typecheck && pnpm vitest run src/services src/store`
Expected: sem erros e PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(expenses): persist the item registry"
```

### Task 6: `addExpense` e `updateExpense` com linhas

**Files:**
- Create: `src/store/expense-items.test.ts`
- Modify: `src/store/use-schedule-store.ts`

**Interfaces:**
- Consumes: `validateExpenseInput`, `resolveExpenseLines`, `StorageService.saveExpenseItems`, `CloudSyncService.saveExpenseItemsToCloud`.
- Produces, exportados do store:

```ts
export type ExpenseActionResult =
  | { ok: true; expense: DailyExpense }
  | { ok: false; errors: ExpenseValidationError[] }

addExpense: (input: ExpenseInput) => Promise<ExpenseActionResult>
updateExpense: (expenseId: string, input: ExpenseUpdateInput) => Promise<ExpenseActionResult>
```

- [ ] **Step 1: Escreva os testes em `src/store/expense-items.test.ts`**

Use `vi.spyOn` em `CloudSyncService.isSyncEnabled` e `saveMonthToCloud` nos testes de sincronização. Casos:

| Teste | Esperado |
| :--- | :--- |
| `addExpense` com `{ name: 'Fralda', quantity: 2, amount: 30 }` | `ok: true`; cadastro com 1 item; linha com `itemId`, `itemName: 'Fralda'`, `quantity: 2`, `amount: 30` |
| Segunda compra com `name: ' fralda '` | Cadastro continua com 1 item |
| `addExpense` com `amount: 0` e nome novo | `ok: false` com `AMOUNT_INVALID`; cadastro e gastos vazios |
| `addExpense` com `personId: 'p1'` | `personName` igual ao nome de `p1` |
| `addExpense` sem `personId` | `personName` ausente |
| `updateExpense` só com `{ amount: 99 }` | Linhas iguais às salvas |
| `updateExpense` depois de renomear pessoa e item, sem trocar nada | `itemName` e `personName` antigos |
| `updateExpense` trocando `personId` para `p2` | `personName` do `p2` |
| `updateExpense` com `personId: undefined` | `personName` ausente |
| `updateExpense` com id inexistente | `ok: false` com `EXPENSE_NOT_FOUND` |
| Mudar a data de outubro para novembro com sincronização ligada | `saveMonthToCloud` chamado para `2026-10` e `2026-11` |
| Item novo com sincronização ligada | `saveExpenseItemsToCloud` chamado |
| Compra salva por `addExpense` depois de `reloadFromStorage` | Linhas e cadastro preservados |

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/store/expense-items.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implemente as duas ações**

Ordem em ambas: valide, resolva as linhas, grave `expenseItems` se mudou, grave `expenses`, atualize o estado, sincronize. Em `updateExpense`, combine a entrada com o gasto salvo antes de validar, convertendo as linhas salvas para `ExpenseLineInput` com `itemId`. `createId` gera `expitem_${Date.now()}_${random}`. Sincronize o mês antigo e o novo com um `Set`, conforme a correção 1 da seção 11.

O modal do dia ignora o retorno das duas ações nesta task.

- [ ] **Step 4: Rode e confirme que passa**

Run: `pnpm typecheck && pnpm test:run`
Expected: sem erros e PASS. Ajuste testes antigos que esperavam `addExpense` devolver o gasto diretamente, incluindo o teste da Task 1, que passa a ler `result.expense`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(expenses): save purchases with item lines"
```

### Task 7: Renomear e juntar itens

**Files:**
- Modify: `src/store/use-schedule-store.ts`
- Modify: `src/store/expense-items.test.ts`

**Interfaces:**
- Produces:

```ts
export type ExpenseItemActionCode = 'ITEM_NOT_FOUND' | 'NAME_REQUIRED' | 'NAME_CONFLICT' | 'SAME_ITEM'
export type ExpenseItemActionResult = { ok: true } | { ok: false; code: ExpenseItemActionCode }

renameExpenseItem: (itemId: string, name: string) => Promise<ExpenseItemActionResult>
mergeExpenseItems: (sourceId: string, targetId: string) => Promise<ExpenseItemActionResult>
```

- [ ] **Step 1: Escreva os testes**

Use `getCurrentMonth()` para o mês atual e `2020-01` como mês passado.

| Teste | Esperado |
| :--- | :--- |
| Renomear com compras em `2020-01` e no mês atual | Cadastro novo; mês atual com `itemName` novo; `2020-01` com o antigo |
| Renomear com compra em mês futuro | `itemName` novo |
| Renomear para `'  '` | `NAME_REQUIRED` |
| Renomear para o nome de outro item, mesmo juntado | `NAME_CONFLICT` |
| Renomear `'fralda'` para `'Fralda'` | `ok: true` |
| Renomear item inexistente ou já juntado | `ITEM_NOT_FOUND` |
| Compra futura depois de renomear | Busca encontra o nome novo |
| Juntar A em B | `A.mergedIntoId === 'B'`; `expenses` idêntico antes e depois |
| Juntar item nele mesmo | `SAME_ITEM` |
| Juntar item inexistente ou já juntado | `ITEM_NOT_FOUND` |
| Depois de juntar, `addExpense` com o nome de A | Linha com `itemId` de B e `itemName` de B |
| Editar compra antiga com linhas de A e B depois da junção | Sem `DUPLICATE_ITEM`; linhas preservadas |
| Sincronização ligada ao renomear | Cadastro e cada mês alterado sincronizados |
| Sincronização ligada ao juntar | Só o cadastro sincronizado |

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/store/expense-items.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implemente conforme as seções 6.7 e 6.8 da especificação**

Na comparação de `DUPLICATE_ITEM`, trate `itemId` de forma literal, sem resolver junções, para que compras antigas continuem editáveis.

- [ ] **Step 4: Rode e confirme que passa**

Run: `pnpm typecheck && pnpm vitest run src/store`
Expected: sem erros e PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(expenses): rename and merge items"
```

### Task 8: Rota `/compras` e lista de compras

**Files:**
- Create: `src/pages/purchases-view.tsx`, `src/pages/purchases-view.test.tsx`, `src/pages/purchases-view.stories.tsx`
- Create: `src/locales/pt-BR/purchases.json`, `src/locales/en-US/purchases.json`
- Modify: `src/i18n.ts`, `src/router/index.tsx`, `src/router/route-config.ts`, `src/router/router.test.tsx`
- Modify: `src/types/index.ts` (`NavigationTab` com `'purchases'`)
- Modify: `src/components/layout/root-layout.tsx`, `src/components/navigation/hover-sidebar.tsx`, `src/components/navigation/hover-sidebar.test.tsx`, `src/components/navigation/mobile-bottom-nav.tsx`
- Modify: `src/locales/pt-BR/common.json`, `src/locales/en-US/common.json` (`nav.purchases`, `navShort.purchases`)

**Interfaces:**
- Consumes: `filterExpenses`, `createDefaultExpenseFilters`, `getExpenseLinesSummary`, `expenseItems`, `expenses`.
- Produces: `export function PurchasesView()`, namespace i18n `purchases`, `NavigationTab` `'purchases'`.

- [ ] **Step 1: Escreva os testes**

Em `router.test.tsx`, no padrão do teste de `/pessoas`:

```tsx
it('renders the purchases screen on "/compras"', async () => {
  vi.spyOn(backupService, 'hasExistingLocalData').mockResolvedValue(true)

  render(<TestAppRouter initialEntries={['/compras']} />)

  expect(screen.getByTestId('purchases-view')).toBeInTheDocument()
  expect(useScheduleStore.getState().currentView).toBe('purchases')
})
```

Em `purchases-view.test.tsx`:
- Abre no mês atual, sem listar compras de outro mês.
- Mudar o mês da área não altera `useScheduleStore.getState().currentMonth`.
- Filtros de categoria, profissional e item reduzem a lista.
- Gasto sem itens aparece.
- Compra mostra `itemName`, quantidade e total, em cada linha.
- Compra com total diferente da soma dos itens expõe a diferença.
- A navegação do menu leva a `/compras`.

Em `hover-sidebar.test.tsx`:
- A barra inferior (`mobile-bottom-nav`) mostra Escala, Compras e o botão "Mais", sem Pessoas, Turnos e Ajustes.
- O menu aberto por "Mais" continua listando Pessoas, Turnos, Configurações e as demais telas.

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/pages/purchases-view.test.tsx src/router/router.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implemente a rota, a navegação e a tela**

Rota `compras` dentro de `RootLayout`, protegida por `PrivateRoute`. Em `root-layout.tsx`, `path.startsWith('/compras')` chama `setCurrentView('purchases')`. O item usa `t('nav.purchases')` em `navItems`, no `hover-sidebar.tsx`. Em `bottomNavItems`, deixe apenas calendário e compras, com `t('common:navShort.purchases')`, removendo pessoas, turnos e configurações, que seguem acessíveis por "Mais". Em `mobile-bottom-nav.tsx`, troque `grid-cols-5` por `grid-cols-3`. A feature de medicamentos acrescentará o terceiro item depois. O filtro de mês é estado local da tela, iniciado por `createDefaultExpenseFilters()`.

- [ ] **Step 4: Rode e confirme que passa**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run src/pages src/router`
Expected: sem erros e PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(purchases): add the purchases route and list"
```

### Task 9: Cadastrar e editar compras

**Files:**
- Create: `src/components/purchases/purchase-form.tsx`, `.test.tsx`, `.stories.tsx`
- Modify: `src/pages/purchases-view.tsx`
- Modify: `src/locales/pt-BR/purchases.json`, `src/locales/en-US/purchases.json`

**Interfaces:**
- Consumes: `addExpense`, `updateExpense`, `deleteExpense`, `searchExpenseItems`, `getItemLastPurchase`, `findExpenseItemByName`, `validateExpenseInput`, `parseNumericRate`.
- Produces: `export function PurchaseForm({ expense, onClose }: PurchaseFormProps)`, com `interface PurchaseFormProps { expense?: DailyExpense; onClose: () => void }`.

- [ ] **Step 1: Escreva os testes**

- Salvar com data, nome, total, categoria, profissional e dois itens cria uma compra com duas linhas.
- Salvar sem itens funciona.
- Profissional e categoria são opcionais: salvar sem eles cria uma compra sem `personId`, sem `personName` e sem `category`, que entra no fechamento como despesa geral.
- Com 2 letras não há sugestão; com 3 há; nunca há mais de 4.
- Escolher uma sugestão usa o `itemId` dela.
- Digitar um nome novo cria o item, que aparece na próxima busca.
- Item adicionado mostra a data da última compra e os dias decorridos, contados até a data da compra.
- Mudar a data da compra recalcula esses dias.
- Item novo fica sem data e sem dias.
- Editar não compara o item com a própria compra.
- Quantidade `1,5` é salva como `1.5`, e `amount` da linha `10,50` como `10.5`.
- Quantidade vazia é salva como 1.
- Erros devolvidos por `validateExpenseInput` aparecem traduzidos, e nada é salvo.
- Mesmo item duas vezes mostra o erro de duplicado.
- Total diferente da soma dos itens não bloqueia.
- Editar uma compra mantém `itemName` salvo, mesmo com o item renomeado.
- Excluir remove a compra e mantém o item na busca.

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/components/purchases`
Expected: FAIL.

- [ ] **Step 3: Implemente `PurchaseForm` e ligue à tela**

`referenceDate` é a data no formulário, e `excludeExpenseId` é `expense?.id`. Mostre os erros por `code` e `lineIndex`, com chaves em `purchases.errors.*`. A lista de profissionais usa `getRegistryForMonth(mês da data).persons` mais as pessoas ativas atuais que faltarem, como em `day-events-modal.tsx`.

- [ ] **Step 4: Rode e confirme que passa**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run src/components/purchases src/pages`
Expected: sem erros e PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(purchases): add the purchase form"
```

### Task 10: Histórico do item e manutenção do cadastro

**Files:**
- Create: `src/components/purchases/item-history.tsx`, `.test.tsx`, `.stories.tsx`
- Create: `src/components/purchases/item-maintenance.tsx`, `.test.tsx`, `.stories.tsx`
- Modify: `src/pages/purchases-view.tsx`
- Modify: `src/locales/pt-BR/purchases.json`, `src/locales/en-US/purchases.json`

**Interfaces:**
- Consumes: `getItemHistory`, `renameExpenseItem`, `mergeExpenseItems`.
- Produces: `export function ItemHistory({ itemId }: ItemHistoryProps)`, `export function ItemMaintenance({ item, onClose }: ItemMaintenanceProps)`, com `item: ExpenseItem`. `ItemHistoryProps` recebe só `itemId: string`, e o `today` vem de `format(new Date(), 'yyyy-MM-dd')`.

- [ ] **Step 1: Escreva os testes**

- Modo inicial mostra a última compra e os dias até hoje.
- A opção de histórico completo lista as datas e os dias entre elas. Com compras em `2026-10-01` e `2026-11-02`, mostra 32 dias.
- O histórico mostra compras de todos os meses, mesmo com o filtro em outro mês.
- A lista expõe a última compra de cada item.
- Item com uma compra não mostra intervalo; item sem compra não quebra.
- Renomear mostra erro traduzido para `NAME_CONFLICT` e `NAME_REQUIRED`.
- Juntar pede confirmação e, depois, o item some da busca e o histórico soma as compras.
- As datas seguem o idioma ativo, com `formatDisplayDate`.

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/components/purchases`
Expected: FAIL.

- [ ] **Step 3: Implemente e ligue à tela**

Use `ConfirmDialog` de `src/components/common/confirm-dialog.tsx` na confirmação de juntar.

- [ ] **Step 4: Rode e confirme que passa**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run src/components/purchases src/pages`
Expected: sem erros e PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(purchases): add item history and maintenance"
```

### Task 11: Calendário, modal do dia e fechamento

**Files:**
- Modify: `src/components/modals/day-events-modal.tsx`, `.test.tsx`
- Modify: `src/components/calendar/day-cell.tsx`, `.test.tsx`
- Modify: `src/components/modals/fullscreen-calendar-modal.tsx`, `.test.tsx`
- Modify: `src/components/modals/month-payments-modal.tsx`, `.test.tsx`
- Modify: `src/locales/pt-BR/calendar.json`, `src/locales/en-US/calendar.json`

**Interfaces:**
- Consumes: `DailyExpense.items`, `DailyExpense.personName`, `updateExpense`.

- [ ] **Step 1: Escreva os testes**

- O modal do dia agrupa os itens por compra: "Supermercado" com os dois itens dele e "Farmácia" com o item dela.
- A compra mostra `itemName` salvo, mesmo com o item renomeado.
- Editar uma compra com itens pelo modal do dia, mudando o valor, preserva as linhas.
- Reembolso de pessoa excluída mostra `personName` no modal do dia e no fechamento. Sem `personName`, continua mostrando `calendar:removedProfessional`.
- O dia com compra fica sinalizado em `day-cell.tsx` e na tela cheia, inclusive em telas de até 640px.
- O aviso do sinal mostra a quantidade de compras e o total. Exemplo: `2 gasto(s) totalizando R$ 50,00`.
- O fechamento mantém o total pelo `amount`, com ou sem itens.

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/components/modals src/components/calendar`
Expected: FAIL nos testes novos.

- [ ] **Step 3: Implemente**

Três pontos exigem atenção:

- `day-cell.tsx` passa `amount` para `dayCell.expensesTooltip`, mas a chave usa `{{count}}` e `{{total}}`, então o texto sai incompleto. Corrija nos dois arquivos, `day-cell.tsx` e `fullscreen-calendar-modal.tsx`.
- O botão do sinal em `day-cell.tsx` tem `mobile:hidden`. Garanta um sinal visível em telas de até 640px.
- Em `month-payments-modal.tsx`, o nome de fallback passa a ser `personExpenses[0]?.personName ?? t('calendar:removedProfessional')` no caminho de reembolsos.

- [ ] **Step 4: Rode e confirme que passa**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run src/components`
Expected: sem erros e PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(purchases): show purchases on the calendar"
```

### Task 12: Documentação e verificação final

**Files:**
- Modify: `PROJECT_CONTEXT.md`, `CLAUDE.md`, `README.md`

- [ ] **Step 1: Atualize a documentação**

- `PROJECT_CONTEXT.md`: `ExpenseItem`, `items`, `itemName`, `personName`, `expenseItems`, `_master_expense_items`, rota `/compras`, `src/components/purchases/` e `expense-item-utils.ts`.
- `CLAUDE.md`: troque `_master_{people,addresses,shifts,rules}` para incluir `expense_items`.
- `README.md`: mencione compras com itens e histórico de recompra.

- [ ] **Step 2: Rode a verificação completa, sem filtro de logs**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run --silent=false`
Expected: sem erros, todos os testes passando e nenhum aviso `not wrapped in act`.

- [ ] **Step 3: Rode o build**

Run: `pnpm build`
Expected: exit 0.

- [ ] **Step 4: Confira os critérios da seção 13 da especificação, um a um**

Abra `pnpm dev`, percorra `/compras` em tela estreita e larga e confirme os modos claro e escuro. Se não houver navegador disponível, relate isso em vez de considerar aprovado.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: describe purchases and the item registry"
```

### Task 13: Importar itens de uma planilha

Esta task entrou depois das demais. Execute-a mesmo que a Task 12 já esteja concluída. Comportamento: seção 14 da especificação.

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `src/utils/expense-item-import.ts`, `src/utils/expense-item-import.test.ts`
- Modify: `src/components/purchases/purchase-form.tsx`, `.test.tsx`, `.stories.tsx`
- Modify: `src/locales/pt-BR/purchases.json`, `src/locales/en-US/purchases.json`
- Modify: `PROJECT_CONTEXT.md`, `README.md`

**Interfaces:**
- Consumes: `normalizeItemName`, `parseNumericRate`, `ExpenseLineInput`.
- Produces: tudo em "Interface pública", na seção 14 da especificação.

- [ ] **Step 1: Atualize o `xlsx`**

Run: `pnpm add https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
Run: `pnpm test:run src/utils/export-to-excel.test.ts && pnpm audit --prod`
Expected: exportação continua passando, e o audit não lista mais `xlsx`.

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "fix(deps): update xlsx to patched release"
```

- [ ] **Step 3: Escreva os testes de `expense-item-import.test.ts`**

Gere as planilhas no teste, com um helper:

```ts
const workbookFile = (rows: unknown[][], bookType: 'xlsx' | 'xls' = 'xlsx') => {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Lista')
  const data = XLSX.write(book, { type: 'array', bookType })
  return new File([data], `lista.${bookType}`)
}
```

| Linhas da planilha | Esperado |
| :--- | :--- |
| `[['Nome','Valor'],['Fralda',30],['Lenço',12.5]]` | Duas linhas, com quantidade 1 |
| O mesmo arquivo em `xls` | Mesmo resultado |
| `[['Fralda',30],['Lenço',12.5]]`, sem cabeçalho | Coluna A é nome, coluna B é valor |
| `[['Produto','Qtd','Preço'],['Fralda',2,30]]` | Colunas pelo nome: quantidade 2, valor 30 |
| `[['Nome'],['Fralda']]` | Item sem `amount` |
| `[['Nome','Valor'],['Fralda','R$ 10,50']]` | `amount: 10.5` |
| `[['Nome','Valor'],['Fralda','abc']]` | Sem `amount`, aviso `{ row: 2, code: 'INVALID_AMOUNT' }` |
| `[['Nome','Valor'],['Fralda',-5]]` | Sem `amount`, aviso `INVALID_AMOUNT` |
| `[['Nome','Valor'],['Brinde',0]]` | `amount: 0`, sem aviso |
| `[['Nome','Qtd'],['Fralda',0]]` | Quantidade 1, aviso `{ row: 2, code: 'INVALID_QUANTITY' }` |
| `[['Nome','Valor'],['Fralda',10],[null,5],['',1],['Lenço',2]]` | Linhas sem nome ignoradas |
| `[['Nome','Qtd','Valor'],['Fralda',1,10],[' fralda ',2,20]]` | Uma linha: `quantity: 3`, `amount: 30` |
| `[['Nome','Valor'],['Fralda',0.1],['fralda',0.2]]` | `amount: 0.3` |
| 201 nomes diferentes | `{ ok: false, code: 'TOO_MANY_ITEMS' }` |
| 300 linhas com 2 nomes | `ok: true`, 2 linhas |
| Só cabeçalho | `{ ok: false, code: 'EMPTY_FILE' }` |
| `new File(['abc'], 'lista.xlsx')` | `ok: false`, com `UNREADABLE_FILE` ou `EMPTY_FILE` |
| Arquivo com 5 MB + 1 byte | `FILE_TOO_LARGE`, sem ler o conteúdo |
| Item chamado `__proto__` | Tratado como nome comum; `({} as Record<string, unknown>).polluted` indefinido |

Testes de `mergeImportedLines`:
- Item novo vai para o fim, e a ordem das linhas atuais se mantém.
- Item igual à linha atual, por `name`, soma quantidade e valor.
- A comparação usa `name`, normalizado, inclusive em linhas com `itemId`: o formulário envia as duas informações, e uma linha somada mantém o `itemId`.
- Valores ausentes dos dois lados continuam ausentes.

- [ ] **Step 4: Rode e confirme a falha**

Run: `pnpm vitest run src/utils/expense-item-import.test.ts`
Expected: FAIL, porque o módulo não existe.

- [ ] **Step 5: Implemente `src/utils/expense-item-import.ts`**

Carregue a biblioteca sob demanda, com `await import('xlsx')`. Leia com `XLSX.read(data, { type: 'array', cellFormula: false, cellHTML: false })` e `sheet_to_json(sheet, { header: 1, raw: true, blankrows: true })`, para preservar o número das linhas. Agrupe com `Map`, nunca com objeto simples. Arredonde somas a centavos. Capture exceções da leitura como `UNREADABLE_FILE`.

- [ ] **Step 6: Rode e confirme que passa**

Run: `pnpm vitest run src/utils/expense-item-import.test.ts`
Expected: PASS.

- [ ] **Step 7: Escreva os testes do formulário**

- Importar preenche os itens, e `expenses` continua igual até salvar.
- Depois de salvar, itens novos aparecem na busca.
- Item importado com nome já cadastrado mostra a última compra e os dias decorridos.
- Com total vazio, ele recebe a soma. Com total preenchido, ele não muda.
- Sem valores na planilha, o total continua vazio.
- Avisos aparecem com o número da linha.
- Cada código de erro aparece traduzido, e o formulário não muda.
- Importar duas vezes o mesmo arquivo soma os itens, e o seletor aceita o mesmo arquivo de novo.
- O controle aceita apenas `.xls` e `.xlsx`.

- [ ] **Step 8: Rode e confirme a falha**

Run: `pnpm vitest run src/components/purchases/purchase-form.test.tsx`
Expected: FAIL nos testes novos.

- [ ] **Step 9: Ligue a importação ao formulário**

Limpe o valor do `input` de arquivo depois de cada leitura. Mostre erros e avisos com chaves em `purchases.import.*`. A aparência do controle fica a seu critério.

- [ ] **Step 10: Atualize a documentação**

Em `PROJECT_CONTEXT.md`, mencione `expense-item-import.ts` e a leitura de planilhas. Em `README.md`, mencione a importação de itens.

- [ ] **Step 11: Rode a verificação completa, sem filtro de logs**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run --silent=false && pnpm build`
Expected: sem erros, todos os testes passando, nenhum aviso `not wrapped in act` e build com exit 0.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(purchases): import items from a spreadsheet"
```

