import { describe, expect, it } from 'vitest'
import { createReveal } from '../src/reveal'
import { FakeIntersectionObserver, setReducedMotion } from './setup'

describe('reveal', () => {
  it('observes elements and applies group stagger delays', () => {
    document.body.innerHTML = `
      <div data-reveal-group data-reveal-stagger="80">
        <div data-reveal="fade-up"></div>
        <div data-reveal="zoom"></div>
        <div data-reveal="blur"></div>
      </div>
    `

    const reveal = createReveal({ respectReducedMotion: false })
    reveal.init()

    const observer = FakeIntersectionObserver.instances[0]
    const children = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))

    expect(document.documentElement.classList.contains('prelude-reveal')).toBe(true)
    expect(observer).toBeTruthy()
    expect(observer.targets.size).toBe(3)
    expect(children[0].style.getPropertyValue('--reveal-delay')).toBe('0ms')
    expect(children[1].style.getPropertyValue('--reveal-delay')).toBe('80ms')
    expect(children[2].style.getPropertyValue('--reveal-delay')).toBe('160ms')
    expect(children[1].getAttribute('data-reveal')).toBe('zoom')

    observer.trigger()

    children.forEach((child) => {
      expect(child.classList.contains('reveal--visible')).toBe(true)
    })
    expect(observer.targets.size).toBe(0)

    reveal.destroy()
    expect(document.documentElement.classList.contains('prelude-reveal')).toBe(false)
  })

  it('applies per-element delay and duration', () => {
    document.body.innerHTML = `
      <div data-reveal="fade-left" data-reveal-delay="120" data-reveal-duration="400"></div>
    `

    const reveal = createReveal({ respectReducedMotion: false })
    reveal.init()

    const target = document.querySelector<HTMLElement>('[data-reveal]')!
    expect(target.style.getPropertyValue('--reveal-delay')).toBe('120ms')
    expect(target.style.getPropertyValue('--reveal-duration')).toBe('400ms')
    reveal.destroy()
  })

  it('observes dynamic elements through observe/refresh', () => {
    document.body.innerHTML = '<div id="host"></div>'
    const reveal = createReveal({ respectReducedMotion: false })
    reveal.init()

    const node = document.createElement('div')
    node.id = 'dynamic-node'
    document.querySelector('#host')!.appendChild(node)
    reveal.observe(node, { animation: 'zoom', delay: 50 })

    expect(node.getAttribute('data-reveal')).toBe('zoom')
    expect(node.style.getPropertyValue('--reveal-delay')).toBe('50ms')

    const observer = FakeIntersectionObserver.instances[0]
    expect(observer.targets.has(node)).toBe(true)

    reveal.refresh()
    expect(reveal.count).toBe(1)

    observer.trigger([{ target: node }])
    expect(node.classList.contains('reveal--visible')).toBe(true)
    reveal.destroy()
  })

  it('can hide and replay when once is false', () => {
    document.body.innerHTML = '<div data-reveal="fade-up"></div>'
    const reveal = createReveal({ once: false, respectReducedMotion: false })
    reveal.init()

    const target = document.querySelector<HTMLElement>('[data-reveal]')!
    const observer = FakeIntersectionObserver.instances[0]

    observer.trigger([{ target, isIntersecting: true }])
    expect(target.classList.contains('reveal--visible')).toBe(true)
    expect(observer.targets.has(target)).toBe(true)

    observer.trigger([{ target, isIntersecting: false }])
    expect(target.classList.contains('reveal--visible')).toBe(false)

    observer.trigger([{ target, isIntersecting: true }])
    expect(target.classList.contains('reveal--visible')).toBe(true)

    reveal.destroy()
  })

  it('resets state on destroy so init can replay', () => {
    document.body.innerHTML = '<div data-reveal="fade-up"></div>'
    const reveal = createReveal({ respectReducedMotion: false })
    reveal.init()

    const target = document.querySelector<HTMLElement>('[data-reveal]')!
    FakeIntersectionObserver.instances[0].trigger()
    expect(target.classList.contains('reveal--visible')).toBe(true)

    reveal.destroy()
    expect(target.classList.contains('reveal--visible')).toBe(false)

    reveal.init()
    expect(target.classList.contains('reveal--visible')).toBe(false)
    expect(FakeIntersectionObserver.instances[1].targets.has(target)).toBe(true)

    FakeIntersectionObserver.instances[1].trigger()
    expect(target.classList.contains('reveal--visible')).toBe(true)
    reveal.destroy()
  })

  it('reveals immediately when reduced motion is preferred', () => {
    setReducedMotion(true)
    document.body.innerHTML = '<div data-reveal="fade-up"></div>'

    const reveal = createReveal()
    reveal.init()

    const target = document.querySelector<HTMLElement>('[data-reveal]')!
    expect(target.classList.contains('reveal--visible')).toBe(true)
    expect(FakeIntersectionObserver.instances).toHaveLength(0)
    reveal.destroy()
  })

  it('reveals immediately when IntersectionObserver is unavailable', () => {
    const original = window.IntersectionObserver
    Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: undefined })
    document.body.innerHTML = '<div data-reveal></div>'

    const reveal = createReveal({ respectReducedMotion: false })
    reveal.init()

    const target = document.querySelector<HTMLElement>('[data-reveal]')!
    expect(target.classList.contains('reveal--visible')).toBe(true)
    expect(target.getAttribute('data-reveal')).toBe('fade-up')
    reveal.destroy()

    Object.defineProperty(window, 'IntersectionObserver', { writable: true, value: original })
  })
})
