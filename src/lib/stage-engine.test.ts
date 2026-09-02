import { describe, it, expect } from 'vitest'
import {
  STAGES,
  newShapeStage,
  readStage,
  nextStage,
  prevStage,
  stageAfterNeedle,
} from './stage-engine'

describe('STAGES', () => {
  it('runs shaping → building → done', () => {
    expect(STAGES).toEqual(['shaping', 'building', 'done'])
  })

  it('has no framing stage — framing happens on the Product Map', () => {
    expect(STAGES).not.toContain('framing')
  })
})

describe('newShapeStage', () => {
  it('starts a new shape in a build cycle at shaping', () => {
    expect(newShapeStage('build')).toBe('shaping')
  })

  it('starts a cooldown shape at building', () => {
    expect(newShapeStage('cooldown')).toBe('building')
  })
})

describe('readStage', () => {
  it('reads a stored framing value as shaping', () => {
    expect(readStage('framing')).toBe('shaping')
  })

  it('passes every current stage through unchanged', () => {
    expect(readStage('shaping')).toBe('shaping')
    expect(readStage('building')).toBe('building')
    expect(readStage('done')).toBe('done')
  })

  it('falls back to shaping for an unknown or missing value', () => {
    expect(readStage('nonsense')).toBe('shaping')
    expect(readStage(undefined)).toBe('shaping')
    expect(readStage('')).toBe('shaping')
  })
})

describe('nextStage', () => {
  it('advances one step forward', () => {
    expect(nextStage('shaping')).toBe('building')
    expect(nextStage('building')).toBe('done')
  })

  it('returns null when already at the last stage', () => {
    expect(nextStage('done')).toBeNull()
  })
})

describe('prevStage', () => {
  it('steps one stage backward', () => {
    expect(prevStage('done')).toBe('building')
    expect(prevStage('building')).toBe('shaping')
  })

  it('returns null when already at the first stage', () => {
    expect(prevStage('shaping')).toBeNull()
  })
})

describe('stageAfterNeedle', () => {
  it('flips the stage to done once the needle reaches 100%', () => {
    expect(stageAfterNeedle(1, 'building')).toBe('done')
    expect(stageAfterNeedle(1, 'shaping')).toBe('done')
  })

  it('leaves the stage unchanged below 100%', () => {
    expect(stageAfterNeedle(0.92, 'building')).toBe('building')
    expect(stageAfterNeedle(0, 'shaping')).toBe('shaping')
  })

  it('leaves an already-done pitch done', () => {
    expect(stageAfterNeedle(1, 'done')).toBe('done')
  })
})
