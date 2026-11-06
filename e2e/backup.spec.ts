import { readFile } from 'node:fs/promises'

import { createPerson, expect, loginAsGuest, openRoute, test } from './support/fixtures'

import type { Page } from '@playwright/test'

const personCard = '[data-testid^="person-card-"]'

async function downloadBackup(page: Page) {
  await openRoute(page, 'configuracoes')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Baixar Cópia/ }).click()
  const download = await downloadPromise
  return { name: download.suggestedFilename(), path: await download.path() }
}

async function chooseBackup(page: Page, path: string) {
  await openRoute(page, 'configuracoes?tab=importar')
  await page.getByTestId('backup-file-input').setInputFiles(path)
}

async function expectPeopleCount(page: Page, count: number) {
  await openRoute(page, 'pessoas')
  await expect(page.locator(personCard)).toHaveCount(count)
}

test.beforeEach(async ({ page }) => {
  await loginAsGuest(page)
})

test('exports a dated JSON file with the app data', async ({ page }) => {
  const { name, path } = await downloadBackup(page)

  expect(name).toMatch(/^escala_backup_2026-06-15_\d{4}\.json$/)
  const backup = JSON.parse(await readFile(path, 'utf8'))
  expect(backup.people).toHaveLength(7)
  expect(Object.keys(backup.assignments).length).toBeGreaterThan(0)
})

test('overwrite restore brings back exactly what was exported', async ({ page }) => {
  const { path } = await downloadBackup(page)
  await createPerson(page, 'Pessoa Nova')

  await chooseBackup(page, path)
  await page.getByTestId('overwrite-restore-button').click()
  await page.getByRole('button', { name: 'Sim, Sobrescrever Dados' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await expectPeopleCount(page, 7)
  await expect(page.locator(personCard).filter({ hasText: 'Pessoa Nova' })).toHaveCount(0)
})

test('merge restore keeps local data without duplicating people', async ({ page }) => {
  const { path } = await downloadBackup(page)
  await createPerson(page, 'Pessoa Nova')

  await chooseBackup(page, path)
  await page.getByTestId('merge-restore-button').click()
  await expect(page.getByTestId('merge-restore-button')).toBeHidden()

  await expectPeopleCount(page, 8)
  await expect(page.locator(personCard).filter({ hasText: 'Pessoa Nova' })).toBeVisible()
})

test('a backup survives clearing all local data, and the restore survives a reload', async ({
  page,
}) => {
  const { path } = await downloadBackup(page)

  await page.getByRole('button', { name: 'Limpar Todos os Dados Locais' }).click()
  await page.getByRole('button', { name: 'Sim, Limpar Tudo' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expectPeopleCount(page, 0)

  await chooseBackup(page, path)
  await page.getByRole('button', { name: 'Restaurar Backup' }).click()
  await expect(page.getByTestId('backup-file-input')).toBeHidden()
  await page.reload()

  await expectPeopleCount(page, 7)
})

test('rejects a file that is not a backup and leaves the data alone', async ({ page }) => {
  await chooseBackup(page, 'package.json')

  await expect(page.getByTestId('overwrite-restore-button')).toHaveCount(0)
  await expect(page.getByText(/Estrutura do arquivo inválida/)).toBeVisible()
  await expectPeopleCount(page, 7)
})
