import { Emitter } from './events'
import { buildIntroDOM, lockScroll, setBodyBusy, type IntroDomRefs } from './dom'
import {
  resolveContainer,
  resolveIntroOptions,
  prefersReducedMotion,
  type IntroOptions,
} from './options'
import { waitFor, type CancellableWait } from './wait'
import { preloadAssets, type PreloadTask } from './preload'
import { isIntroSeen, markIntroSeen } from './storage'

export type PreludeState = 'idle' | 'waiting' | 'leaving' | 'hidden' | 'destroyed'

export interface IntroEventMap {
  show: { el: HTMLElement }
  progress: { value: number; percent: number }
  ready: { el: HTMLElement }
  dismiss: { reason: string; immediate: boolean }
  hidden: { reason: string }
  error: { source: string; error: unknown }
  destroy: { el: HTMLElement | null }
}

export interface DismissOptions {
  immediate?: boolean
  reason?: string
}

export class Prelude {
  readonly options: IntroOptions
  readonly done: Promise<void>
  readonly events = new Emitter<IntroEventMap>()

  private refs: IntroDomRefs | null = null
  private el: HTMLElement | null = null
  private currentState: PreludeState = 'idle'
  private reduced: boolean
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private cleanups: Array<() => void> = []
  private waitTask: CancellableWait | null = null
  private preloadTask: PreloadTask | null = null
  private conditionMet = false
  private minElapsed = false
  private preloadDone = false
  private ready = false
  private dismissed = false
  private hasShown = false
  private seen = false
  private progressKnown = false
  private progressValue = 0
  private resolveDone!: () => void

  constructor(input: Partial<IntroOptions> = {}) {
    this.options = resolveIntroOptions(input)
    this.reduced = this.options.respectReducedMotion && prefersReducedMotion()
    this.done = new Promise<void>((resolve) => {
      this.resolveDone = resolve
    })
  }

  get state(): PreludeState {
    return this.currentState
  }

  get element(): HTMLElement | null {
    return this.el
  }

  get progress(): number {
    return this.progressValue
  }

  on<K extends keyof IntroEventMap>(type: K, listener: (payload: IntroEventMap[K]) => void): () => void {
    return this.events.on(type, listener)
  }

  off<K extends keyof IntroEventMap>(type: K, listener: (payload: IntroEventMap[K]) => void): void {
    this.events.off(type, listener)
  }

  start(): this {
    if (this.currentState !== 'idle') return this

    if (typeof document === 'undefined') {
      this.currentState = 'hidden'
      this.resolveDone()
      return this
    }

    if (this.options.showOnce && isIntroSeen(this.options.showOnce, this.options.storageKey)) {
      this.seen = true
      this.currentState = 'hidden'
      this.resolveDone()
      return this
    }

    this.mount()
    return this
  }

  setProgress(value: number): this {
    const numeric = Number.isFinite(value) ? value : 0
    this.progressValue = Math.min(1, Math.max(0, numeric))
    this.progressKnown = true

    if (this.el) {
      const percent = this.progressValue * 100
      this.el.style.setProperty('--prelude-progress', `${percent}%`)
      this.el.classList.remove('prelude--indeterminate')
      this.el.classList.add('prelude--determinate')
    }

    if (this.refs?.progressText) {
      this.refs.progressText.hidden = false
      this.refs.progressText.textContent = this.options.progressFormat(this.progressValue)
    }

    this.events.emit('progress', {
      value: this.progressValue,
      percent: this.progressValue * 100,
    })
    return this
  }

  dismiss(options: DismissOptions = {}): void {
    if (this.dismissed) return
    if (this.currentState === 'hidden' || this.currentState === 'destroyed') return

    if (this.currentState === 'idle' || !this.el) {
      this.dismissed = true
      this.finish(options.reason ?? 'dismiss')
      return
    }

    const immediate = options.immediate === true || this.reduced
    const reason = options.reason ?? 'manual'
    this.dismissed = true
    this.currentState = 'leaving'
    this.events.emit('dismiss', { reason, immediate })

    this.clearTimers()
    this.preloadTask?.cancel()
    this.preloadTask = null
    this.waitTask?.cancel()
    this.waitTask = null

    if (immediate) {
      this.finish(reason)
      return
    }

    this.el.classList.add('prelude--leaving')
    this.el.dataset.state = 'leaving'
    this.el.setAttribute('aria-busy', 'false')

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      this.finish(reason)
    }

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target === this.el) finish()
    }
    this.el.addEventListener('transitionend', onTransitionEnd)
    this.cleanups.push(() => this.el?.removeEventListener('transitionend', onTransitionEnd))
    this.later(finish, this.options.exit + 120)
  }

  destroy(reason = 'destroy'): void {
    if (this.currentState === 'destroyed') return
    const emitHidden = this.hasShown && this.currentState !== 'hidden'
    this.dismissed = true
    this.clearTimers()
    this.preloadTask?.cancel()
    this.preloadTask = null
    this.waitTask?.cancel()
    this.waitTask = null
    this.runCleanups()
    if (this.el) {
      this.el.remove()
      this.el = null
      this.refs = null
    }
    this.currentState = 'destroyed'
    this.events.emit('destroy', { el: null })
    if (emitHidden) this.events.emit('hidden', { reason })
    this.resolveDone()
  }

  private mount(): void {
    const win = document.defaultView
    if (this.reduced && win) {
      this.reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? this.reduced
    }

    const refs = buildIntroDOM(this.options, this.reduced)
    this.refs = refs
    this.el = refs.root

    const container = resolveContainer(this.options.container)
    container.appendChild(refs.root)

    if (this.options.lockScroll) {
      this.cleanups.push(lockScroll())
    }
    this.cleanups.push(setBodyBusy(document, true))

    if (refs.skip) {
      refs.skip.addEventListener('click', (event) => {
        event.stopPropagation()
        this.dismiss({ reason: 'skip' })
      })
    }

    if (this.options.closeOnClick) {
      refs.root.addEventListener('click', () => {
        this.dismiss({ reason: 'click' })
      })
    }

    if (this.options.dismissible) {
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') this.dismiss({ reason: 'escape' })
      }
      document.addEventListener('keydown', onKeyDown)
      this.cleanups.push(() => document.removeEventListener('keydown', onKeyDown))
    }

    const mediaEl = refs.media
    if (mediaEl) {
      const onMediaError = (event: Event) => {
        this.events.emit('error', { source: 'media', error: event })
      }
      mediaEl.addEventListener('error', onMediaError, true)
      this.cleanups.push(() => mediaEl.removeEventListener('error', onMediaError, true))
    }

    this.currentState = 'waiting'
    this.hasShown = true
    this.events.emit('show', { el: refs.root })

    this.startPreload()
    this.startWaiting()
  }

  private startPreload(): void {
    if (this.options.preload.length === 0) {
      this.preloadDone = true
      if (this.options.loader === 'bar' && this.el && !this.progressKnown) {
        this.el.classList.add('prelude--indeterminate')
      }
      return
    }

    this.progressKnown = true
    this.el?.classList.remove('prelude--indeterminate')
    this.el?.classList.add('prelude--determinate')
    this.setProgress(0)

    const task = preloadAssets(this.options.preload, (loaded, total) => {
      this.setProgress(total > 0 ? loaded / total : 1)
    })
    this.preloadTask = task

    task.promise.then((result) => {
      if (this.currentState !== 'waiting') return
      this.preloadDone = true
      if (result.failures.length > 0) {
        this.events.emit('error', { source: 'preload', error: result.failures })
      }
      this.maybeReady()
    })
  }

  private startWaiting(): void {
    const task = waitFor(this.options.waitFor)
    this.waitTask = task
    task.promise.then(() => {
      this.conditionMet = true
      this.maybeReady()
    })

    if (this.options.minDuration <= 0) {
      this.minElapsed = true
    } else {
      this.later(() => {
        this.minElapsed = true
        this.maybeReady()
      }, this.options.minDuration)
    }

    if (this.options.maxDuration > 0) {
      this.later(() => {
        this.dismiss({ reason: 'timeout' })
      }, this.options.maxDuration)
    }

    queueMicrotask(() => this.maybeReady())
  }

  private maybeReady(): void {
    if (this.ready || this.dismissed || this.currentState !== 'waiting') return
    if (!this.conditionMet || !this.minElapsed || !this.preloadDone) return
    if (!this.el) return

    this.ready = true
    this.events.emit('ready', { el: this.el })

    if (this.options.hold > 0) {
      this.later(() => this.dismiss({ reason: 'hold' }), this.options.hold)
    } else {
      this.dismiss({ reason: 'ready' })
    }
  }

  private finish(reason: string): void {
    if (this.currentState === 'hidden' || this.currentState === 'destroyed') return

    this.clearTimers()
    this.preloadTask?.cancel()
    this.preloadTask = null
    this.waitTask?.cancel()
    this.waitTask = null
    this.runCleanups()

    if (this.el?.parentNode) this.el.parentNode.removeChild(this.el)
    this.el = null
    this.refs = null

    if (this.options.showOnce && this.hasShown && !this.seen) {
      markIntroSeen(this.options.showOnce, this.options.storageKey)
      this.seen = true
    }

    this.dismissed = true
    this.currentState = 'hidden'
    this.events.emit('hidden', { reason })
    this.resolveDone()
  }

  private later(fn: () => void, delay: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(() => {
      this.timers.delete(id)
      fn()
    }, Math.max(0, delay))
    this.timers.add(id)
    return id
  }

  private clearTimers(): void {
    this.timers.forEach((id) => clearTimeout(id))
    this.timers.clear()
  }

  private runCleanups(): void {
    const cleanups = this.cleanups.splice(0).reverse()
    cleanups.forEach((cleanup) => {
      try {
        cleanup()
      } catch {
        /* ignore */
      }
    })
  }
}
