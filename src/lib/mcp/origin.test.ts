import { describe, it, expect } from 'vitest'
import { resolveOrigin } from './origin'

describe('resolveOrigin', () => {
  it('falls back to localhost in local dev (no Vercel env)', () => {
    expect(resolveOrigin({})).toBe('http://localhost:3000')
  })

  it('uses the stable production domain in production', () => {
    expect(
      resolveOrigin({
        VERCEL_ENV: 'production',
        VERCEL_PROJECT_PRODUCTION_URL: 'cycles.vasco.app',
        VERCEL_URL: 'cycles-abc123-vasco.vercel.app',
      })
    ).toBe('https://cycles.vasco.app')
  })

  it("uses this deployment's own URL in preview, not production's", () => {
    expect(
      resolveOrigin({
        VERCEL_ENV: 'preview',
        VERCEL_PROJECT_PRODUCTION_URL: 'cycles.vasco.app',
        VERCEL_URL: 'cycles-pr-42-vasco.vercel.app',
      })
    ).toBe('https://cycles-pr-42-vasco.vercel.app')
  })

  it('honours NEXT_PUBLIC_APP_URL override above everything and trims a trailing slash', () => {
    expect(
      resolveOrigin({
        NEXT_PUBLIC_APP_URL: 'https://custom.example.com/',
        VERCEL_ENV: 'production',
        VERCEL_PROJECT_PRODUCTION_URL: 'cycles.vasco.app',
      })
    ).toBe('https://custom.example.com')
  })

  it('falls back to NEXT_PUBLIC_ framework vars when system vars are absent', () => {
    expect(
      resolveOrigin({
        VERCEL_ENV: 'production',
        NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: 'cycles.vasco.app',
      })
    ).toBe('https://cycles.vasco.app')

    expect(
      resolveOrigin({
        VERCEL_ENV: 'preview',
        NEXT_PUBLIC_VERCEL_URL: 'cycles-pr-7-vasco.vercel.app',
      })
    ).toBe('https://cycles-pr-7-vasco.vercel.app')
  })
})
