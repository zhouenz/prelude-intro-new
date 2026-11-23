import { afterEach, beforeEach } from 'vitest'

export class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []

  readonly callback: IntersectionObserverCallback
  readonly options?: IntersectionObserverInit
  readonly targets = new Set<Element>()

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback
    this.options = options
    FakeIntersectionObserver.instances.push(this)
  }

  observe(target: Element): void {
    this.targets.add(target)
  }

  unobserve(target: Element): void {
    this.targets.delete(target)
  }

  disconnect(): void {
    this.targets.clear()
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  trigger(entries?: Array<{ target: Element; isIntersecting?: boolean }>): void {
    const list =
      entries ??
      Array.from(this.targets).map((target) => ({ target, isIntersecting: true }))
    const payload = list.map(
      ({ target, isIntersecting = true }) =>
        ({
          target,
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRect: target.getBoundingClientRect(),
          rootBounds: null,
          time: Date.now(),
        }) as IntersectionObserverEntry,
    )
    this.callback(payload, this as unknown as IntersectionObserver)
  }
}

let reducedMotion = false

export function setReducedMotion(value: boolean): void {
  reducedMotion = value
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
})

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: FakeIntersectionObserver,
})

beforeEach(() => {
  FakeIntersectionObserver.instances = []
  reducedMotion = false
  document.documentElement.className = ''
  document.body.innerHTML = ''
  document.body.removeAttribute('aria-busy')
  document.body.style.cssText = ''
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  FakeIntersectionObserver.instances = []
  reducedMotion = false
  document.documentElement.className = ''
  document.body.innerHTML = ''
  document.body.removeAttribute('aria-busy')
  document.body.style.cssText = ''
})
