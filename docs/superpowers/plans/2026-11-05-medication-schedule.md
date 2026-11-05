# Plano de implementação: tabela de medicamentos com versões

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a rota `/medicamentos`, com uma tabela de medicamentos versionada, em que cada mudança registra data, profissional e explicação.

**Architecture:** O estado `medicationVersions` guarda a lista de versões, cada uma com a tabela inteira. Regras e cálculos ficam em funções puras em `src/utils/medication-schedule-utils.ts`, e o store persiste e sincroniza. A interface consome esse contrato e mantém a versão exibida como estado local.

**Tech Stack:** React 19, TypeScript strict, Zustand 5, Tailwind 4, i18next, date-fns 4, Vitest, Testing Library, Storybook 10, Firebase 13.

**Spec:** `docs/superpowers/specs/2026-11-05-medication-schedule-design.md`. Leia a especificação inteira antes da Task 1. Leia também `CLAUDE.md`, em especial "Adding a persisted field".

## Global Constraints

- Date fields always use `DatePicker` from `src/components/ui/date-picker.tsx`, the shadcn date picker (`Popover` + `Calendar`, built on `radix-ui` and `react-day-picker`). Never use a native `type="date"` or write another calendar; ESLint blocks native date inputs everywhere except that file.
- Time fields use the native `<input type="time">` with the same classes as the day events field in `day-events-modal.tsx`.
- **Pré-requisito:** o plano `docs/superpowers/plans/2026-11-05-expense-purchases.md` precisa estar concluído. Confirme que `normalizeItemName` existe em `src/utils/expense-item-utils.ts` antes de começar.
- Trabalhe na branch `main`, sem criar branch nova, com um commit por task. Não faça push: o usuário fará o push no final.
- Antes de cada commit, `pnpm typecheck` e os testes tocados precisam passar.
- Toda mudança de comportamento segue TDD: teste falhando primeiro.
- Sem `any`, sem default export, sem ponto e vírgula, com `import type` para tipos.
- Sem texto fixo na interface. Toda chave nova existe em `pt-BR` e `en-US`.
- Todo componente novo tem `.stories.tsx`, variantes `dark:*` e funciona em telas de até 640px sem rolagem horizontal da página.
- A dose é texto livre: não converta para número.
- Campos obrigatórios terminam a label com ` *`, sem nenhum "(Opcional)", e ficam vermelhos quando violados, seguindo "Form fields" no `CLAUDE.md`. Inclua o formulário em `src/components/required-fields.test.tsx`.
- Versões antigas nunca são alteradas por uma versão nova.
- Não importar a planilha, não usar versão antiga como base, não criar estoque, alertas, registro de doses tomadas nem Excel.
- Aparência, layout, ícones e textos ficam a seu critério. O plano fixa comportamento e nomes de código.

## Review Focus

1. **Virada do dia:** às 23:30 no horário local, `today` é a data local, não a de UTC. Use `format(new Date(), 'yyyy-MM-dd')`, nunca `toISOString()`. Teste na Task 4.
2. **Rascunho sobre a versão vigente:** editar a base de uma nova versão não pode alterar o objeto salvo no store. Teste na Task 6.
3. **Sem nenhuma versão:** a rota abre sem erro e permite criar a primeira versão, vazia. Teste na Task 5.
4. **Horários inválidos:** `7:00`, `24:00`, `12:60` e texto vazio geram `TIME_INVALID`. Teste na Task 2.
5. **Tabela larga em tela estreita:** com 10 medicamentos, a tabela rola dentro do próprio contêiner, e a página não ganha rolagem horizontal. Teste na Task 5.

---

### Task 1: Tipos, versão vigente e histórico

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/utils/medication-schedule-utils.ts`, `src/utils/medication-schedule-utils.test.ts`

**Interfaces:**
- Produces: tipos da seção 4 da especificação e, em `medication-schedule-utils.ts`:
  - `createMedicationId(): string`
  - `getCurrentMedicationVersion(versions, today)`
  - `getMedicationVersionAt(versions, date)`
  - `getMedicationVersionChanges(previous, next): MedicationVersionChange[]`
  - `getMedicationVersionHistory(versions): MedicationVersionHistoryEntry[]`
  - tipos da seção 7 e `MedicationVersionChange` da seção 5.4

- [ ] **Step 1: Escreva os testes**

Crie um helper `version(id, effectiveDate, overrides?, createdAt?)`.

```ts
const versions = [
  version('v2', '2026-03-13', {}, '2026-03-13T10:00:00Z'),
  version('v1', '2026-02-13', {}, '2026-02-13T10:00:00Z'),
  version('v3', '2026-03-13', {}, '2026-03-13T18:00:00Z'),
]

it.each([
  ['2026-02-12', undefined],
  ['2026-02-13', 'v1'],
  ['2026-03-01', 'v1'],
  ['2026-03-13', 'v3'],
  ['2026-12-31', 'v3'],
])('finds the version in force on %s', (date, expected) => {
  expect(getMedicationVersionAt(versions, date)?.id).toBe(expected)
})

it('returns undefined without versions', () => {
  expect(getCurrentMedicationVersion([], '2026-11-05')).toBeUndefined()
})

it('lists versions from newest to oldest, comparing each with the previous one', () => {
  const history = getMedicationVersionHistory(versions)
  expect(history.map((entry) => entry.version.id)).toEqual(['v3', 'v2', 'v1'])
  expect(history[2].changes).toEqual([])
})
```

Testes de `getMedicationVersionChanges`, com `previous` e `next` literais:

| Mudança | Esperado |
| :--- | :--- |
| `previous` indefinido | `[]` |
| Medicamento novo | `MEDICATION_ADDED`, sem `DOSE_CHANGED` para ele |
| Medicamento removido | `MEDICATION_REMOVED`, com o nome em `previous` |
| Mesmo `id` com outro nome | `MEDICATION_RENAMED`, sem incluir nem remover |
| Dosagem de `undefined` para `200mg` | `DOSAGE_CHANGED` |
| Origem alterada | `SOURCE_CHANGED` |
| Médico responsável alterado | `RESPONSIBLE_CHANGED` |
| Horário novo e removido | `TIME_ADDED` e `TIME_REMOVED` |
| Dose `1 comprimido` para `0.5 comprimido` às `21:00` | `DOSE_CHANGED` com `from` e `to` |
| Dose `1 Comprimido` para ` 1 comprimido ` | Nenhuma mudança |
| Dose removida | `DOSE_CHANGED` com `to` indefinido |
| Versões iguais | `[]` |

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/utils/medication-schedule-utils.test.ts`
Expected: FAIL, porque o módulo não existe.

- [ ] **Step 3: Implemente os tipos e as funções**

Siga as seções 5.3 e 5.4 da especificação. Crie um helper interno `sortMedicationVersions`, com `effectiveDate` e depois `createdAt`, em ordem crescente, sem alterar o array recebido.

- [ ] **Step 4: Rode e confirme que passa**

Run: `pnpm typecheck && pnpm vitest run src/utils/medication-schedule-utils.test.ts`
Expected: sem erros e PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(medications): add version lookup and comparison"
```

### Task 2: Normalização e validação

**Files:**
- Modify: `src/utils/medication-schedule-utils.ts`, `src/utils/medication-schedule-utils.test.ts`

**Interfaces:**
- Consumes: `normalizeItemName`, de `src/utils/expense-item-utils.ts`.
- Produces:
  - `normalizeMedicationVersionInput(input): MedicationVersionInput`
  - `validateMedicationVersionInput(input, versions, { today, editingVersionId }): MedicationValidationError[]`

- [ ] **Step 1: Escreva os testes**

| Teste | Esperado |
| :--- | :--- |
| Textos com espaços nas pontas | Sem espaços |
| `dosage: ' '`, `source: ''` e `responsible: '  '` | Campos ausentes |
| Dose `'  '` | Removida |
| Dose de medicamento ou horário inexistente | Removida |
| `times: ['21:00', '06:00']` | `['06:00', '21:00']` |
| Dose `'1.5 comprimidos'` e `'2 gotas'` | Iguais à entrada |
| Cada código da seção 5.2 | Código certo, com `medicationId` ou `time` quando houver |
| `2026-02-30` | `DATE_INVALID` |
| Horários `7:00`, `24:00`, `12:60` e `''` | `TIME_INVALID` |
| Data igual a `today` | Sem erro |
| Data igual à da última versão | Sem erro |
| Correção com data igual à da versão seguinte | Sem erro |
| Correção com data depois da seguinte | `DATE_OUT_OF_RANGE` |
| Correção da primeira versão com data antiga | Sem erro, por não ter versão anterior |
| `Quetiapina` com `25mg` e com `200mg` | Sem erro |
| `Quetiapina` e `quetiapina ` sem dosagem | `DUPLICATE_MEDICATION` |

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/utils/medication-schedule-utils.test.ts`
Expected: FAIL nos testes novos.

- [ ] **Step 3: Implemente as duas funções**

Siga as seções 5.1 e 5.2 da especificação. Horário válido combina com `/^([01]\d|2[0-3]):[0-5]\d$/`. A regra de data de correção usa os vizinhos na ordem de `sortMedicationVersions`, e as demais validações valem para versão nova e para correção.

- [ ] **Step 4: Rode e confirme que passa**

Run: `pnpm vitest run src/utils/medication-schedule-utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(medications): validate schedule versions"
```

### Task 3: Origem e sugestão de profissionais

**Files:**
- Modify: `src/utils/medication-schedule-utils.ts`, `src/utils/medication-schedule-utils.test.ts`

**Interfaces:**
- Produces:
  - `groupMedicationsBySource(version): MedicationSourceGroup[]`
  - `searchMedicationProfessionals(query, versions): string[]`
  - `PROFESSIONAL_SEARCH_MIN_LENGTH = 3`, `PROFESSIONAL_SEARCH_MAX_RESULTS = 4`

- [ ] **Step 1: Escreva os testes**

```ts
it('groups by source, with medications without a source last', () => {
  const groups = groupMedicationsBySource({
    medications: [
      { id: 'm1', name: 'Dutam' },
      { id: 'm2', name: 'Prolopa', source: 'Posto de Saúde' },
      { id: 'm3', name: 'Rasagilina', source: 'Farmácia de Minas' },
      { id: 'm4', name: 'Entacapona', source: 'posto de saude' },
    ],
  })

  expect(groups.map((g) => [g.source, g.medications.map((m) => m.id)])).toEqual([
    ['Posto de Saúde', ['m2', 'm4']],
    ['Farmácia de Minas', ['m3']],
    [null, ['m1']],
  ])
})

it('suggests recent professionals without repeats', () => {
  const versions = [
    version('v1', '2026-01-01', { professional: 'Dra. Ana Lima' }),
    version('v2', '2026-02-01', { professional: 'Dr. Pedro Lima' }),
    version('v3', '2026-03-01', { professional: 'dra. ana lima' }),
  ]

  expect(searchMedicationProfessionals('lim', versions)).toEqual(['dra. ana lima', 'Dr. Pedro Lima'])
  expect(searchMedicationProfessionals('li', versions)).toEqual([])
})
```

Adicione um teste com 5 nomes diferentes, que devolve 4.

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/utils/medication-schedule-utils.test.ts`
Expected: FAIL nos testes novos.

- [ ] **Step 3: Implemente conforme as seções 5.5 e 5.6 da especificação**

- [ ] **Step 4: Rode e confirme que passa**

Run: `pnpm vitest run src/utils/medication-schedule-utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(medications): group by source and suggest professionals"
```

### Task 4: Persistência e ações do store

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/services/storage-service.ts`, `src/services/storage-service.test.ts`
- Modify: `src/services/backup-service.ts`, `src/services/backup-service.spec.ts`
- Modify: `src/services/cloud-sync-service.ts`, `src/services/cloud-sync-service.spec.ts`
- Modify: `src/store/use-schedule-store.ts`
- Create: `src/store/medication-versions.test.ts`

**Interfaces:**
- Consumes: funções das Tasks 1 a 3.
- Produces:
  - `StorageService.getMedicationVersions()`, `StorageService.saveMedicationVersions(versions)`
  - `CloudSyncService.saveMedicationVersionsToCloud(versions, isAdmin?, ignoreSyncEnabled?)`
  - `CloudPullData.medicationVersions`
  - Estado e ações da seção 8 da especificação, e o tipo exportado `MedicationActionResult`

- [ ] **Step 1: Escreva os testes**

Em `src/store/medication-versions.test.ts`:

| Teste | Esperado |
| :--- | :--- |
| Criar a primeira versão | `ok: true`, com `id` começando em `medver_` |
| Criar versão com data anterior à última | `ok: false` com `DATE_BEFORE_LATEST` |
| Recusa | Estado e `StorageService.getMedicationVersions()` sem mudança |
| Criar versão nova | Versões anteriores idênticas às salvas |
| Às 23:30 locais de `2026-11-05`, com `vi.useFakeTimers` | Data `2026-11-05` aceita e `2026-11-06` recusada com `DATE_IN_FUTURE` |
| Corrigir versão | Mesmos `id` e `createdAt`, `updatedAt` novo, lista do mesmo tamanho |
| Corrigir id inexistente | `VERSION_NOT_FOUND` |
| Excluir a mais recente | Remove só ela e devolve `true` |
| Excluir sem versões | `false` |
| `reloadFromStorage` | Restaura as versões |
| `clearAllLocalData` | Limpa estado e storage |
| Sincronização ligada, nas três ações | `saveMedicationVersionsToCloud` chamado |

Nos serviços, cubra o que está na seção 10 da especificação. Em `backup-service.spec.ts`, confirme o store atualizado em restauração e merge. Em `cloud-sync-service.spec.ts`, confirme `null` sem o documento.

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/store/medication-versions.test.ts src/services`
Expected: FAIL nos testes novos.

- [ ] **Step 3: Implemente conforme as seções 8 e 9 da especificação**

Siga a lista "Adding a persisted field" do `CLAUDE.md`. As versões ficam fora de `MonthScheduleData`, pois usam documento global. Em `pullCloudData`, grave as versões só quando forem array, como em `rules`.

- [ ] **Step 4: Rode e confirme que passa**

Run: `pnpm typecheck && pnpm vitest run src/store src/services`
Expected: sem erros e PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(medications): persist and manage versions"
```

### Task 5: Rota `/medicamentos` e consulta de versões

**Files:**
- Create: `src/pages/medications-view.tsx`, `.test.tsx`, `.stories.tsx`
- Create: `src/locales/pt-BR/medications.json`, `src/locales/en-US/medications.json`
- Modify: `src/i18n.ts`, `src/router/index.tsx`, `src/router/route-config.ts`, `src/router/router.test.tsx`
- Modify: `src/types/index.ts` (`NavigationTab` com `'medications'`)
- Modify: `src/components/layout/root-layout.tsx`, `src/components/navigation/hover-sidebar.tsx`, `src/components/navigation/hover-sidebar.test.tsx`, `src/components/navigation/mobile-bottom-nav.tsx`
- Modify: `src/locales/pt-BR/common.json`, `src/locales/en-US/common.json` (`nav.medications`, `navShort.medications`)

**Interfaces:**
- Consumes: `getCurrentMedicationVersion`, `getMedicationVersionAt`, `getMedicationVersionHistory`, `groupMedicationsBySource`.
- Produces: `export function MedicationsView()`, namespace i18n `medications`, `NavigationTab` `'medications'`.

- [ ] **Step 1: Escreva os testes**

Em `router.test.tsx`:

```tsx
it('renders the medications screen on "/medicamentos"', async () => {
  vi.spyOn(backupService, 'hasExistingLocalData').mockResolvedValue(true)

  render(<TestAppRouter initialEntries={['/medicamentos']} />)

  expect(screen.getByTestId('medications-view')).toBeInTheDocument()
  expect(useScheduleStore.getState().currentView).toBe('medications')
})
```

Em `medications-view.test.tsx`:
- Sem versões, abre sem erro e oferece criar a primeira.
- Abre na versão vigente, com medicamentos, dosagens, horários e doses como texto.
- Medicamento sem dosagem aparece só com o nome.
- O médico responsável aparece quando existir.
- A lista mostra data, profissional, explicação e resumo de cada versão, da mais recente para a mais antiga.
- Escolher uma versão exibe a tabela dela.
- Informar uma data exibe a versão daquele dia.
- Informar data anterior à primeira versão mostra que não havia tabela.
- Há um caminho de volta à vigente.
- Consultar uma versão antiga não altera `medicationVersions`.
- O agrupamento por origem acompanha a versão exibida.
- Com 10 medicamentos, a tabela fica em um contêiner com rolagem própria.

Em `hover-sidebar.test.tsx`:
- A barra inferior (`mobile-bottom-nav`) mostra exatamente Escala, Compras, Medicamentos e o botão "Mais".

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/pages/medications-view.test.tsx src/router/router.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implemente a rota, a navegação e a tela**

Rota `medicamentos` dentro de `RootLayout`, protegida por `PrivateRoute`. Em `root-layout.tsx`, `path.startsWith('/medicamentos')` chama `setCurrentView('medications')`. O item usa `t('nav.medications')` em `navItems`, no `hover-sidebar.tsx`. Acrescente medicamentos em `bottomNavItems`, depois de compras, com `t('common:navShort.medications')`. Em `mobile-bottom-nav.tsx`, troque `grid-cols-3` por `grid-cols-4`. A versão exibida é estado local da tela. Os resumos de mudança são traduzidos a partir de `type`, com chaves em `medications.changes.*`.

- [ ] **Step 4: Rode e confirme que passa**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run src/pages src/router`
Expected: sem erros e PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(medications): add the medications route"
```

### Task 6: Criar, corrigir e excluir versões

**Files:**
- Create: `src/components/medications/medication-version-form.tsx`, `.test.tsx`, `.stories.tsx`
- Modify: `src/pages/medications-view.tsx`, `.test.tsx`
- Modify: `src/locales/pt-BR/medications.json`, `src/locales/en-US/medications.json`

**Interfaces:**
- Consumes: `addMedicationVersion`, `updateMedicationVersion`, `deleteLatestMedicationVersion`, `searchMedicationProfessionals`, `validateMedicationVersionInput`, `createMedicationId`.
- Produces: `export function MedicationVersionForm({ mode, baseVersion, version, onClose }: MedicationVersionFormProps)`, com `mode: 'NEW' | 'CORRECTION'`, `baseVersion?: MedicationScheduleVersion`, `version?: MedicationScheduleVersion`, `onClose: () => void`.

- [ ] **Step 1: Escreva os testes**

- Em `NEW`, a tabela vem igual à da versão vigente, com data, profissional e explicação vazios.
- Sem versões, `NEW` começa com a tabela vazia.
- Salvar com alteração cria uma versão, sem alterar as anteriores.
- Editar o rascunho sem salvar não altera `useScheduleStore.getState().medicationVersions`.
- Medicamento mantido na nova versão preserva o `id`, e medicamento novo recebe `createMedicationId()`.
- Incluir e remover medicamentos e horários funciona, e remover um deles descarta as doses dele.
- A célula aceita `1.5 comprimidos` e `2 gotas`, salvos sem mudança.
- Dosagem, origem e médico responsável são opcionais.
- Sem data, profissional ou explicação, os erros aparecem traduzidos, e nada é salvo.
- Data anterior à última versão mostra o erro correspondente.
- Com 3 letras, o campo sugere profissionais já usados, e escolher a sugestão preenche o campo.
- Em `CORRECTION`, os valores da versão vêm preenchidos, e salvar não cria outra versão.
- A exclusão pede confirmação com `ConfirmDialog` e só está disponível na versão mais recente.

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/components/medications`
Expected: FAIL.

- [ ] **Step 3: Implemente e ligue à tela**

Crie o rascunho com `structuredClone(baseVersion)`, para nunca alterar o objeto do store. Mostre os erros por `code`, com chaves em `medications.errors.*`.

- [ ] **Step 4: Rode e confirme que passa**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run src/components/medications src/pages`
Expected: sem erros e PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(medications): add the version form"
```

### Task 7: Imprimir o quadro de horários

**Files:**
- Modify: `src/utils/medication-schedule-utils.ts`, `src/utils/medication-schedule-utils.test.ts`
- Modify: `src/pages/medications-view.tsx`, `src/pages/medications-view.test.tsx`, `src/pages/medications-view.stories.tsx`
- Modify: `src/index.css`
- Modify: `src/locales/pt-BR/medications.json`, `src/locales/en-US/medications.json`

**Interfaces:**
- Produces: `getMedicationFileBaseName(effectiveDate: string, language: string): string`

- [ ] **Step 1: Escreva os testes**

Em `medication-schedule-utils.test.ts`:

```ts
it.each([
  ['2026-03-13', 'pt-BR', 'medicamentos-13-03-2026'],
  ['2026-03-13', 'en-US', 'medications-03-13-2026'],
])('builds the file name for %s in %s', (date, language, expected) => {
  expect(getMedicationFileBaseName(date, language)).toBe(expected)
})
```

Em `medications-view.test.tsx`, no padrão de `fullscreen-calendar-modal.test.tsx`:

```tsx
it('prints the displayed version with its file name and restores the title', () => {
  let titleDuringPrint = ''
  document.title = 'Original Title'
  vi.spyOn(window, 'print').mockImplementation(() => {
    titleDuringPrint = document.title
  })
  // renderize com a versão de 2026-03-13 vigente e clique na ação de imprimir

  expect(titleDuringPrint).toBe('medicamentos-13-03-2026')
  expect(document.title).toBe('Original Title')
})
```

Testes adicionais:
- Com uma versão antiga exibida, o título usa a data dela, e a folha de impressão mostra a tabela dela.
- A primeira parte da folha contém título, data, medicamentos com dosagem e médico responsável, horários e doses, sem o profissional.
- A parte de mudanças vem em um bloco com `print:break-before-page`, com data, profissional, explicação e resumo, da mais recente para a mais antiga.
- Com uma versão antiga exibida, as mudanças começam nela e não incluem as posteriores.
- Sem versões, a ação de imprimir não aparece.

- [ ] **Step 2: Rode e confirme a falha**

Run: `pnpm vitest run src/utils/medication-schedule-utils.test.ts src/pages/medications-view.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implemente a impressão**

`handlePrint` segue `fullscreen-calendar-modal.tsx`: salve `document.title`, troque, chame `window.print()` e restaure. Use `getMedicationFileBaseName` com `i18n.language`, e considere português quando o idioma começar com `pt`.

Envolva a área impressa em um contêiner com `id="medication-print-sheet"`, e marque o resto da tela com `print:hidden`. Monte as mudanças com `getMedicationVersionHistory`, descartando as entradas anteriores na lista à versão exibida. Esse bloco de mudanças só aparece na impressão, com `hidden print:block`, como em `fullscreen-calendar-modal.tsx`.

O CSS de impressão atual só cobre `#fullscreen-calendar-modal-container`. Em `src/index.css`, dentro do `@media print` existente, adicione regras para `#medication-print-sheet` e `html.dark #medication-print-sheet`, com fundo `#ffffff`, texto `#0f172a` e bordas `#cbd5e1`, com `!important`. Remova ali a altura máxima e a rolagem da tabela, para nada ser cortado. Mantenha o `@page` em paisagem.

- [ ] **Step 4: Rode e confirme que passa**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run src/utils/medication-schedule-utils.test.ts src/pages/medications-view.test.tsx`
Expected: sem erros e PASS.

- [ ] **Step 5: Confira a impressão no navegador**

Abra `pnpm dev`, ative o tema escuro e use "Salvar como PDF" com 10 medicamentos. O jsdom não aplica CSS de impressão, então essa conferência é manual. Confirme fundo branco, texto escuro, todas as colunas visíveis, nenhuma navegação na folha e as mudanças começando na página seguinte. Se não houver navegador disponível, relate isso em vez de considerar aprovado.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(medications): print the schedule as PDF"
```

### Task 8: Documentação e verificação final

**Files:**
- Modify: `PROJECT_CONTEXT.md`, `CLAUDE.md`, `README.md`

- [ ] **Step 1: Atualize a documentação**

- `PROJECT_CONTEXT.md`: `medicationVersions`, rota `/medicamentos`, `src/components/medications/`, `medication-schedule-utils.ts` e `_master_medication_versions`.
- `CLAUDE.md`: inclua `medication_versions` em `schedules/_master_{...}`.
- `README.md`: mencione a tabela de medicamentos com versões.

- [ ] **Step 2: Rode a verificação completa, sem filtro de logs**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run --silent=false`
Expected: sem erros, todos os testes passando e nenhum aviso `not wrapped in act`.

- [ ] **Step 3: Rode o build**

Run: `pnpm build`
Expected: exit 0.

- [ ] **Step 4: Confira os critérios da seção 11 da especificação, um a um**

Abra `pnpm dev`, percorra `/medicamentos` em tela estreita e larga e confirme os modos claro e escuro. Se não houver navegador disponível, relate isso em vez de considerar aprovado.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: describe the medication schedule"
```
