import { describe, expect, it } from 'vitest'
import {
  clearIntroMemory,
  clearIntroSeen,
  isIntroSeen,
  markIntroSeen,
} from '../src/storage'

describe('storage', () => {
  it('stores session and local keys independently', () => {
    clearIntroMemory()
    clearIntroSeen('session', 'session-key')
    clearIntroSeen('local', 'local-key')

    markIntroSeen('session', 'session-key')

    expect(isIntroSeen('session', 'session-key')).toBe(true)
    expect(isIntroSeen('local', 'session-key')).toBe(false)
    expect(isIntroSeen(false, 'session-key')).toBe(false)

    markIntroSeen('local', 'local-key')
    expect(isIntroSeen('local', 'local-key')).toBe(true)
    expect(window.sessionStorage.getItem('session-key')).toBe('shown')
    expect(window.localStorage.getItem('local-key')).toBe('shown')
  })

  it('clears a key', () => {
    markIntroSeen('session', 'clear-me')
    expect(isIntroSeen('session', 'clear-me')).toBe(true)
    clearIntroSeen('session', 'clear-me')
    expect(isIntroSeen('session', 'clear-me')).toBe(false)
  })
})
