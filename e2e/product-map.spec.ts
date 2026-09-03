import { test, expect } from '@playwright/test'

/** The viewBox as [x, y, width, height]. Zoom is width: smaller means closer in. */
async function viewBox(page: import('@playwright/test').Page): Promise<number[]> {
  const raw = await page.locator('svg[aria-label="Product Map"]').getAttribute('viewBox')
  return (raw ?? '').split(' ').map(Number)
}

function marks(page: import('@playwright/test').Page) {
  return page.locator('svg[aria-label="Product Map"] [role="button"]')
}

test.describe('Product Map canvas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/e2e/product-map')
    await page.waitForLoadState('networkidle')
  })

/**
 * Shrink the window, so the whole map has to render small and its regions
 * collapse into bubbles.
 *
 * Zooming out cannot do this: the world is bounded, so "the whole map fits" is
 * already fully zoomed out. What makes a region collapse is its size ON SCREEN,
 * and that is what a small viewport changes.
 */
  async function shrink(page: import('@playwright/test').Page) {
    await page.setViewportSize({ width: 460, height: 420 })
    await expect.poll(async () => await bubbles(page).count()).toBeGreaterThan(0)
  }

  function bubbles(page: import('@playwright/test').Page) {
    return page.locator('svg [role="button"][aria-label*="frames."]')
  }

  test('names every top-level region', async ({ page }) => {
    await expect(page.getByText('Front office')).toBeVisible()
    await expect(page.getByText('Back office')).toBeVisible()
    await expect(page.getByText('Connectors')).toBeVisible()
  })

  test('collapses regions into numbered bubbles as the map shrinks', async ({ page }) => {
    const opened = await marks(page).count()
    expect(opened).toBeGreaterThan(3)

    await shrink(page)

    expect(await marks(page).count()).toBeLessThan(opened)
  })

  test('a bubble numbers frames, not reports', async ({ page }) => {
    await shrink(page)

    // Back office holds 8 frames, carrying more than 8 reports between them.
    const backOffice = page.locator('svg [role="button"][aria-label^="Back office,"]')
    await expect(backOffice).toHaveAttribute('aria-label', /Back office, 8 frames/)
  })

  test('clicking a bubble zooms to that region and splits it into pins', async ({ page }) => {
    await shrink(page)
    const backOffice = page.locator('svg [role="button"][aria-label^="Back office,"]')
    await expect(backOffice).toBeVisible()
    const before = await viewBox(page)

    await backOffice.click()

    await expect.poll(async () => (await viewBox(page))[2]).toBeLessThan(before[2])
    await expect(
      page.locator('svg [role="button"][aria-label="Batch writes drop the assignee"]')
    ).toBeVisible()
  })

  test('clicking a pin opens its frame', async ({ page }) => {
    // A big window renders the map large, so every region is past the collapse
    // size and its pins are drawn individually.
    await page.setViewportSize({ width: 1600, height: 1000 })
    const pin = page.locator(
      'svg [role="button"][aria-label="Capture from Slack loses the thread link"]'
    )
    await expect(pin).toBeVisible()

    await pin.click()

    await expect(page.getByTestId('opened-frame')).toHaveText('Opened: f1')
  })

  test('browsing the map never zooms out past the whole map', async ({ page }) => {
    const fitted = await viewBox(page)
    const host = page.locator('svg[aria-label="Product Map"]').locator('..')

    for (let i = 0; i < 20; i++) {
      await host.dispatchEvent('wheel', { deltaY: 400, clientX: 20, clientY: 20 })
    }

    // A bounded world: "the whole map fits" IS fully zoomed out.
    await expect.poll(async () => Math.round((await viewBox(page))[2])).toBe(Math.round(fitted[2]))
  })

  test('the customer lens drops the problems only the team raised', async ({ page }) => {
    await expect(page.getByTestId('counts')).toContainText('20 on the map')

    await page.getByRole('button', { name: 'Customers only' }).click()

    // Every frame that no customer ever reported leaves the land.
    await expect(page.getByTestId('counts')).not.toContainText('20 on the map')
    await expect(page.getByTestId('counts')).toContainText('on the map')
  })

  test('the internal lens and the customer lens disagree, which is the point', async ({ page }) => {
    await page.getByRole('button', { name: 'Internal only' }).click()
    const internal = await page.getByTestId('counts').textContent()

    await page.getByRole('button', { name: 'Customers only' }).click()
    const customer = await page.getByTestId('counts').textContent()

    expect(internal).not.toEqual(customer)
  })

  test('every mark is reachable by keyboard', async ({ page }) => {
    const focusable = await marks(page).evaluateAll((nodes) =>
      nodes.every((n) => n.getAttribute('tabindex') === '0')
    )
    expect(focusable).toBe(true)
  })
})
