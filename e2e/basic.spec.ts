import { expect, isDevArtifact, name, test } from './fixtures'

test('example test', async ({ page }, testInfo) => {
  testInfo.skip(!isDevArtifact(), 'contentScript uses a closed ShadowRoot outside dev artifacts')

  await page.goto('https://example.com')

  await expect(page.locator(`#${name} button`)).toBeVisible()
})

test('popup page', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/dist/popup/index.html`)
  await expect(page.locator('button')).toHaveText('Open Options')
})

test('options page', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/dist/database/index.html`)
  await expect(page.locator('text=Database Viewer')).toBeVisible()
})
