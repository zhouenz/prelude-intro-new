import type { WaitFor } from './options'

export interface CancellableWait {
  promise: Promise<void>
  cancel: () => void
}

const noop = () => {}

export function waitFor(condition: WaitFor, doc: Document = document): CancellableWait {
  const win = doc.defaultView

  if (condition === 'none') {
    return { promise: Promise.resolve(), cancel: noop }
  }

  if (condition && typeof (condition as Promise<unknown>).then === 'function') {
    const promise = Promise.resolve(condition as Promise<unknown>)
      .then(() => undefined)
      .catch(() => undefined)
    return { promise, cancel: noop }
  }

  if (typeof condition === 'function') {
    try {
      const result = condition()
      const promise = Promise.resolve(result)
        .then(() => undefined)
        .catch(() => undefined)
      return { promise, cancel: noop }
    } catch {
      return { promise: Promise.resolve(), cancel: noop }
    }
  }

  if (condition === 'load' || condition === undefined) {
    if (!win || doc.readyState === 'complete') {
      return { promise: Promise.resolve(), cancel: noop }
    }
    let onLoad: (() => void) | null = null
    const promise = new Promise<void>((resolve) => {
      onLoad = () => resolve()
      win.addEventListener('load', onLoad, { once: true })
    })
    return {
      promise,
      cancel: () => {
        if (onLoad) win.removeEventListener('load', onLoad)
      },
    }
  }

  if (condition === 'dom') {
    if (!win || doc.readyState !== 'loading') {
      return { promise: Promise.resolve(), cancel: noop }
    }
    let onReady: (() => void) | null = null
    const promise = new Promise<void>((resolve) => {
      onReady = () => resolve()
      doc.addEventListener('DOMContentLoaded', onReady, { once: true })
    })
    return {
      promise,
      cancel: () => {
        if (onReady) doc.removeEventListener('DOMContentLoaded', onReady)
      },
    }
  }

  const selector = String(condition)
  if (doc.querySelector(selector)) {
    return { promise: Promise.resolve(), cancel: noop }
  }

  let observer: MutationObserver | null = null
  const promise = new Promise<void>((resolve) => {
    if (typeof MutationObserver === 'undefined') {
      resolve()
      return
    }
    observer = new MutationObserver(() => {
      if (doc.querySelector(selector)) {
        observer?.disconnect()
        resolve()
      }
    })
    observer.observe(doc.documentElement, { childList: true, subtree: true })
  })

  return {
    promise,
    cancel: () => observer?.disconnect(),
  }
}
