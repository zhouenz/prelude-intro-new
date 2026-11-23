import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INTRO_OPTIONS,
  parseIntroElement,
  resolveIntroOptions,
  type MediaOptions,
} from '../src/options'
import { resolveTransitionOptions } from '../src/transition'

describe('resolveIntroOptions', () => {
  it('merges defaults and normalizes primitives', () => {
    const options = resolveIntroOptions({
      variant: 'zoom',
      loader: 'bar',
      media: '/loading.gif',
      preload: '/a.png, /b.png',
      minDuration: 250,
      maxDuration: -10,
      time: 100,
    } as never)

    expect(options.variant).toBe('zoom')
    expect(options.loader).toBe('bar')
    expect(options.media).toEqual({ src: '/loading.gif' })
    expect(options.preload).toEqual(['/a.png', '/b.png'])
    expect(options.minDuration).toBe(250)
    expect(options.maxDuration).toBe(0)
    expect(options.enter).toBe(DEFAULT_INTRO_OPTIONS.enter)
  })

  it('falls back to valid variants and loaders', () => {
    const options = resolveIntroOptions({
      variant: 'nope' as never,
      loader: 'nope' as never,
      showOnce: 'forever' as never,
    })
    expect(options.variant).toBe('fade')
    expect(options.loader).toBe('spinner')
    expect(options.showOnce).toBe(false)
  })

  it('maps easing shortcuts and keeps unknown CSS easing', () => {
    expect(resolveIntroOptions({ easing: 'smooth' }).easing).toContain('cubic-bezier')
    expect(resolveIntroOptions({ easing: 'steps(4, end)' }).easing).toBe('steps(4, end)')
  })

  it('normalizes object media and keeps HTMLElement media', () => {
    const media = resolveIntroOptions({
      media: { src: '/x.webp', type: 'gif', fit: 'cover' },
    }).media as MediaOptions
    expect(media.type).toBe('gif')
    expect(media.fit).toBe('cover')

    const node = document.createElement('div')
    expect(resolveIntroOptions({ media: node }).media).toBe(node)
  })
})

describe('parseIntroElement', () => {
  it('reads data attributes', () => {
    const config = document.createElement('div')
    config.setAttribute('data-prelude', JSON.stringify({ variant: 'zoom', title: 'Hi' }))
    config.setAttribute('data-loader', 'dots')
    config.setAttribute('data-media', JSON.stringify({ src: '/a.gif', type: 'gif' }))
    config.setAttribute('data-preload', '/a.png, /b.png')
    config.setAttribute('data-min-duration', '250')
    config.setAttribute('data-show-once', 'session')
    config.setAttribute('data-dismissible', 'false')

    const options = parseIntroElement(config)

    expect(options.variant).toBe('zoom')
    expect(options.title).toBe('Hi')
    expect(options.loader).toBe('dots')
    expect((options.media as MediaOptions).src).toBe('/a.gif')
    expect(options.preload).toEqual(['/a.png', '/b.png'])
    expect(options.minDuration).toBe(250)
    expect(options.showOnce).toBe('session')
    expect(options.dismissible).toBe(false)
  })

  it('reads JSON config from script content', () => {
    const script = document.createElement('script')
    script.type = 'application/json'
    script.setAttribute('data-prelude', '')
    script.textContent = JSON.stringify({
      variant: 'curtain',
      loader: 'bar',
      media: { src: '/x.gif' },
      showProgressText: true,
    })

    const options = parseIntroElement(script)

    expect(options.variant).toBe('curtain')
    expect(options.loader).toBe('bar')
    expect((options.media as MediaOptions).src).toBe('/x.gif')
    expect(options.showProgressText).toBe(true)
  })

  it('ignores malformed JSON', () => {
    const config = document.createElement('div')
    config.setAttribute('data-prelude', '{bad json')
    config.setAttribute('data-media', '{also bad')
    const options = parseIntroElement(config)
    expect(options.variant).toBe('fade')
    expect(options.media).toBeNull()
  })
})

describe('resolveTransitionOptions', () => {
  it('normalizes defaults', () => {
    const options = resolveTransitionOptions()
    expect(options.variant).toBe('fade')
    expect(options.duration).toBe(500)
    expect(options.useViewTransition).toBe(true)
  })

  it('rejects unknown variants and clamps durations', () => {
    const options = resolveTransitionOptions({
      variant: 'rotate' as never,
      duration: -100,
      enterDuration: 80,
    })
    expect(options.variant).toBe('fade')
    expect(options.duration).toBe(0)
    expect(options.enterDuration).toBe(80)
  })
})
