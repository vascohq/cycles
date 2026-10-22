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
  it('runs framing → shaping → building → done', () => {
    expect(STAGES).toEqual(['framing', 'shaping', 'building', 'done'])
  })
})

describe('newShapeStage', () => {
  it('starts a new pitch in a build cycle at framing', () => {
    expect(newShapeStage('build')).toBe('framing')
  })

  it('starts a cooldown shape at building', () => {
    expect(newShapeStage('cooldown')).toBe('building')
  })
})

describe('readStage', () => {
  it('passes every current stage through unchanged', () => {
    expect(readStage('framing')).toBe('framing')
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
    expect(nextStage('framing')).toBe('shaping')
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
    expect(prevStage('shaping')).toBe('framing')
  })

  it('returns null when already at the first stage', () => {
    expect(prevStage('framing')).toBeNull()
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
