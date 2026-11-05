# Tabela de medicamentos com versões

Data: 2026-11-05
Status: aprovada
Execução: nova IA, responsável pela funcionalidade inteira, incluindo a interface
Pré-requisito: feature de compras concluída, pois esta reaproveita `normalizeItemName`

## 1. Objetivo

Oferecer uma tabela de medicamentos, com medicamentos nas colunas, horários nas linhas e a dose em cada célula. Cada mudança da prescrição gera uma versão com data, profissional e explicação, e toda versão continua disponível para consulta.

Exemplo de tabela:

| Horário | Prolopa 100/25 | Quetiapina 200mg | Dutam |
| :--- | :--- | :--- | :--- |
| 06h | 1 comprimido | | |
| 11h | 1 comprimido | | 1 comprimido |
| 21h | | 1,5 comprimidos | |

## 2. Limite deste trabalho

Esta funcionalidade será implementada por outra IA, do modelo de dados à interface. Esta especificação define o comportamento e não define a aparência: layout, componentes, navegação, ícones e textos ficam a critério dela.

**Rota obrigatória:** a tabela precisa ter uma rota própria e nova, `/medicamentos`, protegida por `PrivateRoute` e registrada em `src/router/index.tsx`.

Não faz parte desta entrega:

- Importar a planilha antiga como versões da tabela; o histórico anterior entra como informações adicionais
- Usar uma versão antiga como base de uma nova
- Registrar doses tomadas, alertas de horário ou estoque
- Exportar para Excel
- Cadastro de profissionais
- Datas de versão no futuro

## 3. Decisões

| Tema | Decisão |
| :--- | :--- |
| Modelo | Tabela versionada; cada versão guarda a tabela inteira |
| Quantidade de tabelas | Uma, para um único paciente |
| Início do histórico | Na primeira versão cadastrada |
| Data da versão | Igual ou posterior à última versão, nunca no futuro |
| Duas versões na mesma data | Permitidas; vale a salva por último |
| Dados obrigatórios da versão | Data e explicação; o profissional é opcional em todas as versões, inclusive na primeira |
| Informações adicionais | Quantas o usuário quiser em cada versão, com explicação obrigatória e data e profissional opcionais. Podem ter data anterior à versão e não passam para a versão seguinte |
| Nome do medicamento | Texto obrigatório (ex.: "Quetiapina") |
| Dosagem do medicamento | Texto opcional (ex.: "200mg") |
| Origem do medicamento | Texto opcional, guardado na versão (ex.: "Posto de Saúde") |
| Médico responsável | Texto opcional, guardado na versão (ex.: "Dra. Marina") |
| Especialidade do médico | Texto opcional, guardado na versão (ex.: "Psiquiatra", "Urologista") |
| Dose na célula | Texto livre e opcional (ex.: "1.5 comprimidos", "2 gotas") |
| Profissional | Texto, com sugestões de nomes já usados |
| Correção de erro | Edita a própria versão, sem criar outra |
| Exclusão | Somente da versão mais recente |
| Nova versão | Começa com o conteúdo da versão vigente; ver seção 6.1 |

## 4. Modelo de dados

Em `src/types/index.ts`:

```ts
export interface MedicationColumn {
  id: string // o mesmo em todas as versões
  name: string
  dosage?: string
  source?: string
  responsible?: string
  specialty?: string
}

export interface MedicationVersionNote {
  id: string
  date?: string // 'YYYY-MM-DD'
  professional?: string
  text: string
}

export interface MedicationScheduleVersion {
  id: string
  effectiveDate: string // 'YYYY-MM-DD'
  professional?: string
  explanation: string
  notes?: MedicationVersionNote[] // mais recentes primeiro, sem data no final
  medications: MedicationColumn[]
  times: string[] // 'HH:mm', em ordem crescente
  doses: Record<string, Record<string, string>> // medicationId -> time -> dose
  createdAt: string
  updatedAt: string
}

export type MedicationVersionInput = Omit<
  MedicationScheduleVersion,
  'id' | 'createdAt' | 'updatedAt'
>
```

## 5. Regras de negócio

### 5.1 Normalização da entrada

`normalizeMedicationVersionInput` é aplicada antes de salvar:

- Remove espaços nas pontas de todos os textos.
- Campos opcionais vazios (`professional`, `dosage`, `source`, `responsible`, `specialty`) ficam ausentes.
- Informações adicionais totalmente vazias são removidas, e as demais ficam com as mais recentes primeiro.
- Doses vazias são removidas.
- Doses de medicamento ou horário inexistente na versão são removidas.
- `times` fica em ordem crescente.

A dose é guardada exatamente como digitada, sem conversão numérica.

### 5.2 Validação

`validateMedicationVersionInput` devolve uma lista de `{ code, medicationId?, time? }`, vazia quando a entrada é válida.

| Código | Condição |
| :--- | :--- |
| `DATE_INVALID` | Data fora do formato `YYYY-MM-DD` ou inexistente |
| `DATE_IN_FUTURE` | Data posterior a `today` |
| `DATE_BEFORE_LATEST` | Em versão nova, data anterior à última versão |
| `DATE_OUT_OF_RANGE` | Em correção, data antes da versão anterior ou depois da seguinte |
| `EXPLANATION_REQUIRED` | Explicação vazia |
| `NOTE_TEXT_REQUIRED` | Informação adicional iniciada, com data ou profissional, sem explicação |
| `MEDICATION_REQUIRED` | Nenhum medicamento |
| `MEDICATION_NAME_REQUIRED` | Medicamento com nome vazio |
| `DUPLICATE_MEDICATION` | Dois medicamentos com mesmo nome e mesma dosagem, normalizados |
| `TIME_REQUIRED` | Nenhum horário |
| `TIME_INVALID` | Horário fora do formato `HH:mm` válido |
| `DUPLICATE_TIME` | Horário repetido |

Mesmo nome com dosagens diferentes é permitido.

### 5.3 Versão vigente e consulta por data

- A ordem das versões é `effectiveDate` crescente, com desempate por `createdAt`.
- A versão em uma data é a última da ordem com `effectiveDate` menor ou igual a ela.
- Antes da primeira versão, o resultado é `undefined`.
- A vigente é a versão na data de hoje.

### 5.4 Comparação de versões

`getMedicationVersionChanges(previous, next)` devolve mudanças estruturadas, comparando medicamentos pelo `id`. Com `previous` indefinido, devolve lista vazia.

```ts
export type MedicationVersionChange =
  | { type: 'MEDICATION_ADDED'; medicationId: string; name: string; dosage?: string }
  | { type: 'MEDICATION_REMOVED'; medicationId: string; name: string; dosage?: string }
  | { type: 'MEDICATION_RENAMED'; medicationId: string; from: string; to: string }
  | { type: 'DOSAGE_CHANGED'; medicationId: string; name: string; from?: string; to?: string }
  | { type: 'SOURCE_CHANGED'; medicationId: string; name: string; from?: string; to?: string }
  | { type: 'RESPONSIBLE_CHANGED'; medicationId: string; name: string; from?: string; to?: string }
  | { type: 'SPECIALTY_CHANGED'; medicationId: string; name: string; from?: string; to?: string }
  | { type: 'TIME_ADDED'; time: string }
  | { type: 'TIME_REMOVED'; time: string }
  | { type: 'DOSE_CHANGED'; medicationId: string; name: string; time: string; from?: string; to?: string }
```

- `DOSE_CHANGED` só vale para medicamentos presentes nas duas versões, considerando a união dos horários.
- A dose é comparada como texto, ignorando espaços nas pontas e diferenças de maiúsculas.
- `name` em cada mudança é o nome em `next`, exceto em `MEDICATION_REMOVED`, que usa o nome em `previous`.

Exemplo: de "1 comprimido" para "0.5 comprimido" às 21:00 gera `DOSE_CHANGED` com `from: '1 comprimido'` e `to: '0.5 comprimido'`.

### 5.5 Agrupamento por origem

`groupMedicationsBySource(version)` agrupa medicamentos por `source`, comparando com `normalizeItemName`.

- Grupos seguem a ordem da primeira aparição.
- O texto do grupo é o da primeira aparição.
- Medicamentos sem origem ficam em um grupo final, com `source: null`.

### 5.6 Sugestão de profissionais

`searchMedicationProfessionals(query, versions)`:

- Sem sugestões abaixo de 3 caracteres normalizados.
- Encontra o texto em qualquer posição do nome normalizado.
- Remove nomes repetidos, normalizados, mantendo o mais recente.
- Ordena do uso mais recente para o mais antigo.
- Devolve no máximo 4 nomes.

### 5.7 Correção e exclusão

- `updateMedicationVersion` altera qualquer versão, mantendo `id` e `createdAt` e atualizando `updatedAt`. Não cria versão.
- A data corrigida precisa ficar entre as datas da versão anterior e da seguinte, inclusive.
- `deleteLatestMedicationVersion` remove a última versão da ordem da seção 5.3.
- Excluir versão anterior à última não é possível.

## 6. Requisitos da interface

Requisitos de produto, com a forma definida pela IA executora:

### 6.1 Tabela e cadastro

- A rota `/medicamentos` abre a versão vigente.
- Em telas abaixo de 768px, a barra inferior mostra calendário, compras e medicamentos, além de "Mais".
- Sem versões, a rota permite criar a primeira, que começa vazia.
- Uma nova versão começa com o conteúdo da versão vigente, e o usuário altera o que mudou.
- Data, profissional e explicação são preenchidos a cada nova versão, sem aproveitar os valores anteriores.
- O usuário pode incluir e remover medicamentos e horários.
- Cada medicamento tem nome, dosagem opcional, origem opcional, médico responsável opcional e especialidade opcional.
- Cada versão aceita quantas informações adicionais o usuário quiser, visíveis no histórico de versões e nas mudanças impressas.
- O filtro por data e a indicação da versão ficam no cartão da tabela, e a tabela fica logo abaixo do cabeçalho.
- Os horários usam `<input type="time">`, como nos eventos do dia, e são ordenados quando o campo perde o foco.
- A especialidade aparece como uma etiqueta, logo abaixo do nome e da dosagem, quando existir. O nome do médico fica no cadastro e no histórico de mudanças, fora da tabela.
- A dosagem aparece na frente do nome do medicamento quando existir.
- A origem não aparece na tabela, na tela ou na impressão; ela fica no cadastro e no agrupamento por origem.
- Cada célula aceita texto livre, como "1.5 comprimidos" ou "2 gotas".

### 6.2 Troca entre versões

- O usuário vê a lista de versões, da mais recente para a mais antiga, com data, profissional, explicação e resumo das mudanças.
- Escolher uma versão exibe a tabela dela.
- Informar uma data exibe a tabela vigente nesse dia.
- Olhar uma versão antiga não altera nenhum dado, e há um caminho direto de volta à vigente.

### 6.3 Origem

- O usuário consegue ver facilmente os medicamentos agrupados por origem, na versão exibida.

### 6.4 Impressão e PDF

- O usuário pode imprimir ou salvar em PDF o quadro de horários, pelo mesmo fluxo do calendário: `window.print()`, com `document.title` trocado durante a impressão e restaurado depois.
- A impressão usa a versão exibida, seja a vigente ou uma antiga escolhida.
- O resultado sai sempre no tema claro, mesmo com o tema escuro ativo.
- A primeira página contém o título, a data da versão e o quadro completo, com medicamentos, dosagens, especialidades, horários e doses. O profissional não aparece nela.
- A página seguinte mostra primeiro os medicamentos agrupados por origem, da versão impressa, e depois lista as mudanças, da mais recente para a mais antiga, começando pela versão impressa. Cada uma mostra data, profissional, explicação e resumo do que mudou.
- Mudanças posteriores à versão impressa não aparecem.
- A lista de mudanças pode ocupar mais de uma página.
- Navegação, botões, lista de versões e demais áreas da tela ficam fora da impressão.
- A rolagem própria da tabela não vale na impressão: nenhuma coluna ou linha pode ser cortada.
- Sem versões, não há impressão disponível.
- O nome do arquivo vem de `getMedicationFileBaseName`, pela data da versão: `medicamentos-13-03-2026` em português e `medications-03-13-2026` em inglês.

### 6.5 Recursos disponíveis

| Necessidade | Recurso |
| :--- | :--- |
| Versão vigente | `getCurrentMedicationVersion` |
| Versão em uma data | `getMedicationVersionAt` |
| Lista de versões com resumo | `getMedicationVersionHistory` |
| Agrupar por origem | `groupMedicationsBySource` |
| Sugerir profissionais | `searchMedicationProfessionals` |
| Validar antes de salvar | `validateMedicationVersionInput` |
| Criar id de medicamento | `createMedicationId` |
| Nome do arquivo de impressão | `getMedicationFileBaseName` |
| Salvar, corrigir e excluir | `addMedicationVersion`, `updateMedicationVersion`, `deleteLatestMedicationVersion` |

## 7. Funções puras

Arquivo novo: `src/utils/medication-schedule-utils.ts`. Nenhuma função acessa o store ou o storage.

```ts
export const PROFESSIONAL_SEARCH_MIN_LENGTH = 3
export const PROFESSIONAL_SEARCH_MAX_RESULTS = 4

export type MedicationValidationCode =
  | 'DATE_INVALID'
  | 'DATE_IN_FUTURE'
  | 'DATE_BEFORE_LATEST'
  | 'DATE_OUT_OF_RANGE'
  | 'EXPLANATION_REQUIRED'
  | 'NOTE_TEXT_REQUIRED'
  | 'MEDICATION_REQUIRED'
  | 'MEDICATION_NAME_REQUIRED'
  | 'DUPLICATE_MEDICATION'
  | 'TIME_REQUIRED'
  | 'TIME_INVALID'
  | 'DUPLICATE_TIME'
  | 'VERSION_NOT_FOUND'

export interface MedicationValidationError {
  code: MedicationValidationCode
  medicationId?: string
  time?: string
  noteId?: string
}

export interface MedicationVersionHistoryEntry {
  version: MedicationScheduleVersion
  changes: MedicationVersionChange[]
}

export interface MedicationSourceGroup {
  source: string | null
  medications: MedicationColumn[]
}

export function createMedicationId(): string
export function normalizeMedicationVersionInput(input: MedicationVersionInput): MedicationVersionInput
export function validateMedicationVersionInput(
  input: MedicationVersionInput,
  versions: MedicationScheduleVersion[],
  options: { today: string; editingVersionId?: string },
): MedicationValidationError[]
export function getCurrentMedicationVersion(
  versions: MedicationScheduleVersion[],
  today: string,
): MedicationScheduleVersion | undefined
export function getMedicationVersionAt(
  versions: MedicationScheduleVersion[],
  date: string,
): MedicationScheduleVersion | undefined
export function getMedicationVersionChanges(
  previous: MedicationScheduleVersion | undefined,
  next: MedicationScheduleVersion,
): MedicationVersionChange[]
export function getMedicationVersionHistory(
  versions: MedicationScheduleVersion[],
): MedicationVersionHistoryEntry[]
export function groupMedicationsBySource(
  version: Pick<MedicationScheduleVersion, 'medications'>,
): MedicationSourceGroup[]
export function searchMedicationProfessionals(
  query: string,
  versions: MedicationScheduleVersion[],
): string[]
export function getMedicationFileBaseName(effectiveDate: string, language: string): string
```

`getMedicationVersionHistory` devolve da versão mais recente para a mais antiga, e cada entrada compara a versão com a anterior na ordem da seção 5.3.

## 8. Store

Em `src/store/use-schedule-store.ts`.

Novo estado: `medicationVersions: MedicationScheduleVersion[]`.

```ts
export type MedicationActionResult =
  | { ok: true; version: MedicationScheduleVersion }
  | { ok: false; errors: MedicationValidationError[] }

addMedicationVersion: (input: MedicationVersionInput) => Promise<MedicationActionResult>
updateMedicationVersion: (
  versionId: string,
  input: MedicationVersionInput,
) => Promise<MedicationActionResult>
deleteLatestMedicationVersion: () => Promise<boolean>
```

- As ações normalizam, validam, gravam no storage, atualizam o estado e sincronizam.
- `today` vem de `format(new Date(), 'yyyy-MM-dd')`.
- `updateMedicationVersion` com id inexistente devolve `VERSION_NOT_FOUND`.
- `deleteLatestMedicationVersion` devolve `false` sem versões.
- `id` da versão usa o formato `medver_${Date.now()}_${random}`, e `createMedicationId` usa `med_${Date.now()}_${random}`.
- `saveSchedule`, `forcePushCloudData`, `pullCloudData`, `reloadFromStorage` e `clearAllLocalData` passam a tratar `medicationVersions`.

## 9. Persistência e nuvem

### Storage (`src/services/storage-service.ts`)

- Chave `MEDICATION_VERSIONS: 'scale_manager_medication_versions_v1'`
- `getMedicationVersions` e `saveMedicationVersions`
- Remoção em `resetToDefault`
- Inclusão em `getCurrentDataset` e `restoreDataset`, com `|| []`
- `GuestDataset.medicationVersions?: MedicationScheduleVersion[]`

### Backup (`src/services/backup-service.ts`)

- `AppDataSnapshot.medicationVersions?: MedicationScheduleVersion[]`
- `exportAppData` inclui as versões
- `validateAndParseBackup` normaliza para array
- `restoreAppData` grava no storage e no store, antes do `forcePushCloudData`
- `mergeAppData` combina por `id` e atualiza o store

### Nuvem (`src/services/cloud-sync-service.ts`)

- `saveMedicationVersionsToCloud(versions, isAdmin?, ignoreSyncEnabled?)` via `saveMasterListToCloud`, no documento `schedules/_master_medication_versions`, campo `versions`
- `CloudPullData.medicationVersions: MedicationScheduleVersion[] | null`, lido em `pullAllFromCloud`
- `pushAllToCloud` aceita `medicationVersions?: MedicationScheduleVersion[]`
- Sem o documento na nuvem, o pull mantém as versões locais
- `firestore.rules` não muda, pois a coleção `schedules` já cobre o novo documento

## 10. Testes

Testes novos em `src/utils/medication-schedule-utils.test.ts`:

- Normalização: textos com espaços, opcionais vazios, doses vazias, doses órfãs e ordem de horários
- Dose preservada como texto: `1.5 comprimidos` e `2 gotas`
- Validação: todos os códigos da seção 5.2, incluindo os limites inclusivos de data
- Mesmo nome com dosagens diferentes é aceito
- Versão vigente e por data: antes da primeira, na data exata, entre versões e empate de data
- Comparação: cada tipo de mudança, renomeação sem contar como inclusão e dose comparada sem diferenciar maiúsculas
- Histórico: ordem e resumo de cada versão, e primeira versão sem mudanças
- Origem: agrupamento, grafias diferentes da mesma origem e grupo sem origem no final
- Profissionais: 2 letras sem resultado, 3 com resultado, limite de 4, sem repetidos e mais recentes primeiro

Testes do store em `src/store/medication-versions.test.ts`:

- Criar a primeira versão e uma seguinte, com regras de data
- Recusa não altera estado nem storage
- Correção mantém `id` e `createdAt`, sem criar versão
- Correção de versão inexistente devolve `VERSION_NOT_FOUND`
- Exclusão remove só a mais recente
- `reloadFromStorage` e `clearAllLocalData`

Testes de persistência:

- `storage-service.test.ts`: leitura, gravação, limpeza e snapshot
- `backup-service.spec.ts`: exportação, restauração e merge, com o store atualizado
- `cloud-sync-service.spec.ts`: gravação e leitura de `_master_medication_versions`

Testes de interface:

- `router.test.tsx`: a rota `/medicamentos` abre a tela
- Abertura na versão vigente, troca de versão, consulta por data e volta à vigente
- Nova versão começa com o conteúdo vigente e com data, profissional e explicação vazios
- Medicamento aparece com e sem dosagem
- Célula salva texto livre
- Agrupamento por origem acompanha a versão exibida
- Imprimir chama `window.print()` com o título certo durante a impressão e restaura o título depois
- Imprimir uma versão antiga usa a data e o conteúdo dela, sem mudanças posteriores a ela
- A folha de impressão separa o quadro das mudanças, e o profissional só aparece nas mudanças
- Medicamento aparece com e sem médico responsável
- Sem versões, não há ação de imprimir

## 11. Critérios de aceite

- `pnpm validate` e `pnpm build` passam, sem avisos de `act`
- A rota `/medicamentos` existe e fica acessível em todas as larguras de tela
- Olhar uma versão antiga não altera nenhum dado
- Nova versão não altera versões existentes
- A impressão sai no tema claro e completa, mesmo com o tema escuro ativo, com o quadro na primeira página e as mudanças na seguinte
- Todo texto novo tem chave em `pt-BR` e `en-US`, e todo componente novo tem story
- `PROJECT_CONTEXT.md` e `CLAUDE.md` descrevem `medicationVersions`, a rota e o documento `_master_medication_versions`
