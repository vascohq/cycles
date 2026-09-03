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

  test('opens fitted to the whole map, with one bubble per top-level region', async ({ page }) => {
    await expect(marks(page)).toHaveCount(3)
    await expect(marks(page).nth(0)).toHaveAttribute('aria-label', /^Front office, 6 frames/)
    await expect(marks(page).nth(1)).toHaveAttribute('aria-label', /^Back office, 8 frames/)
    await expect(marks(page).nth(2)).toHaveAttribute('aria-label', /^Connectors, 5 frames/)
  })

  test('a bubble numbers frames, not reports', async ({ page }) => {
    // Front office holds 6 frames carrying far more than 6 reports between them.
    await expect(marks(page).nth(0)).toHaveAttribute('aria-label', /6 frames/)
  })

  test('clicking a bubble zooms to that region and splits it into pins', async ({ page }) => {
    const before = await viewBox(page)
    await marks(page).nth(0).click()

    await expect
      .poll(async () => (await viewBox(page))[2])
      .toBeLessThan(before[2])
    // Front office's own 6 pins, each a mark of its own.
    await expect(marks(page).filter({ hasText: '' })).not.toHaveCount(3)
    await expect(
      page.locator('svg [role="button"][aria-label="Capture from Slack loses the thread link"]')
    ).toBeVisible()
  })

  test('clicking a pin opens its frame', async ({ page }) => {
    await marks(page).nth(0).click()
    await page
      .locator('svg [role="button"][aria-label="Capture from Slack loses the thread link"]')
      .click()

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

  test('names every region it draws', async ({ page }) => {
    await expect(page.getByText('Front office')).toBeVisible()
    await expect(page.getByText('Back office')).toBeVisible()
    await expect(page.getByText('Connectors')).toBeVisible()
  })

  test('every mark is reachable by keyboard', async ({ page }) => {
    const focusable = await marks(page).evaluateAll((nodes) =>
      nodes.every((n) => n.getAttribute('tabindex') === '0')
    )
    expect(focusable).toBe(true)
  })
})
