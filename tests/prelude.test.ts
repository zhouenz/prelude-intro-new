import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Prelude } from '../src/prelude'
import { clearIntroMemory, clearIntroSeen, isIntroSeen } from '../src/storage'

describe('Prelude', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mounts an accessible overlay and cleans up on immediate dismiss', async () => {
    const intro = new Prelude({
      waitFor: 'none',
      minDuration: 0,
      maxDuration: 0,
      autoStart: false,
      enter: 0,
      exit: 0,
    })

    intro.start()

    const root = document.querySelector<HTMLElement>('.prelude')
    expect(intro.state).toBe('waiting')
    expect(root).not.toBeNull()
    expect(root?.getAttribute('role')).toBe('status')
    expect(root?.getAttribute('aria-busy')).toBe('true')
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.getAttribute('aria-busy')).toBe('true')

    intro.dismiss({ immediate: true, reason: 'test' })

    expect(intro.state).toBe('hidden')
    expect(document.querySelector('.prelude')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(document.body.hasAttribute('aria-busy')).toBe(false)
    await expect(intro.done).resolves.toBeUndefined()
  })

  it('waits for minDuration and then dismisses automatically', async () => {
    const intro = new Prelude({
      waitFor: 'none',
      minDuration: 100,
      maxDuration: 0,
      autoStart: false,
      enter: 0,
      exit: 0,
    })

    intro.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(intro.state).toBe('waiting')

    await vi.advanceTimersByTimeAsync(100)
    expect(intro.state).toBe('leaving')

    await vi.advanceTimersByTimeAsync(200)
    expect(intro.state).toBe('hidden')
    expect(document.querySelector('.prelude')).toBeNull()
  })

  it('respects maxDuration as a hard timeout', async () => {
    const intro = new Prelude({
      waitFor: 'none',
      minDuration: 10000,
      maxDuration: 200,
      autoStart: false,
      enter: 0,
      exit: 0,
    })

    intro.start()
    await vi.advanceTimersByTimeAsync(200)
    expect(intro.state).toBe('leaving')
    await vi.advanceTimersByTimeAsync(200)
    expect(intro.state).toBe('hidden')
  })

  it('renders media, loader, progress text and updates progress', () => {
    const intro = new Prelude({
      waitFor: 'none',
      minDuration: 10000,
      maxDuration: 0,
      autoStart: false,
      loader: 'bar',
      showProgressText: true,
      media: { src: '/loading.gif', alt: 'loading' },
      title: 'Prelude',
      subtitle: '正在准备',
    })

    intro.start()
    const root = document.querySelector<HTMLElement>('.prelude')
    const image = document.querySelector<HTMLImageElement>('img.prelude__media-item')
    const progress = document.querySelector<HTMLElement>('.prelude__progress-text')

    expect(root?.classList.contains('prelude--fade')).toBe(true)
    expect(image?.getAttribute('src')).toBe('/loading.gif')
    expect(image?.alt).toBe('loading')
    expect(document.querySelector('.prelude__bar')).not.toBeNull()
    expect(progress?.hidden).toBe(true)

    intro.setProgress(0.42)

    expect(root?.style.getPropertyValue('--prelude-progress')).toBe('42%')
    expect(progress?.hidden).toBe(false)
    expect(progress?.textContent).toBe('42%')
    expect(root?.classList.contains('prelude--determinate')).toBe(true)

    intro.destroy()
    expect(document.querySelector('.prelude')).toBeNull()
  })

  it('renders custom element media', () => {
    const custom = document.createElement('div')
    custom.id = 'custom-media'

    const intro = new Prelude({
      waitFor: 'none',
      minDuration: 10000,
      maxDuration: 0,
      autoStart: false,
      loader: 'none',
      media: custom,
    })

    intro.start()
    expect(document.querySelector('#custom-media')).toBe(custom)
    expect(custom.classList.contains('prelude__media-item')).toBe(true)
    intro.destroy()
  })

  it('dismisses from skip button and escape key', async () => {
    const intro = new Prelude({
      waitFor: 'none',
      minDuration: 10000,
      maxDuration: 0,
      autoStart: false,
      exit: 0,
    })

    intro.start()
    document.querySelector<HTMLButtonElement>('.prelude__skip')?.click()
    await vi.advanceTimersByTimeAsync(200)
    expect(intro.state).toBe('hidden')

    const second = new Prelude({
      waitFor: 'none',
      minDuration: 10000,
      maxDuration: 0,
      autoStart: false,
      exit: 0,
    })
    second.start()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await vi.advanceTimersByTimeAsync(200)
    expect(second.state).toBe('hidden')
  })

  it('shows only once with storage', async () => {
    clearIntroMemory()
    clearIntroSeen('session', 'prelude-test-once')

    const first = new Prelude({
      waitFor: 'none',
      minDuration: 0,
      maxDuration: 0,
      autoStart: false,
      showOnce: 'session',
      storageKey: 'prelude-test-once',
      exit: 0,
    })
    first.start()
    expect(first.state).toBe('waiting')
    first.dismiss({ immediate: true })
    expect(isIntroSeen('session', 'prelude-test-once')).toBe(true)

    const second = new Prelude({ showOnce: 'session', storageKey: 'prelude-test-once' })
    second.start()
    expect(second.state).toBe('hidden')
    expect(document.querySelector('.prelude')).toBeNull()
    await expect(second.done).resolves.toBeUndefined()
  })
})
