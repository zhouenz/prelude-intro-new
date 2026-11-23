import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTransition } from '../src/transition'
import { setReducedMotion } from './setup'

describe('transition', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('covers, then reveals, then removes the overlay', async () => {
    const transition = createTransition({
      variant: 'fade',
      duration: 100,
      useViewTransition: false,
      respectReducedMotion: false,
    })

    const leavePromise = transition.leave()
    const overlay = document.querySelector<HTMLElement>('.prelude-rt')
    expect(overlay).not.toBeNull()
    expect(overlay?.classList.contains('prelude-rt--fade')).toBe(true)
    expect(overlay?.classList.contains('is-active')).toBe(true)
    expect(transition.state).toBe('covering')

    await vi.advanceTimersByTimeAsync(120)
    await leavePromise
    expect(transition.state).toBe('covered')

    const enterPromise = transition.enter()
    expect(overlay?.classList.contains('is-done')).toBe(true)

    await vi.advanceTimersByTimeAsync(120)
    await enterPromise
    expect(transition.state).toBe('idle')
    expect(document.querySelector('.prelude-rt')).toBeNull()

    transition.destroy()
  })

  it('runs the action between leave and enter', async () => {
    const transition = createTransition({
      variant: 'slide',
      duration: 50,
      useViewTransition: false,
      respectReducedMotion: false,
    })
    const order: string[] = []

    const promise = transition.run(() => {
      order.push('action')
      return 'done'
    })
    order.push('after-run')

    await vi.advanceTimersByTimeAsync(70)
    expect(order).toEqual(['after-run', 'action'])

    await vi.advanceTimersByTimeAsync(70)
    await expect(promise).resolves.toBe('done')
    expect(document.querySelector('.prelude-rt')).toBeNull()

    transition.destroy()
  })

  it('falls back to the overlay when View Transitions are unavailable', async () => {
    expect('startViewTransition' in document).toBe(false)

    const transition = createTransition({
      variant: 'curtain',
      duration: 40,
      respectReducedMotion: false,
    })

    const promise = transition.run(() => 'ok')
    const overlay = document.querySelector<HTMLElement>('.prelude-rt')
    expect(overlay?.classList.contains('prelude-rt--curtain')).toBe(true)
    expect(overlay?.querySelectorAll('.prelude-rt__panel')).toHaveLength(2)

    await vi.advanceTimersByTimeAsync(60)
    await vi.advanceTimersByTimeAsync(60)
    await expect(promise).resolves.toBe('ok')

    transition.destroy()
  })

  it('skips the overlay when reduced motion is preferred', async () => {
    setReducedMotion(true)
    const transition = createTransition({ respectReducedMotion: true })

    await expect(transition.run(() => 'quiet')).resolves.toBe('quiet')
    expect(document.querySelector('.prelude-rt')).toBeNull()

    transition.destroy()
  })

  it('destroys a covering overlay immediately', async () => {
    const transition = createTransition({
      duration: 500,
      useViewTransition: false,
      respectReducedMotion: false,
    })

    void transition.leave()
    expect(document.querySelector('.prelude-rt')).not.toBeNull()

    transition.destroy()

    expect(transition.state).toBe('destroyed')
    expect(document.querySelector('.prelude-rt')).toBeNull()
  })
})
