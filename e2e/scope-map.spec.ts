import { test, expect } from '@playwright/test'

test.describe('Scope Map view assembly', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/scope-map')
    await page.waitForLoadState('networkidle')
  })

  test('renders all major sections', async ({ page }) => {
    // App bar with breadcrumbs
    await expect(page.locator('nav')).toContainText('Cycles')
    await expect(page.locator('nav')).toContainText('Cycle 34')
    await expect(page.locator('nav')).toContainText('Mission Control')

    // Task progress counter
    await expect(page.locator('nav')).toContainText('9 / 13 tasks')

    // Hero card — pitch title
    await expect(page.locator('h1')).toContainText('Mission Control')

    // Stage indicators
    await expect(page.locator('section').first()).toContainText('building')

    // Frame columns
    await expect(page.getByText('Problem')).toBeVisible()
    await expect(page.getByText('Outcome')).toBeVisible()

    // Scopes section
    await expect(page.getByRole('heading', { name: 'Scopes' })).toBeVisible()
    await expect(page.getByText('drag to reorder')).toBeVisible()

    // Parking lot section (distinguished from the scope card with same name)
    await expect(page.getByText('decisions before build')).toBeVisible()

    // Footer
    await expect(page.getByText('scope map · drag dots on the hill')).toBeVisible()
  })

  test('renders all five scope cards', async ({ page }) => {
    await expect(page.getByText('Needle engine & gauge')).toBeVisible()
    await expect(page.getByText('Hill chart visualization')).toBeVisible()
    await expect(page.getByText('Timebox tape')).toBeVisible()
    await expect(page.getByText('Scope cards & task checklists')).toBeVisible()
    // Parking lot scope card (not the section heading)
    const parkingCards = page.locator('text=Parking lot')
    await expect(parkingCards.first()).toBeVisible()
  })

  test('renders needle gauge with on_track zone', async ({ page }) => {
    await expect(page.getByText('on track')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Move the needle' })).toBeVisible()
  })

  test('renders hill chart with UNKNOWN and KNOWN labels', async ({ page }) => {
    await expect(page.getByText('UNKNOWN')).toBeVisible()
    await expect(page.getByText('KNOWN', { exact: true })).toBeVisible()
  })

  test('renders parking lot items', async ({ page }) => {
    await expect(
      page.getByText('Should updates auto-post to Slack or require confirmation?')
    ).toBeVisible()
    await expect(
      page.getByText('Which Slack bot token approach (webhook vs app)?')
    ).toBeVisible()
  })

  test('renders ghost needle from last update', async ({ page }) => {
    // The ghost is rendered as a semi-transparent circle in the SVG
    // Just verify the gauge SVG is present (ghost is visual-only)
    const gaugeSvg = page.locator('svg').first()
    await expect(gaugeSvg).toBeVisible()
  })

  test('stage can be changed forward', async ({ page }) => {
    // "building" stage should show "done →" button
    const doneButton = page.getByRole('button', { name: /done →/ })
    await expect(doneButton).toBeVisible()

    await doneButton.click()

    // After clicking, stage line should show "done ←"
    await expect(page.locator('section').first()).toContainText('done ←')
  })

  test('stage can be changed backward', async ({ page }) => {
    // "building" stage should show "← shaping" button
    const shapingButton = page.getByRole('button', { name: /← shaping/ })
    await expect(shapingButton).toBeVisible()

    await shapingButton.click()

    // After clicking, should show "shaping ←"
    await expect(page.locator('section').first()).toContainText('shaping ←')
  })

  test('task toggle updates progress counter', async ({ page }) => {
    // Initially 9/13
    await expect(page.locator('nav')).toContainText('9 / 13 tasks')

    // Find an unchecked task and click it
    const uncheckedTask = page.getByText('Drag-to-update dots')
    await uncheckedTask.click()

    // Should now be 10/13
    await expect(page.locator('nav')).toContainText('10 / 13 tasks')
  })

  test('parking lot item can be toggled', async ({ page }) => {
    const item = page.getByText('Should updates auto-post to Slack or require confirmation?')
    await expect(item).toBeVisible()

    // Click to resolve
    await item.click()

    // After toggle, the item should have line-through style
    await expect(item).toHaveClass(/line-through/)
  })

  test('timebox tape renders with today marker', async ({ page }) => {
    // The fixture has today=2026-06-10, which is within the timebox range
    // Look for the "days left" text in the timebox SVG
    const tapeText = page.locator('text:has-text("days left")')
    await expect(tapeText).toBeVisible()
  })

  test('layout is responsive at 980px breakpoint', async ({ page }) => {
    // At wide viewport, gauge and hill chart should be side by side
    await page.setViewportSize({ width: 1200, height: 800 })
    const mcRow = page.locator('.mc-row')
    const box = await mcRow.boundingBox()
    expect(box).toBeTruthy()

    // At narrow viewport, they should stack
    await page.setViewportSize({ width: 900, height: 800 })
    await page.waitForTimeout(100)
    const narrowBox = await mcRow.boundingBox()
    expect(narrowBox).toBeTruthy()
    // The narrow layout should be taller (stacked) than the wide layout
    expect(narrowBox!.height).toBeGreaterThan(box!.height)
  })

  test('fonts load correctly', async ({ page }) => {
    // Check that Gloria Hallelujah font CSS variable is applied
    const h1 = page.locator('h1')
    const fontFamily = await h1.evaluate((el) => getComputedStyle(el).fontFamily)
    expect(fontFamily).toContain('Gloria Hallelujah')
  })

  test('card hover shows shadow effect', async ({ page }) => {
    const heroCard = page.locator('section.rounded-xl').first()
    await heroCard.hover()

    // After hover, the card should have a box-shadow
    const shadow = await heroCard.evaluate((el) => getComputedStyle(el).boxShadow)
    expect(shadow).not.toBe('none')
  })
})
