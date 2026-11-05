# Compras com itens e histórico de recompra

Data: 2026-11-05
Status: aguardando revisão
Execução: nova IA, responsável pela funcionalidade inteira, incluindo a interface

## 1. Objetivo

Evoluir o gasto diário (`DailyExpense`) para representar uma compra com vários itens, cada um com quantidade e valor opcional, e permitir saber quanto tempo passou até o mesmo item ser comprado de novo.

Exemplo de compras de um dia:

```text
Supermercado
- Fralda
- Lenço umedecido

Farmácia
- Pomada
```

## 2. Limite deste trabalho

Esta funcionalidade será implementada por outra IA, do modelo de dados à interface. Esta especificação define o comportamento e não define a aparência: layout, componentes, navegação, ícones e textos ficam a critério dela.

**Rota obrigatória:** a funcionalidade de compras precisa ter uma rota própria e nova, `/compras`, protegida por `PrivateRoute` e registrada em `src/router/index.tsx`. Ela não pode ser apenas um modal, uma aba de outra rota ou uma extensão de `/calendario`.

Não faz parte desta entrega:

- Incluir gastos na exportação para Excel
- Criar o arquivo `LICENSE`
- Campo de unidade (kg, caixa)
- Previsão da próxima compra
- Exclusão de item do cadastro

## 3. Regra de histórico

Uma mudança em um cadastro nunca altera o que um mês passado mostra. Mês passado é qualquer mês anterior ao atual (`month < getCurrentMonth()`). Editar diretamente um registro de mês passado continua permitido.

Nesta feature, a regra é cumprida guardando na própria compra o que foi registrado: nome de cada item e nome do profissional. A proteção de pessoas, turnos e regras nas demais áreas do app é um projeto separado, a foto do mês (`docs/superpowers/specs/2026-11-05-month-registry-snapshots-design.md`), que será concluído antes desta feature começar.

## 4. Decisões

| Tema | Decisão |
| :--- | :--- |
| Relação com gastos | Evoluir `DailyExpense`, sem entidade separada |
| Compatibilidade | Não há gastos reais em produção, então o modelo pode mudar livremente |
| Nome da compra | Campo `description` existente (ex.: "Supermercado") |
| Identidade do item | Cadastro global, com criação automática ao usar um nome novo |
| Total da compra | `amount`, obrigatório e sempre informado; é o valor usado no fechamento do mês |
| Valor do item | Opcional, é o total da linha, e a soma pode diferir do total |
| Quantidade | Padrão 1, aceita decimais, maior que 0 |
| Valor zero na linha | Permitido, para brindes |
| Item repetido na compra | Recusado; usa-se a quantidade |
| Referência dos dias ao registrar | Data da compra, considerando compras anteriores a ela |
| Referência dos dias no histórico | Data de hoje |
| Manutenção do cadastro | Renomear e juntar itens |
| Efeito de renomear | Cadastro e compras do mês atual em diante; meses anteriores mantêm o nome antigo |
| Efeito de juntar | Nenhuma compra muda; o item juntado aponta para o item de destino e os históricos se somam |
| Nomes na compra | Guardados na compra (`itemName` e `personName`) |
| Período da consulta | Um mês por vez, com o mês atual como padrão |

## 5. Modelo de dados

Em `src/types/index.ts`:

```ts
export interface ExpenseItem {
  id: string
  name: string
  mergedIntoId?: string // item que substituiu este depois de uma junção
  createdAt: string
  updatedAt: string
}

export interface ExpenseLine {
  itemId: string
  itemName: string // nome registrado na compra
  quantity: number
  amount?: number // total da linha
}

export interface DailyExpense {
  id: string
  date: string // 'YYYY-MM-DD'
  description: string
  amount: number // total pago na compra
  items: ExpenseLine[] // vazio quando a compra não tem itens
  personId?: string
  personName?: string // nome registrado na compra
  category?: DailyExpenseCategory
  createdAt: string
  updatedAt: string
}
```

Regras do modelo:

- `itemId` identifica o item para o histórico. `itemName` é o que a compra mostra.
- `personName` é preenchido pelo store a partir de `personId` no momento do registro.
- Salvar uma compra de novo não atualiza nomes já guardados. Ver seção 6.6.
- `items` é obrigatório no gasto salvo. Sem itens, o valor é `[]`.
- A entrada da ação pode omitir `items`. Em `addExpense`, a omissão gera `[]`. Em `updateExpense`, a omissão mantém as linhas salvas.
- O registro feito pelo calendário continua funcionando, pois não envia `items`.
- Não há migração de dados nem tratamento de gastos sem o campo `items`.
- `ExpenseItem.name` guarda o texto digitado sem espaços nas pontas e com espaços internos repetidos reduzidos a um.

Tipos de entrada, também em `src/types/index.ts`:

```ts
export interface ExpenseLineInput {
  itemId?: string
  name?: string
  quantity?: number
  amount?: number
}

export type ExpenseInput = Omit<DailyExpense, 'id' | 'items' | 'personName' | 'createdAt' | 'updatedAt'> & {
  items?: ExpenseLineInput[]
}

export type ExpenseUpdateInput = Partial<ExpenseInput>
```

## 6. Regras de negócio

### 6.1 Busca de itens

- A consulta é normalizada antes da comparação.
- Itens com `mergedIntoId` não aparecem.
- Com menos de 3 caracteres normalizados, o resultado é vazio.
- Um item corresponde quando seu nome normalizado contém a consulta em qualquer posição.
- Ordem: `lastPurchaseDate` mais recente primeiro, depois itens sem compra, com desempate por nome (`localeCompare` em `pt-BR`).
- Retorna no máximo 4 resultados.

### 6.2 Última compra ao registrar

- Considera as compras do item e de todos os itens juntados a ele.
- Considera apenas gastos com data estritamente anterior à data de referência.
- Ignora o gasto indicado em `excludeExpenseId`, usado ao editar.
- Compras na mesma data da referência não contam.
- Dias: `differenceInCalendarDays(referenceDate, lastPurchaseDate)`, de `date-fns`, com datas lidas por `parseISO`.
- Sem compra anterior, data e dias são `null`.

Exemplo: compra anterior em `2026-10-20` e referência em `2026-11-01` resultam em 12 dias.

### 6.3 Histórico do item

- Usa todas as compras do item e dos itens juntados a ele, sem limite de período, independentemente do filtro de mês.
- Datas repetidas contam como uma só.
- `entries` fica em ordem crescente de data.
- A primeira entrada tem `daysSincePrevious` igual a `null`.
- `averageIntervalDays` é a média dos intervalos, arredondada a 1 casa, ou `null` com menos de 2 datas.
- `daysSinceLastPurchase` é a diferença até `today`, nunca negativa.
- Modo `FULL`: devolve todas as entradas.
- Modo `LAST`: devolve apenas a entrada mais recente, com o `daysSincePrevious` dela. Média e última compra continuam calculadas sobre todas as datas.
- Item sem compras: `lastPurchaseDate`, `daysSinceLastPurchase` e `averageIntervalDays` nulos, e `entries` vazio.

Exemplo: compras em `2026-10-03`, `2026-10-21` e `2026-11-05`, com hoje em `2026-11-10`, resultam em intervalos de 18 e 15 dias, média 16,5 e 5 dias desde a última compra.

### 6.4 Total e soma das linhas

- `subtotal` soma apenas as linhas com `amount`.
- `allLinesHaveAmount` é `true` somente se houver linhas e todas tiverem `amount`.
- `difference` é `amount - subtotal`, arredondado a centavos, e só existe quando `allLinesHaveAmount` é `true`. Caso contrário é `null`.
- A diferença nunca bloqueia o salvamento.

Exemplo: linhas de R$ 30 e R$ 20 com total de R$ 45 resultam em `subtotal` 50 e `difference` -5.

### 6.5 Validação

`validateExpenseInput` devolve uma lista de `{ code, lineIndex? }`, vazia quando a entrada é válida.

| Código | Condição |
| :--- | :--- |
| `DATE_INVALID` | `date` não está no formato `YYYY-MM-DD` ou não é uma data real |
| `DESCRIPTION_REQUIRED` | `description` vazia depois do `trim` |
| `AMOUNT_INVALID` | `amount` não finito ou menor ou igual a 0 |
| `ITEM_REQUIRED` | Linha sem `itemId` e sem `name` preenchido |
| `ITEM_NOT_FOUND` | `itemId` que não existe no cadastro |
| `QUANTITY_INVALID` | `quantity` informada, não finita ou menor ou igual a 0 |
| `LINE_AMOUNT_INVALID` | `amount` da linha informado, não finito ou negativo |
| `DUPLICATE_ITEM` | Duas linhas resolvem para o mesmo item, por `itemId` ou nome normalizado |

O código `EXPENSE_NOT_FOUND` não vem desta função: `updateExpense` o devolve quando o id do gasto não existe.

Para a detecção de duplicados, um `name` igual a um item existente equivale ao `itemId` desse item.

### 6.6 Criação automática de itens e nomes guardados

Ao salvar uma linha:

1. Com `itemId`, usa esse item.
2. Com `name`, procura um item com o mesmo nome normalizado. Se ele tiver sido juntado, usa o item de destino.
3. Sem correspondência, cria um `ExpenseItem`, com id no formato `expitem_${Date.now()}_${random}`.

`itemName` segue estas regras:

- Em compra nova ou linha nova, recebe o nome atual do item no cadastro.
- Ao editar uma compra, uma linha cujo `itemId` já existia nela mantém o `itemName` salvo, mesmo que o cadastro tenha mudado.

`personName` segue regras equivalentes:

- Em compra nova, recebe o nome atual da pessoa, ou fica ausente sem `personId`.
- Ao editar, mantém o valor salvo se `personId` não mudar.
- Se `personId` mudar, recebe o nome atual da nova pessoa, ou fica ausente sem `personId`.

Itens só são criados depois que toda a validação passar, para que uma compra recusada não deixe itens soltos.

### 6.7 Renomear

- Nome vazio depois da normalização: `NAME_REQUIRED`.
- Item inexistente ou já juntado: `ITEM_NOT_FOUND`.
- Nome igual ao de outro item, juntado ou não: `NAME_CONFLICT`. Mudar apenas maiúsculas ou acentos do próprio item é permitido.
- Sucesso altera `name` e `updatedAt` no cadastro.
- Linhas com esse `itemId` em compras com mês maior ou igual a `getCurrentMonth()` recebem o novo `itemName` e a compra recebe novo `updatedAt`.
- Compras de meses anteriores não mudam.

### 6.8 Juntar

`mergeExpenseItems(sourceId, targetId)` faz `sourceId` passar a apontar para `targetId`, gravando `mergedIntoId` em `sourceId`.

- `sourceId` igual a `targetId`: `SAME_ITEM`.
- Qualquer item inexistente ou já juntado: `ITEM_NOT_FOUND`.
- Nenhuma compra é alterada, em nenhum mês.
- O item de origem continua no cadastro e sai da busca.
- Busca, última compra, histórico e filtro por item passam a incluir as compras do item de origem.
- Depois de A ser juntado a B e B a C, as compras de A contam para C.
- Uma compra antiga pode ter linhas dos dois itens. Isso é válido, e o histórico conta a data uma vez só.

### 6.9 Remoções

- Excluir uma compra não remove itens do cadastro, e eles seguem aparecendo na busca.
- Editar uma compra e tirar uma linha também não remove o item.

### 6.10 Filtro de compras

- `month` é obrigatório. `category`, `personId` e `itemId` são opcionais e combinam com E.
- `itemId` inclui as compras dos itens juntados a ele.
- A lista inclui todos os gastos, com ou sem itens.
- Ordem: `date` decrescente, depois `createdAt` decrescente.
- O mês padrão vem de `getCurrentMonth()`, e não de `currentMonth` do store. O filtro não altera o mês do calendário.

### 6.11 Normalização de nome

`normalizeItemName` aplica, nesta ordem:

1. `trim`
2. Redução de espaços internos repetidos a um só
3. Decomposição NFD e remoção de marcas diacríticas
4. `toLocaleLowerCase('pt-BR')`

Exemplos: `'  Fralda   G '` vira `'fralda g'`, e `'LENÇO'` vira `'lenco'`.

## 7. Funções puras

Arquivo novo: `src/utils/expense-item-utils.ts`. Nenhuma função acessa o store ou o storage.

```ts
export const ITEM_SEARCH_MIN_LENGTH = 3
export const ITEM_SEARCH_MAX_RESULTS = 4

export interface ItemLastPurchase {
  lastPurchaseDate: string | null
  daysSinceLastPurchase: number | null
}

export interface ExpenseItemSuggestion extends ItemLastPurchase {
  item: ExpenseItem
}

export interface ItemLastPurchaseOptions {
  referenceDate: string // 'YYYY-MM-DD'
  excludeExpenseId?: string
}

export type ItemHistoryMode = 'LAST' | 'FULL'

export interface ItemHistoryEntry {
  date: string
  daysSincePrevious: number | null
}

export interface ItemHistory extends ItemLastPurchase {
  itemId: string
  entries: ItemHistoryEntry[]
  averageIntervalDays: number | null
}

export interface ExpenseFilters {
  month: string // 'YYYY-MM'
  category?: DailyExpenseCategory
  personId?: string
  itemId?: string
}

export interface ExpenseLinesSummary {
  subtotal: number
  allLinesHaveAmount: boolean
  difference: number | null
}

export type ExpenseValidationCode =
  | 'DATE_INVALID'
  | 'DESCRIPTION_REQUIRED'
  | 'AMOUNT_INVALID'
  | 'ITEM_REQUIRED'
  | 'ITEM_NOT_FOUND'
  | 'QUANTITY_INVALID'
  | 'LINE_AMOUNT_INVALID'
  | 'DUPLICATE_ITEM'
  | 'EXPENSE_NOT_FOUND'

export interface ExpenseValidationError {
  code: ExpenseValidationCode
  lineIndex?: number
}

export function normalizeItemName(name: string): string
export function findExpenseItemByName(name: string, items: ExpenseItem[]): ExpenseItem | undefined
export function resolveExpenseItemId(itemId: string, items: ExpenseItem[]): string
export function getMergedItemIds(itemId: string, items: ExpenseItem[]): string[]
export function searchExpenseItems(
  query: string,
  items: ExpenseItem[],
  expenses: DailyExpense[],
  options: ItemLastPurchaseOptions,
): ExpenseItemSuggestion[]
export function getItemLastPurchase(
  itemId: string,
  items: ExpenseItem[],
  expenses: DailyExpense[],
  options: ItemLastPurchaseOptions,
): ItemLastPurchase
export function getItemHistory(
  itemId: string,
  items: ExpenseItem[],
  expenses: DailyExpense[],
  options: { mode: ItemHistoryMode; today: string },
): ItemHistory
export function createDefaultExpenseFilters(now?: Date): ExpenseFilters
export function filterExpenses(
  expenses: DailyExpense[],
  items: ExpenseItem[],
  filters: ExpenseFilters,
): DailyExpense[]
export function getExpenseLinesSummary(expense: Pick<DailyExpense, 'amount' | 'items'>): ExpenseLinesSummary
export function validateExpenseInput(input: ExpenseInput, items: ExpenseItem[]): ExpenseValidationError[]
```

- `resolveExpenseItemId` segue a cadeia de `mergedIntoId` até o item final, protegida contra ciclos.
- `getMergedItemIds` devolve o item informado e todos os que levam a ele.

## 8. Store

Em `src/store/use-schedule-store.ts`.

Novo estado: `expenseItems: ExpenseItem[]`.

Tipos de resultado:

```ts
export type ExpenseActionResult =
  | { ok: true; expense: DailyExpense }
  | { ok: false; errors: ExpenseValidationError[] }

export type ExpenseItemActionCode =
  | 'ITEM_NOT_FOUND'
  | 'NAME_REQUIRED'
  | 'NAME_CONFLICT'
  | 'SAME_ITEM'

export type ExpenseItemActionResult = { ok: true } | { ok: false; code: ExpenseItemActionCode }
```

Ações:

```ts
addExpense: (input: ExpenseInput) => Promise<ExpenseActionResult>
updateExpense: (expenseId: string, input: ExpenseUpdateInput) => Promise<ExpenseActionResult>
deleteExpense: (expenseId: string) => Promise<void>
renameExpenseItem: (itemId: string, name: string) => Promise<ExpenseItemActionResult>
mergeExpenseItems: (sourceId: string, targetId: string) => Promise<ExpenseItemActionResult>
```

Comportamento:

- `addExpense` valida, resolve as linhas, persiste itens novos e o gasto, e sincroniza.
- `updateExpense` combina a entrada com o gasto salvo e valida o resultado completo. Com `items` ausente, mantém as linhas. Id inexistente devolve `ok: false` com o erro `EXPENSE_NOT_FOUND`.
- `quantity` omitida na linha é salva como 1.
- Gastos e cadastro ficam fora do rascunho do modo de edição e são gravados na hora, como os gastos atuais.
- `renameExpenseItem` atualiza o cadastro e as compras do mês atual em diante, e sincroniza o cadastro e cada mês alterado.
- `mergeExpenseItems` atualiza só o cadastro e sincroniza o cadastro.
- `saveSchedule`, `forcePushCloudData`, `pullCloudData`, `reloadFromStorage` e `clearAllLocalData` passam a tratar `expenseItems`.

## 9. Persistência e nuvem

### Storage (`src/services/storage-service.ts`)

- Chave `EXPENSE_ITEMS: 'scale_manager_expense_items_v1'`
- `getExpenseItems` e `saveExpenseItems`, no padrão de `getExpenses`
- Remoção em `resetToDefault`
- Inclusão em `getCurrentDataset` e `restoreDataset` (com `|| []`)
- `GuestDataset.expenseItems?: ExpenseItem[]` em `src/types/index.ts`

### Backup (`src/services/backup-service.ts`)

- `AppDataSnapshot.expenseItems?: ExpenseItem[]`
- `exportAppData` inclui o cadastro
- `validateAndParseBackup` normaliza para array
- `restoreAppData` grava o cadastro
- `mergeAppData` combina por `id`, no padrão de `expenses`
- Itens com ids diferentes e o mesmo nome permanecem separados; a junção manual resolve esse caso

### Nuvem (`src/services/cloud-sync-service.ts`)

- `saveExpenseItemsToCloud(items, isAdmin?, ignoreSyncEnabled?)` via `saveMasterListToCloud`, no documento `schedules/_master_expense_items`, campo `items`
- `CloudPullData.expenseItems: ExpenseItem[] | null`, lido em `pullAllFromCloud`
- `pushAllToCloud` aceita `expenseItems?: ExpenseItem[]`
- As linhas viajam dentro do gasto, no documento do mês, sem mudança em `MonthScheduleData`
- `firestore.rules` não muda, pois a coleção `schedules` já cobre o novo documento
- Quando a nuvem não tiver o documento, o pull mantém o cadastro local

## 10. Requisitos da interface

Requisitos de produto que a interface deve atender, com a forma definida pela IA executora:

- Existe uma rota própria e nova, `/compras`, para cadastrar e consultar compras
- Em telas abaixo de 768px, a barra inferior mostra calendário, compras e medicamentos, além de "Mais". Pessoas, turnos e configurações ficam acessíveis por "Mais"
- O dia com compra fica sinalizado no calendário
- A visualização das compras do dia continua no modal do dia e agrupa os itens por compra
- O filtro de mês começa no mês atual
- A busca de itens usa os limites definidos na seção 6.1
- Ao adicionar um item, ficam disponíveis a última compra e os dias decorridos
- O usuário pode consultar a última compra ou o histórico completo do item

Recursos disponíveis:

| Necessidade | Recurso |
| :--- | :--- |
| Listar compras | `filterExpenses` e `createDefaultExpenseFilters` |
| Sugerir itens | `searchExpenseItems` |
| Dias desde a última compra de um item escolhido | `getItemLastPurchase` |
| Histórico do item | `getItemHistory` |
| Diferença entre total e linhas | `getExpenseLinesSummary` |
| Validar antes de salvar | `validateExpenseInput` |
| Salvar | `addExpense`, `updateExpense`, `deleteExpense` |
| Manter o cadastro | `renameExpenseItem`, `mergeExpenseItems` |
| Nome do item de uma linha | `line.itemName` |
| Nome do profissional de uma compra | `expense.personName` |

## 11. Correções incluídas

1. **Mudança de mês em `updateExpense`:** hoje só o mês da nova data é sincronizado, e o documento do mês antigo mantém a cópia do gasto. O pull seguinte traria o gasto duplicado. A correção sincroniza os dois meses.
2. **Backup sem atualizar o store:** `restoreAppData` e `mergeAppData` gravam `expenses` no storage, mas não incluem o campo no `setState`, e `import-view.tsx` não chama `reloadFromStorage` depois. Com a sincronização ligada, o `forcePushCloudData` que roda em seguida envia à nuvem os gastos antigos do store, e o próximo `saveSchedule` regrava essa versão antiga no storage. A correção inclui `expenses` e `expenseItems` nos dois `setState`, antes do push.

## 12. Testes

Testes novos em `src/utils/expense-item-utils.test.ts`:

- Normalização: maiúsculas, acentos, espaços nas pontas e internos
- Busca: 2 caracteres retorna vazio, 3 retorna; corresponde no meio do nome; limita a 4; ordena pela compra mais recente; item sem compra vem depois
- Última compra: exclui a compra em edição; ignora data posterior e igual à referência; lançamento retroativo; item sem compra
- Histórico: exemplo da seção 6.3; datas repetidas; modos `LAST` e `FULL`; item com uma compra; item sem compra; virada de mês e de ano
- Filtro: cada critério e a combinação; gasto sem itens aparece; ordenação
- Resumo: linhas parciais, todas preenchidas, sem linhas e arredondamento em centavos
- Junção: `resolveExpenseItemId` e `getMergedItemIds` com cadeia A → B → C; compras de A aparecem no histórico e no filtro de C; item juntado sai da busca; compra com linhas dos dois itens conta a data uma vez
- Validação: todos os códigos, incluindo duplicado por nome e por `itemId`, e `amount` zero na linha aceito

Testes do store em `src/store/use-schedule-store.test.ts`:

- `addExpense` cria item novo e reaproveita existente por nome
- `addExpense` recusada não cria item
- `updateExpense` sem `items` mantém as linhas
- `updateExpense` mudando de mês sincroniza os dois meses
- `addExpense` guarda `itemName` e `personName`
- Editar uma compra depois de renomear o item ou a pessoa mantém os nomes salvos
- Trocar `personId` ao editar atualiza `personName`
- `renameExpenseItem`: altera compras do mês atual e de meses futuros, não altera compras de mês anterior, e cobre conflito, nome vazio e item inexistente
- `mergeExpenseItems`: nenhuma compra muda, e cobre `SAME_ITEM`, item inexistente e item já juntado

Testes de persistência:

- `storage-service.test.ts`: leitura, gravação, limpeza e snapshot do cadastro
- `backup-service.spec.ts`: exportação, restauração e merge, com o store atualizado
- `cloud-sync-service.spec.ts`: gravação e leitura de `_master_expense_items`, e linhas preservadas no documento do mês

Fixtures de gastos precisam de `items: []` em:

- `src/store/use-schedule-store.test.ts`
- `src/utils/shift-rate-utils.test.ts`
- `src/components/modals/month-payments-modal.test.tsx`
- `src/services/storage-service.test.ts`
- `src/components/modals/day-events-modal.test.tsx`
- `src/components/calendar/day-cell.test.tsx`

## 13. Critérios de aceite

- `pnpm validate` e `pnpm build` passam
- Compras com e sem itens entram igual no fechamento do mês, pelo valor de `amount`
- Registrar pelo calendário continua funcionando, e editar por lá preserva as linhas
- Renomear ou juntar itens e editar ou excluir pessoas não altera compras de meses anteriores
- Os exemplos numéricos das seções 6.2, 6.3 e 6.4 são cobertos por testes com valores literais
- A rota `/compras` existe, abre a funcionalidade de compras e tem teste em `src/router/router.test.tsx`
- Todo texto novo tem chave em `pt-BR` e `en-US`, e todo componente novo tem story
- `PROJECT_CONTEXT.md` e `CLAUDE.md` passam a descrever `ExpenseItem`, `items`, `itemName`, `personName` e o documento `_master_expense_items`
