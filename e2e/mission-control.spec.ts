import { test, expect } from '@playwright/test'

test.describe('Mission Control view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/mission-control')
    await page.waitForLoadState('networkidle')
  })

  test('renders page heading and subtitle', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible()
    await expect(page.locator('header').getByText('Updates posted Tuesdays to #product-general')).toBeVisible()
  })

  test('renders in-flight section with correct count', async ({ page }) => {
    await expect(page.getByText('In flight')).toBeVisible()
    // Count badge shows 4
    const section = page.locator('section').filter({ hasText: 'In flight' })
    await expect(section.locator('.rounded-full').first()).toContainText('4')
  })

  test('renders all four in-flight pitch cards', async ({ page }) => {
    await expect(page.getByText('Redesign dashboard')).toBeVisible()
    await expect(page.getByText('Mobile push notifications')).toBeVisible()
    await expect(page.getByText('Search overhaul')).toBeVisible()
    await expect(page.getByText('Onboarding v2')).toBeVisible()
  })

  test('renders done section with correct count', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Done' })).toBeVisible()
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Done' }) })
    await expect(section.locator('.rounded-full').first()).toContainText('1')
  })

  test('renders done pitch card', async ({ page }) => {
    await expect(page.getByText('API rate limiting')).toBeVisible()
  })

  test('pitch cards show stage badges', async ({ page }) => {
    await expect(page.getByText('building').first()).toBeVisible()
    await expect(page.getByText('shaping')).toBeVisible()
    await expect(page.getByText('framing')).toBeVisible()
    await expect(page.locator('span.rounded-full:has-text("done")')).toBeVisible()
  })

  test('pitch cards show zone labels with correct text', async ({ page }) => {
    await expect(page.getByText('On track').first()).toBeVisible()
    await expect(page.getByText('Some risk')).toBeVisible()
    await expect(page.getByText('Concerned')).toBeVisible()
  })

  test('pitch cards show task counts', async ({ page }) => {
    await expect(page.getByText('8/12 tasks')).toBeVisible()
    await expect(page.getByText('3/9 tasks')).toBeVisible()
    await expect(page.getByText('1/7 tasks')).toBeVisible()
    await expect(page.getByText('0/0 tasks')).toBeVisible()
    await expect(page.getByText('5/5 tasks')).toBeVisible()
  })

  test('pitch cards are links to scope map', async ({ page }) => {
    const card = page.getByRole('link', { name: /Redesign dashboard/ })
    await expect(card).toHaveAttribute(
      'href',
      '/vasco/cycles/cycle-34/redesign-dashboard'
    )
  })

  test('responsive grid: 3 columns at wide viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 })
    const cards = page.locator('section').filter({ hasText: 'In flight' }).locator('a')
    const firstBox = await cards.nth(0).boundingBox()
    const secondBox = await cards.nth(1).boundingBox()
    expect(firstBox).toBeTruthy()
    expect(secondBox).toBeTruthy()
    // Cards should be side by side (same y position)
    expect(Math.abs(firstBox!.y - secondBox!.y)).toBeLessThan(5)
  })

  test('responsive grid: stacks at narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 })
    await page.waitForTimeout(100)
    const cards = page.locator('section').filter({ hasText: 'In flight' }).locator('a')
    const firstBox = await cards.nth(0).boundingBox()
    const secondBox = await cards.nth(1).boundingBox()
    expect(firstBox).toBeTruthy()
    expect(secondBox).toBeTruthy()
    // Cards should be stacked (different y position)
    expect(secondBox!.y).toBeGreaterThan(firstBox!.y + firstBox!.height - 5)
  })

  test('card hover shows shadow effect', async ({ page }) => {
    const card = page.getByRole('link', { name: /Redesign dashboard/ })
    await card.hover()
    const shadow = await card.evaluate((el) => getComputedStyle(el).boxShadow)
    expect(shadow).not.toBe('none')
  })

  test('footer renders', async ({ page }) => {
    await expect(
      page.getByText('mission control · click a pitch to open its scope map')
    ).toBeVisible()
  })

  test('add pitch button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Add pitch/ })).toBeVisible()
  })

  test('clicking add pitch opens dialog and creates a pitch', async ({ page }) => {
    await page.getByRole('button', { name: /Add pitch/ }).click()
    await expect(page.getByRole('heading', { name: 'New pitch' })).toBeVisible()

    await page.getByPlaceholder('What are we betting on?').fill('Billing v2')
    await page.getByRole('button', { name: 'Create' }).click()

    // Dialog closes and new pitch card appears
    await expect(page.getByRole('heading', { name: 'New pitch' })).not.toBeVisible()
    await expect(page.getByText('Billing v2')).toBeVisible()

    // Count badge updates to 5
    const section = page.locator('section').filter({ hasText: 'In flight' })
    await expect(section.locator('.rounded-full').first()).toContainText('5')
  })

  test('create button is disabled when title is empty', async ({ page }) => {
    await page.getByRole('button', { name: /Add pitch/ }).click()
    const createBtn = page.getByRole('button', { name: 'Create' })
    await expect(createBtn).toBeDisabled()
  })
})
