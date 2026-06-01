import { describe, it, expect, vi, afterEach } from 'vitest'

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})
vi.mock('next/navigation', () => ({ notFound: () => notFound() }))

import E2ELayout from './layout'

afterEach(() => {
  vi.unstubAllEnvs()
  notFound.mockClear()
})

describe('E2ELayout', () => {
  it('404s the e2e fixture routes in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => E2ELayout({ children: null })).toThrow('NEXT_NOT_FOUND')
    expect(notFound).toHaveBeenCalledOnce()
  })

  it('renders the fixtures in development so Playwright can drive them', () => {
    vi.stubEnv('NODE_ENV', 'development')
    E2ELayout({ children: 'fixture' })
    expect(notFound).not.toHaveBeenCalled()
  })
})
