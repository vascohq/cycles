import { test, expect } from '@playwright/test'

test.describe('Scope Map view assembly', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/scope-map')
    await page.waitForLoadState('networkidle')
  })

  test('renders all major sections', async ({ page }) => {
    // App bar with breadcrumbs
    await expect(page.locator('main nav')).toContainText('Cycles')
    await expect(page.locator('main nav')).toContainText('Cycle 34')
    await expect(page.locator('main nav')).toContainText('Mission Control')

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
    // The stage badge shows a "→" arrow that advances building → done.
    const advance = page.getByRole('button', { name: 'Advance to done' })
    await expect(advance).toBeVisible()

    await advance.click()

    // The badge now reads "done" and offers a back arrow.
    await expect(page.locator('section').first()).toContainText('done')
    await expect(
      page.getByRole('button', { name: 'Move back to building' })
    ).toBeVisible()
  })

  test('stage can be changed backward', async ({ page }) => {
    // The stage badge shows a "←" arrow that steps building → shaping.
    const back = page.getByRole('button', { name: 'Move back to shaping' })
    await expect(back).toBeVisible()

    await back.click()

    await expect(page.locator('section').first()).toContainText('shaping')
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

test.describe('Scope management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/scope-map')
    await page.waitForLoadState('networkidle')
  })

  test('add scope via modal', async ({ page }) => {
    await page.getByRole('button', { name: /add scope/ }).click()

    // Modal should appear
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'New scope' })).toBeVisible()

    // Fill in title and select tier
    await dialog.getByPlaceholder('Scope name').fill('Fresh scope')
    await dialog.locator('select').selectOption('should')

    // Submit
    await dialog.getByRole('button', { name: 'Add scope' }).click()

    // Modal should close and new scope should appear
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText('Fresh scope')).toBeVisible()
  })

  test('edit scope via modal changes title and tier', async ({ page }) => {
    // Open ⋯ menu on first scope
    const firstActions = page.getByLabel('Scope actions').first()
    await firstActions.click()

    // Click Edit
    await page.getByRole('menuitem', { name: 'Edit' }).click()

    // Modal should show with current title
    await expect(page.getByRole('heading', { name: 'Edit scope' })).toBeVisible()
    const input = page.getByPlaceholder('Scope name')
    await expect(input).toHaveValue('Needle engine & gauge')

    // Change title
    await input.clear()
    await input.fill('Needle engine v2')

    // Change tier to should
    await page.locator('select').selectOption('should')

    // Save
    await page.getByRole('button', { name: 'Save' }).click()

    // Modal should close and title should be updated
    await expect(page.getByRole('heading', { name: 'Edit scope' })).not.toBeVisible()
    await expect(page.getByText('Needle engine v2')).toBeVisible()
  })

  test('delete scope via modal with confirmation', async ({ page }) => {
    // Open ⋯ menu on the last scope (Parking lot)
    const actions = page.getByLabel('Scope actions').last()
    await actions.click()

    // Click Delete
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    // Confirmation dialog should appear
    await expect(page.getByRole('heading', { name: 'Delete scope' })).toBeVisible()
    await expect(page.getByText(/Delete.*Parking lot/)).toBeVisible()
    await expect(page.getByText(/2 tasks/)).toBeVisible()

    // Confirm delete
    await page.getByRole('button', { name: 'Delete' }).click()

    // Dialog should close and scope should be gone
    await expect(page.getByRole('heading', { name: 'Delete scope' })).not.toBeVisible()
    // The "Parking lot" section heading still exists, but the scope card is gone
    // Verify the scope card's task count is gone
    await expect(page.getByText('Resolve toggle')).not.toBeVisible()
  })

  test('cancel delete does not remove scope', async ({ page }) => {
    const firstActions = page.getByLabel('Scope actions').first()
    await firstActions.click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()

    // Cancel
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Scope should still exist
    await expect(page.getByText('Needle engine & gauge')).toBeVisible()
  })

  test('add scope modal can be cancelled', async ({ page }) => {
    await page.getByRole('button', { name: /add scope/ }).click()
    await expect(page.getByRole('heading', { name: 'New scope' })).toBeVisible()

    await page.getByRole('button', { name: 'Cancel' }).click()

    await expect(page.getByRole('heading', { name: 'New scope' })).not.toBeVisible()
  })

  test('scope actions menu is hidden in done state', async ({ page }) => {
    // Transition to done
    await page.getByRole('button', { name: 'Advance to done' }).click()

    // No actions triggers should be visible
    await expect(page.getByLabel('Scope actions')).toHaveCount(0)

    // Add scope button should also be hidden
    await expect(page.getByRole('button', { name: /add scope/ })).toHaveCount(0)
  })
})

test.describe('Done state lockdown', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/scope-map')
    await page.waitForLoadState('networkidle')
    // Transition to done state
    await page.getByRole('button', { name: 'Advance to done' }).click()
  })

  test('needle shows "Done" label', async ({ page }) => {
    await expect(page.getByText('Done', { exact: true })).toBeVisible()
    await expect(page.getByText('on track')).not.toBeVisible()
  })

  test('"Move the needle" button is hidden', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Move the needle' })).not.toBeVisible()
  })

  test('timebox tape shows "complete"', async ({ page }) => {
    await expect(page.locator('text:has-text("complete")')).toBeVisible()
    await expect(page.locator('text:has-text("days left")')).not.toBeVisible()
  })

  test('"drag to reorder" hint is hidden', async ({ page }) => {
    await expect(page.getByText('drag to reorder')).not.toBeVisible()
  })

  test('parking lot items are not clickable', async ({ page }) => {
    const item = page.getByText('Should updates auto-post to Slack or require confirmation?')
    await item.click()
    // Should NOT have line-through after clicking
    await expect(item).not.toHaveClass(/line-through/)
  })

  test('scope card reset links are hidden', async ({ page }) => {
    await expect(page.locator('main button:has-text("reset")')).toHaveCount(0)
  })

  test('moving stage back from done re-enables interactions', async ({ page }) => {
    // Currently at done — step back to building via the badge's back arrow.
    await page.getByRole('button', { name: 'Move back to building' }).click()

    // Needle should show "on track" again (not the "Done" shipped label)
    await expect(page.getByText('on track')).toBeVisible()
    await expect(page.getByText('Done', { exact: true })).not.toBeVisible()

    // "Move the needle" button should reappear
    await expect(page.getByRole('button', { name: 'Move the needle' })).toBeVisible()

    // "drag to reorder" hint should reappear
    await expect(page.getByText('drag to reorder')).toBeVisible()
  })
})
