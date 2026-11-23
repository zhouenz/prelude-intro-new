export const REVEAL_ANIMATIONS = [
  'fade',
  'fade-up',
  'fade-down',
  'fade-left',
  'fade-right',
  'zoom',
  'flip',
  'blur',
  'mask',
] as const

export type RevealAnimation = (typeof REVEAL_ANIMATIONS)[number]

export interface RevealOptions {
  once: boolean
  threshold: number
  rootMargin: string
  animation: RevealAnimation
  duration: number
  delay: number
  stagger: number
  easing: string
  respectReducedMotion: boolean
}

export interface RevealObserveOptions {
  animation?: RevealAnimation
  duration?: number
  delay?: number
}

export interface RevealInstance {
  readonly options: RevealOptions
  readonly count: number
  init(options?: Partial<RevealOptions>): RevealInstance
  refresh(): void
  observe(el: HTMLElement, options?: RevealObserveOptions): void
  unobserve(el: HTMLElement): void
  destroy(): void
}

const DEFAULTS: RevealOptions = {
  once: true,
  threshold: 0.15,
  rootMargin: '0px 0px -10% 0px',
  animation: 'fade-up',
  duration: 700,
  delay: 0,
  stagger: 80,
  easing: 'cubic-bezier(.22,.61,.36,1)',
  respectReducedMotion: true,
}

const HTML_CLASS = 'prelude-reveal'
const VISIBLE_CLASS = 'reveal--visible'

function reducedMotionEnabled(options: RevealOptions): boolean {
  if (!options.respectReducedMotion) return false
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function elements(root: ParentNode, selector: string): HTMLElement[] {
  const found = Array.from(root.querySelectorAll<HTMLElement>(selector))
  if (root instanceof HTMLElement && root.matches(selector)) found.unshift(root)
  return found
}

export function createReveal(input: Partial<RevealOptions> = {}): RevealInstance {
  let options: RevealOptions = { ...DEFAULTS, ...input }
  const observed = new Set<HTMLElement>()
  const visibleElements = new Set<HTMLElement>()
  let visible = new WeakSet<HTMLElement>()
  let processedGroups = new WeakSet<Element>()
  let groupDelays = new WeakMap<HTMLElement, number>()
  let io: IntersectionObserver | null = null
  let reduced = false
  let initialized = false

  const show = (el: HTMLElement) => {
    if (visible.has(el)) return
    visible.add(el)
    visibleElements.add(el)
    el.classList.add(VISIBLE_CLASS)
    el.setAttribute('data-reveal-visible', 'true')
  }

  const hide = (el: HTMLElement) => {
    if (!visible.has(el)) return
    visible.delete(el)
    visibleElements.delete(el)
    el.classList.remove(VISIBLE_CLASS)
    el.removeAttribute('data-reveal-visible')
  }

  const handleEntries = (entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      const el = entry.target as HTMLElement
      if (entry.isIntersecting) {
        show(el)
        if (options.once) {
          observed.delete(el)
          io?.unobserve(el)
        }
      } else if (!options.once) {
        hide(el)
      }
    }
  }

  const ensureObserver = (): IntersectionObserver | null => {
    if (reduced) return null
    if (io) return io
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return null
    io = new IntersectionObserver(handleEntries, {
      threshold: options.threshold,
      rootMargin: options.rootMargin,
    })
    observed.forEach((el) => io?.observe(el))
    return io
  }

  const resetObserver = () => {
    if (!io) return
    io.disconnect()
    io = null
  }

  const applyElement = (el: HTMLElement, overrides: RevealObserveOptions = {}) => {
    const attr = el.getAttribute('data-reveal')?.trim()
    const animation =
      overrides.animation ??
      (attr && (REVEAL_ANIMATIONS as readonly string[]).includes(attr)
        ? (attr as RevealAnimation)
        : options.animation)

    if (overrides.animation || !attr || !(REVEAL_ANIMATIONS as readonly string[]).includes(attr)) {
      el.setAttribute('data-reveal', animation)
    }

    const duration = overrides.duration ?? parseNumber(el.dataset.revealDuration) ?? options.duration
    const groupDelay = groupDelays.get(el)
    const delay =
      groupDelay ??
      overrides.delay ??
      parseNumber(el.dataset.revealDelay) ??
      options.delay

    el.style.setProperty('--reveal-duration', `${Math.max(0, duration)}ms`)
    el.style.setProperty('--reveal-delay', `${Math.max(0, delay)}ms`)
    el.style.setProperty('--reveal-ease', options.easing)

    const observer = ensureObserver()
    if (!observer) {
      show(el)
      return
    }

    if (visible.has(el)) {
      if (!options.once) {
        observed.add(el)
        observer.observe(el)
      }
      return
    }

    observed.add(el)
    observer.observe(el)
  }

  const scan = (root: ParentNode = document) => {
    if (typeof document === 'undefined') return

    document.documentElement.classList.add(HTML_CLASS)

    elements(root, '[data-reveal-group]').forEach((group) => {
      if (processedGroups.has(group)) return
      processedGroups.add(group)
      const stagger = parseNumber(group.dataset.revealStagger) ?? options.stagger
      const children = Array.from(group.querySelectorAll<HTMLElement>('[data-reveal]')).filter(
        (child) => child.closest('[data-reveal-group]') === group,
      )
      children.forEach((child, index) => {
        const base = parseNumber(child.dataset.revealDelay) ?? options.delay
        groupDelays.set(child, base + index * Math.max(0, stagger))
      })
    })

    elements(root, '[data-reveal]').forEach((el) => applyElement(el))
  }

  const instance: RevealInstance = {
    get options() {
      return options
    },
    get count() {
      return observed.size
    },
    init(next: Partial<RevealOptions> = {}) {
      options = { ...options, ...next }
      reduced = reducedMotionEnabled(options)
      resetObserver()
      initialized = true
      scan(document)
      return instance
    },
    refresh() {
      if (!initialized) {
        instance.init()
        return
      }
      scan(document)
    },
    observe(el, overrides) {
      reduced = reducedMotionEnabled(options)
      document.documentElement.classList.add(HTML_CLASS)
      applyElement(el, overrides)
    },
    unobserve(el) {
      observed.delete(el)
      io?.unobserve(el)
    },
    destroy() {
      io?.disconnect()
      io = null
      observed.clear()
      visibleElements.forEach((el) => {
        el.classList.remove(VISIBLE_CLASS)
        el.removeAttribute('data-reveal-visible')
      })
      visibleElements.clear()
      visible = new WeakSet<HTMLElement>()
      processedGroups = new WeakSet<Element>()
      groupDelays = new WeakMap<HTMLElement, number>()
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove(HTML_CLASS)
      }
      initialized = false
    },
  }

  return instance
}

export const reveal: RevealInstance = createReveal()
