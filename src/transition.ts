import {
  TRANSITION_VARIANTS,
  normalizeEasing,
  prefersReducedMotion,
  type TransitionVariant,
} from './options'

export interface TransitionOptions {
  variant: TransitionVariant
  duration: number
  enterDuration: number | null
  easing: string
  zIndex: number
  respectReducedMotion: boolean
  useViewTransition: boolean
}

export type TransitionState = 'idle' | 'covering' | 'covered' | 'revealing' | 'destroyed'

export interface TransitionInstance {
  readonly options: TransitionOptions
  readonly state: TransitionState
  leave(): Promise<void>
  enter(): Promise<void>
  run<T>(action: () => T | Promise<T>): Promise<T>
  destroy(): void
}

interface ViewTransitionLike {
  finished: Promise<void>
  ready: Promise<void>
  updateCallbackDone: Promise<unknown>
}

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void | Promise<unknown>) => ViewTransitionLike
}

const DEFAULT_TRANSITION_OPTIONS: TransitionOptions = {
  variant: 'fade',
  duration: 500,
  enterDuration: null,
  easing: 'cubic-bezier(.22,.61,.36,1)',
  zIndex: 9999,
  respectReducedMotion: true,
  useViewTransition: true,
}

function clampNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback
}

export function resolveTransitionOptions(
  input: Partial<TransitionOptions> = {},
): TransitionOptions {
  const variant =
    input.variant && (TRANSITION_VARIANTS as readonly string[]).includes(input.variant)
      ? input.variant
      : DEFAULT_TRANSITION_OPTIONS.variant

  return {
    ...DEFAULT_TRANSITION_OPTIONS,
    ...input,
    variant,
    duration: clampNumber(input.duration, DEFAULT_TRANSITION_OPTIONS.duration),
    enterDuration:
      input.enterDuration === null || input.enterDuration === undefined
        ? null
        : clampNumber(input.enterDuration, DEFAULT_TRANSITION_OPTIONS.duration),
    easing: normalizeEasing(input.easing),
    zIndex: clampNumber(input.zIndex, DEFAULT_TRANSITION_OPTIONS.zIndex),
    respectReducedMotion: input.respectReducedMotion !== false,
    useViewTransition: input.useViewTransition !== false,
  }
}

export function createTransition(input: Partial<TransitionOptions> = {}): TransitionInstance {
  const options = resolveTransitionOptions(input)
  const reduced = options.respectReducedMotion && prefersReducedMotion()
  const enterDuration = options.enterDuration ?? options.duration

  let el: HTMLElement | null = null
  let currentState: TransitionState = 'idle'
  let leaveTimer: ReturnType<typeof setTimeout> | null = null
  let enterTimer: ReturnType<typeof setTimeout> | null = null
  let leaveResolve: (() => void) | null = null
  let enterResolve: (() => void) | null = null
  let leavePromise: Promise<void> | null = null
  let enterPromise: Promise<void> | null = null

  const ensureElement = (): HTMLElement => {
    if (el) return el
    el = document.createElement('div')
    el.className = `prelude-rt prelude-rt--${options.variant}${reduced ? ' prelude-rt--reduced' : ''}`
    el.setAttribute('aria-hidden', 'true')
    el.style.setProperty('--rt-duration', `${options.duration}ms`)
    el.style.setProperty('--rt-enter', `${enterDuration}ms`)
    el.style.setProperty('--rt-ease', options.easing)
    el.style.setProperty('--rt-z', String(options.zIndex))

    if (options.variant === 'curtain') {
      const left = document.createElement('span')
      left.className = 'prelude-rt__panel prelude-rt__panel--left'
      const right = document.createElement('span')
      right.className = 'prelude-rt__panel prelude-rt__panel--right'
      el.append(left, right)
    }

    return el
  }

  const clearLeaveTimer = () => {
    if (leaveTimer) {
      clearTimeout(leaveTimer)
      leaveTimer = null
    }
    if (leaveResolve) {
      const resolve = leaveResolve
      leaveResolve = null
      resolve()
    }
  }

  const clearEnterTimer = () => {
    if (enterTimer) {
      clearTimeout(enterTimer)
      enterTimer = null
    }
  }

  const finishEnter = () => {
    clearEnterTimer()
    el?.remove()
    el?.classList.remove('is-active', 'is-done')
    currentState = 'idle'
    leavePromise = null
    enterPromise = null
    if (enterResolve) {
      const resolve = enterResolve
      enterResolve = null
      resolve()
    }
  }

  const leave = async (): Promise<void> => {
    if (currentState === 'destroyed') return
    if (currentState === 'covered') return
    if (leavePromise) return leavePromise
    if (currentState === 'revealing' && enterPromise) {
      await enterPromise
      return leave()
    }

    currentState = 'covering'
    const element = ensureElement()
    element.classList.remove('is-done')
    if (!element.isConnected) document.body.appendChild(element)

    if (reduced || options.duration <= 0) {
      element.classList.add('is-active')
      currentState = 'covered'
      return
    }

    void element.offsetWidth
    element.classList.add('is-active')

    leavePromise = new Promise<void>((resolve) => {
      leaveResolve = resolve
      leaveTimer = setTimeout(() => {
        leaveTimer = null
        leaveResolve = null
        leavePromise = null
        currentState = 'covered'
        resolve()
      }, options.duration + 20)
    })
    return leavePromise
  }

  const enter = async (): Promise<void> => {
    if (currentState === 'destroyed' || currentState === 'idle') return
    if (enterPromise) return enterPromise

    if (currentState === 'covering') {
      clearLeaveTimer()
      currentState = 'covered'
    }

    currentState = 'revealing'
    const element = ensureElement()

    if (reduced || enterDuration <= 0) {
      finishEnter()
      return
    }

    element.classList.add('is-done')
    enterPromise = new Promise<void>((resolve) => {
      enterResolve = resolve
      enterTimer = setTimeout(finishEnter, enterDuration + 20)
    })
    return enterPromise
  }

  const run = async <T>(action: () => T | Promise<T>): Promise<T> => {
    if (reduced) return action()

    const doc = document as DocumentWithViewTransition
    if (
      options.useViewTransition &&
      typeof doc.startViewTransition === 'function'
    ) {
      document.documentElement.style.setProperty('--prelude-rt-duration', `${options.duration}ms`)
      document.documentElement.dataset.preludeRt = options.variant
      let result!: T
      try {
        const transition = doc.startViewTransition(() => {
          result = action() as T
          return Promise.resolve(result)
        })
        await transition.finished
        return result
      } finally {
        delete document.documentElement.dataset.preludeRt
        document.documentElement.style.removeProperty('--prelude-rt-duration')
      }
    }

    await leave()
    try {
      return await action()
    } finally {
      await enter()
    }
  }

  return {
    get options() {
      return options
    },
    get state() {
      return currentState
    },
    leave,
    enter,
    run,
    destroy() {
      if (currentState === 'destroyed') return
      clearLeaveTimer()
      clearEnterTimer()
      el?.remove()
      el = null
      currentState = 'destroyed'
      leavePromise = null
      enterPromise = null
      if (enterResolve) {
        const resolve = enterResolve
        enterResolve = null
        resolve()
      }
    },
  }
}
