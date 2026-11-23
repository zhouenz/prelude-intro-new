export interface PreloadFailure {
  src: string
  error: unknown
}

export interface PreloadResult {
  loaded: number
  total: number
  failures: PreloadFailure[]
}

export interface PreloadTask {
  promise: Promise<PreloadResult>
  cancel: () => void
}

const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif|apng|svg|bmp|ico)([?#].*)?$/i
const VIDEO_RE = /\.(mp4|webm|ogv|mov|m4v)([?#].*)?$/i
const TIMEOUT = 15000

function probe(src: string, signal: AbortSignal): Promise<void> {
  if (typeof fetch !== 'function') return Promise.resolve()
  return fetch(src, { cache: 'force-cache', signal }).then(
    (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    },
  )
}

function loadImage(src: string, signal: AbortSignal, doc: Document): Promise<void> {
  const win = doc.defaultView
  if (!win || typeof win.Image !== 'function') return probe(src, signal)

  return new Promise<void>((resolve, reject) => {
    const img = new win.Image()
    const cleanup = () => {
      img.onload = null
      img.onerror = null
      signal.removeEventListener('abort', onAbort)
    }
    const onAbort = () => {
      cleanup()
      img.src = ''
      reject(new DOMException('Aborted', 'AbortError'))
    }
    img.onload = () => {
      cleanup()
      resolve()
    }
    img.onerror = () => {
      cleanup()
      reject(new Error(`图片加载失败: ${src}`))
    }
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
    img.src = src
  })
}

function loadVideo(src: string, signal: AbortSignal, doc: Document): Promise<void> {
  if (typeof doc.createElement !== 'function') return probe(src, signal)

  return new Promise<void>((resolve, reject) => {
    const video = doc.createElement('video')
    let settled = false

    const cleanup = () => {
      video.onloadedmetadata = null
      video.onerror = null
      signal.removeEventListener('abort', onAbort)
      video.removeAttribute('src')
    }

    const succeed = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }

    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    const onAbort = () => fail(new DOMException('Aborted', 'AbortError'))

    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.onloadedmetadata = succeed
    video.onerror = () => fail(new Error(`视频加载失败: ${src}`))

    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
    video.src = src
  })
}

export function preloadAssets(
  sources: string[],
  onProgress?: (loaded: number, total: number) => void,
  doc: Document = document,
): PreloadTask {
  const unique = Array.from(new Set(sources.filter((src) => typeof src === 'string' && src.trim() !== '')))
  const total = unique.length
  const failures: PreloadFailure[] = []
  const controller = new AbortController()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let loaded = 0
  let settled = false
  let resolveResult!: (result: PreloadResult) => void

  const promise = new Promise<PreloadResult>((resolve) => {
    resolveResult = resolve
  })

  const finish = () => {
    if (settled) return
    settled = true
    timers.forEach((timer) => clearTimeout(timer))
    timers.clear()
    resolveResult({ loaded, total, failures })
  }

  if (total === 0) {
    onProgress?.(0, 0)
    finish()
    return {
      promise,
      cancel: () => {
        controller.abort()
        finish()
      },
    }
  }

  const tick = (src: string, error?: unknown) => {
    if (settled) return
    loaded += 1
    if (error !== undefined) failures.push({ src, error })
    onProgress?.(loaded, total)
    if (loaded >= total) finish()
  }

  unique.forEach((src) => {
    const timer = setTimeout(() => {
      timers.delete(timer)
      tick(src, new Error(`资源加载超时: ${src}`))
    }, TIMEOUT)
    timers.add(timer)

    const task = VIDEO_RE.test(src)
      ? loadVideo(src, controller.signal, doc)
      : IMAGE_RE.test(src)
        ? loadImage(src, controller.signal, doc)
        : probe(src, controller.signal)

    task
      .then(() => {
        clearTimeout(timer)
        timers.delete(timer)
        tick(src)
      })
      .catch((error) => {
        clearTimeout(timer)
        timers.delete(timer)
        if (controller.signal.aborted) {
          finish()
          return
        }
        tick(src, error)
      })
  })

  return {
    promise,
    cancel: () => {
      controller.abort()
      finish()
    },
  }
}
