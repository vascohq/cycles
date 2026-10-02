import { test, expect } from '@playwright/test'

test.describe('Frame page', () => {
  test('shows the brief Paulo left, and where the frame stands', async ({ page }) => {
    await page.goto('/e2e/product-map/frames/f1')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Capture from Slack loses the thread link')
    await expect(page.getByText('Paulo left this on 2 Sept 2026')).toBeVisible()
    await expect(page.getByText('The fix is being built this cycle.')).toBeVisible()
    await expect(page.locator('[aria-current="step"]')).toContainText('In flight · Cycle 3')
    await expect(page.getByText('Capture squad').first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Open in Notion/ })).toHaveAttribute('href', 'https://notion.test/pitch')
  })

  // Nobody asks Paulo live: the button opens a new Claude chat with the frame typed in.
  test('asks Paulo again through a new chat that names the frame', async ({ page }) => {
    await page.goto('/e2e/product-map/frames/f1')

    const href = await page.getByRole('link', { name: /Ask Paulo again/ }).getAttribute('href')
    const prompt = new URL(href!).searchParams.get('q')
    expect(prompt).toContain('/paulo')
    expect(prompt).toContain('frame f1')
  })

  // Written before anything ships, so it reads as a draft while work is in flight.
  test('shows the release announcement as a draft until it ships', async ({ page }) => {
    await page.goto('/e2e/product-map/frames/f1')

    const note = page.getByRole('region', { name: 'Release announcement' })
    await expect(note).toContainText('links back to its thread')
    await expect(note).toContainText('Draft')
  })

  // Each part of the breadcrumb lands on that area's section of the map.
  test('links every part of the breadcrumb to its area section on the map', async ({ page }) => {
    await page.goto('/e2e/product-map/frames/f1')

    const crumbs = page.locator('a[href*="/product-map#area-"]')
    await expect(crumbs).toHaveCount(3)
    await expect(crumbs.last()).toHaveText('Slack / Teams')
    await expect(crumbs.last()).toHaveAttribute('href', /#area-slack$/)
  })

  test('says so when nobody has left a brief or an announcement yet', async ({ page }) => {
    await page.goto('/e2e/product-map/frames/f2')

    await expect(page.getByText('No release announcement yet.')).toBeVisible()
    await expect(page.getByText('No brief yet.')).toBeVisible()
    await expect(page.getByRole('link', { name: /^Ask Paulo/ })).toBeVisible()
  })

  // Reports and the cycle a shape started in share one timeline, newest first.
  test('puts the reports and the work on one timeline, newest first', async ({ page }) => {
    await page.goto('/e2e/product-map/frames/f1')

    const items = page.locator('ol.border-l li')
    await expect(items.first()).toContainText('24 Aug 2026')
    await expect(items.last()).toContainText('Cycle 3 started')
  })
})
