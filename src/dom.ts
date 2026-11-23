import type { IntroOptions, LoaderType, MediaInput, MediaOptions } from './options'
import { toCssSize } from './options'

export interface IntroDomRefs {
  root: HTMLElement
  content: HTMLElement
  mediaHost: HTMLElement | null
  media: HTMLElement | null
  progressText: HTMLElement | null
  skip: HTMLButtonElement | null
}

function create<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = doc.createElement(tag)
  if (className) element.className = className
  return element
}

function isVideoSource(src: string): boolean {
  return /\.(mp4|webm|ogv|mov|m4v)([?#].*)?$/i.test(src)
}

function normalizeMediaOptions(media: MediaInput): MediaOptions | null {
  if (typeof media === 'string') return { src: media }
  if (!media || typeof media !== 'object') return null
  if (typeof HTMLElement !== 'undefined' && media instanceof HTMLElement) return null
  const options = media as MediaOptions
  return options.src ? options : null
}

export function renderMedia(
  media: MediaInput | null,
  doc: Document = document,
  onError?: (error: unknown) => void,
): HTMLElement | null {
  if (!media) return null

  if (typeof HTMLElement !== 'undefined' && media instanceof HTMLElement) {
    media.classList.add('prelude__media-item')
    return media
  }

  const options = normalizeMediaOptions(media)
  if (!options) return null

  const type = options.type && options.type !== 'auto'
    ? options.type
    : isVideoSource(options.src)
      ? 'video'
      : 'image'

  let element: HTMLImageElement | HTMLVideoElement
  if (type === 'video') {
    const video = create(doc, 'video', 'prelude__media-item')
    video.autoplay = options.autoplay !== false
    video.muted = options.muted !== false
    video.loop = options.loop !== false
    video.playsInline = true
    video.preload = 'auto'
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    if (video.muted) video.setAttribute('muted', '')
    video.src = options.src
    video.addEventListener('error', () => onError?.(new Error(`媒体加载失败: ${options.src}`)))
    video.play?.().catch(() => {})
    element = video
  } else {
    const img = create(doc, 'img', 'prelude__media-item')
    img.src = options.src
    img.alt = options.alt ?? ''
    img.decoding = 'async'
    img.loading = 'eager'
    img.draggable = false
    img.addEventListener('error', () => onError?.(new Error(`媒体加载失败: ${options.src}`)))
    element = img
  }

  const width = toCssSize(options.width)
  const height = toCssSize(options.height)
  if (width) element.style.width = width
  if (height) element.style.height = height
  if (options.fit) element.style.objectFit = options.fit

  return element
}

function buildLoader(type: LoaderType, doc: Document): HTMLElement | null {
  switch (type) {
    case 'spinner':
      return create(doc, 'span', 'prelude__spinner')
    case 'dots': {
      const wrap = create(doc, 'span', 'prelude__dots')
      for (let i = 0; i < 3; i += 1) wrap.appendChild(create(doc, 'span'))
      return wrap
    }
    case 'bar': {
      const wrap = create(doc, 'div', 'prelude__bar')
      wrap.appendChild(create(doc, 'span', 'prelude__bar-fill'))
      return wrap
    }
    case 'pulse': {
      const wrap = create(doc, 'span', 'prelude__pulse')
      for (let i = 0; i < 3; i += 1) wrap.appendChild(create(doc, 'span'))
      return wrap
    }
    case 'none':
    default:
      return null
  }
}

export function buildIntroDOM(
  options: IntroOptions,
  reducedMotion: boolean,
  doc: Document = document,
): IntroDomRefs {
  const root = create(
    doc,
    'div',
    `prelude prelude--${options.variant} prelude--loader-${options.loader}${
      reducedMotion ? ' prelude--reduced' : ''
    }`,
  )
  root.setAttribute('role', 'status')
  root.setAttribute('aria-live', 'polite')
  root.setAttribute('aria-atomic', 'true')
  root.setAttribute('aria-label', options.title || '页面加载中')
  root.setAttribute('aria-busy', 'true')
  root.dataset.state = 'enter'

  root.style.setProperty('--prelude-enter', `${options.enter}ms`)
  root.style.setProperty('--prelude-hold', `${options.hold}ms`)
  root.style.setProperty('--prelude-exit', `${options.exit}ms`)
  root.style.setProperty('--prelude-ease', options.easing)
  root.style.setProperty('--prelude-z', String(options.zIndex))
  root.style.setProperty('--prelude-progress', '0%')

  const content = create(doc, 'div', 'prelude__content')

  let mediaHost: HTMLElement | null = null
  let media: HTMLElement | null = null
  if (options.media) {
    mediaHost = create(doc, 'div', 'prelude__media')
    media = renderMedia(options.media, doc)
    if (media) mediaHost.appendChild(media)
    if (!media) mediaHost = null
  }
  if (mediaHost) content.appendChild(mediaHost)

  const loader = buildLoader(options.loader, doc)
  if (loader) content.appendChild(loader)

  if (options.title) {
    const title = create(doc, 'div', 'prelude__title')
    title.textContent = options.title
    content.appendChild(title)
  }

  if (options.subtitle) {
    const subtitle = create(doc, 'div', 'prelude__subtitle')
    subtitle.textContent = options.subtitle
    content.appendChild(subtitle)
  }

  let progressText: HTMLElement | null = null
  if (options.showProgressText) {
    progressText = create(doc, 'div', 'prelude__progress-text')
    progressText.setAttribute('aria-hidden', 'true')
    progressText.textContent = options.progressFormat(0)
    progressText.hidden = true
    content.appendChild(progressText)
  }

  root.appendChild(content)

  let skip: HTMLButtonElement | null = null
  if (options.dismissible) {
    skip = create(doc, 'button', 'prelude__skip')
    skip.type = 'button'
    skip.textContent = options.skipLabel
    root.appendChild(skip)
  }

  return { root, content, mediaHost, media, progressText, skip }
}

export function lockScroll(doc: Document = document): () => void {
  const body = doc.body
  const html = doc.documentElement
  if (!body || !html) return () => {}

  const win = doc.defaultView
  const prevBodyOverflow = body.style.overflow
  const prevBodyPadding = body.style.paddingRight
  const prevHtmlOverflow = html.style.overflow

  body.style.overflow = 'hidden'
  html.style.overflow = 'hidden'

  if (win) {
    const scrollbarWidth = Math.max(0, win.innerWidth - html.clientWidth)
    if (scrollbarWidth > 0) {
      const current = Number.parseFloat(win.getComputedStyle(body).paddingRight || '0')
      body.style.paddingRight = `${(Number.isFinite(current) ? current : 0) + scrollbarWidth}px`
    }
  }

  return () => {
    body.style.overflow = prevBodyOverflow
    body.style.paddingRight = prevBodyPadding
    html.style.overflow = prevHtmlOverflow
  }
}

export function setBodyBusy(doc: Document, busy: boolean): () => void {
  const body = doc.body
  if (!body) return () => {}
  const previous = body.getAttribute('aria-busy')
  body.setAttribute('aria-busy', String(busy))
  return () => {
    if (previous === null) body.removeAttribute('aria-busy')
    else body.setAttribute('aria-busy', previous)
  }
}
