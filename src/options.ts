export const INTRO_VARIANTS = ['fade', 'curtain', 'slide', 'zoom', 'mask', 'blur'] as const
export const LOADER_TYPES = ['none', 'spinner', 'dots', 'bar', 'pulse'] as const
export const MEDIA_TYPES = ['auto', 'image', 'gif', 'video'] as const
export const TRANSITION_VARIANTS = ['fade', 'slide', 'curtain', 'wipe'] as const

export type IntroVariant = (typeof INTRO_VARIANTS)[number]
export type LoaderType = (typeof LOADER_TYPES)[number]
export type MediaType = (typeof MEDIA_TYPES)[number]
export type TransitionVariant = (typeof TRANSITION_VARIANTS)[number]
export type ShowOnce = false | 'session' | 'local'

export interface MediaOptions {
  src: string
  type?: MediaType
  alt?: string
  width?: number | string
  height?: number | string
  fit?: 'contain' | 'cover'
  loop?: boolean
  muted?: boolean
  autoplay?: boolean
}

export type MediaInput = MediaOptions | string | HTMLElement

export type WaitFor =
  | 'load'
  | 'dom'
  | 'none'
  | string
  | Promise<unknown>
  | (() => unknown | Promise<unknown>)

export interface IntroOptions {
  variant: IntroVariant
  loader: LoaderType
  media: MediaInput | null
  title: string
  subtitle: string
  showProgressText: boolean
  progressFormat: (value: number) => string
  preload: string[]
  waitFor: WaitFor
  minDuration: number
  maxDuration: number
  enter: number
  hold: number
  exit: number
  easing: string
  showOnce: ShowOnce
  storageKey: string
  dismissible: boolean
  skipLabel: string
  closeOnClick: boolean
  lockScroll: boolean
  respectReducedMotion: boolean
  zIndex: number
  container: HTMLElement | string | null
  autoStart: boolean
}

const EASING_MAP: Record<string, string> = {
  linear: 'linear',
  ease: 'ease',
  'ease-in': 'ease-in',
  'ease-out': 'ease-out',
  'ease-in-out': 'ease-in-out',
  smooth: 'cubic-bezier(.22,.61,.36,1)',
  spring: 'cubic-bezier(.34,1.56,.64,1)',
  snappy: 'cubic-bezier(.16,1,.3,1)',
}

export const DEFAULT_INTRO_OPTIONS: IntroOptions = {
  variant: 'fade',
  loader: 'spinner',
  media: null,
  title: '',
  subtitle: '',
  showProgressText: false,
  progressFormat: (value) => `${Math.round(value * 100)}%`,
  preload: [],
  waitFor: 'load',
  minDuration: 400,
  maxDuration: 8000,
  enter: 500,
  hold: 0,
  exit: 650,
  easing: 'cubic-bezier(.22,.61,.36,1)',
  showOnce: false,
  storageKey: 'prelude-intro',
  dismissible: true,
  skipLabel: '跳过',
  closeOnClick: false,
  lockScroll: true,
  respectReducedMotion: true,
  zIndex: 9999,
  container: null,
  autoStart: true,
}

export function normalizeEasing(easing: string | undefined): string {
  if (!easing) return DEFAULT_INTRO_OPTIONS.easing
  return EASING_MAP[easing] ?? easing
}

export function normalizeMedia(media: unknown): MediaInput | null {
  if (!media) return null
  if (typeof media === 'string') {
    const src = media.trim()
    return src ? { src } : null
  }
  if (typeof HTMLElement !== 'undefined' && media instanceof HTMLElement) return media
  if (typeof media === 'object') {
    const input = media as MediaOptions
    if (!input.src) return null
    const type = input.type && (MEDIA_TYPES as readonly string[]).includes(input.type) ? input.type : 'auto'
    return {
      ...input,
      src: input.src,
      type,
    }
  }
  return null
}

export function normalizePreload(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function num(value: unknown, fallback: number, min = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, parsed)
}

export function resolveIntroOptions(input: Partial<IntroOptions> = {}): IntroOptions {
  const variant =
    input.variant && (INTRO_VARIANTS as readonly string[]).includes(input.variant)
      ? input.variant
      : DEFAULT_INTRO_OPTIONS.variant
  const loader =
    input.loader && (LOADER_TYPES as readonly string[]).includes(input.loader)
      ? input.loader
      : DEFAULT_INTRO_OPTIONS.loader
  const showOnce =
    input.showOnce === 'session' || input.showOnce === 'local' ? input.showOnce : false

  return {
    ...DEFAULT_INTRO_OPTIONS,
    ...input,
    variant,
    loader,
    media: normalizeMedia(input.media),
    title: typeof input.title === 'string' ? input.title : '',
    subtitle: typeof input.subtitle === 'string' ? input.subtitle : '',
    showProgressText: Boolean(input.showProgressText),
    progressFormat:
      typeof input.progressFormat === 'function'
        ? input.progressFormat
        : DEFAULT_INTRO_OPTIONS.progressFormat,
    preload: normalizePreload(input.preload),
    minDuration: num(input.minDuration, DEFAULT_INTRO_OPTIONS.minDuration),
    maxDuration: num(input.maxDuration, DEFAULT_INTRO_OPTIONS.maxDuration),
    enter: num(input.enter, DEFAULT_INTRO_OPTIONS.enter),
    hold: num(input.hold, DEFAULT_INTRO_OPTIONS.hold),
    exit: num(input.exit, DEFAULT_INTRO_OPTIONS.exit),
    easing: normalizeEasing(input.easing),
    showOnce,
    storageKey:
      typeof input.storageKey === 'string' && input.storageKey
        ? input.storageKey
        : DEFAULT_INTRO_OPTIONS.storageKey,
    dismissible: input.dismissible !== false,
    skipLabel:
      typeof input.skipLabel === 'string' && input.skipLabel
        ? input.skipLabel
        : DEFAULT_INTRO_OPTIONS.skipLabel,
    closeOnClick: Boolean(input.closeOnClick),
    lockScroll: input.lockScroll !== false,
    respectReducedMotion: input.respectReducedMotion !== false,
    zIndex: num(input.zIndex, DEFAULT_INTRO_OPTIONS.zIndex),
    container: input.container ?? null,
    autoStart: input.autoStart !== false,
  }
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined || raw === '') return fallback
  if (raw === 'false' || raw === '0' || raw === 'no') return false
  if (raw === 'true' || raw === '1' || raw === 'yes') return true
  return fallback
}

function parseMediaData(raw: string | undefined): MediaInput | null {
  if (!raw) return null
  if (raw.trim().startsWith('{')) return parseJson<MediaOptions | null>(raw, null)
  return raw
}

function parseWaitForData(raw: string | undefined): WaitFor | undefined {
  if (!raw) return undefined
  if (raw.trim().startsWith('{') || raw.trim().startsWith('"')) {
    return parseJson<WaitFor>(raw, raw)
  }
  return raw
}

export function parseIntroData(el: HTMLElement): Partial<IntroOptions> {
  const d = el.dataset
  const data: Partial<IntroOptions> = {
    variant: d.variant as IntroVariant | undefined,
    loader: d.loader as LoaderType | undefined,
    media: d.media ? parseMediaData(d.media) : undefined,
    title: d.title,
    subtitle: d.subtitle,
    showProgressText: d.showProgressText !== undefined ? parseBoolean(d.showProgressText, false) : undefined,
    preload: d.preload
      ? (d.preload.trim().startsWith('[') ? parseJson<string[]>(d.preload, []) : normalizePreload(d.preload))
      : undefined,
    waitFor: parseWaitForData(d.waitFor),
    minDuration: d.minDuration ? Number(d.minDuration) : undefined,
    maxDuration: d.maxDuration ? Number(d.maxDuration) : undefined,
    enter: d.enter ? Number(d.enter) : undefined,
    hold: d.hold ? Number(d.hold) : undefined,
    exit: d.exit ? Number(d.exit) : undefined,
    easing: d.easing,
    showOnce:
      d.showOnce === 'session' || d.showOnce === 'local'
        ? d.showOnce
        : d.showOnce === 'false'
          ? false
          : undefined,
    storageKey: d.storageKey,
    dismissible: d.dismissible !== undefined ? parseBoolean(d.dismissible, true) : undefined,
    skipLabel: d.skipLabel,
    closeOnClick: d.closeOnClick !== undefined ? parseBoolean(d.closeOnClick, false) : undefined,
    lockScroll: d.lockScroll !== undefined ? parseBoolean(d.lockScroll, true) : undefined,
    respectReducedMotion:
      d.respectReducedMotion !== undefined ? parseBoolean(d.respectReducedMotion, true) : undefined,
    zIndex: d.zIndex ? Number(d.zIndex) : undefined,
    container: d.container ?? undefined,
    autoStart: d.autoStart !== undefined ? parseBoolean(d.autoStart, true) : undefined,
  }

  for (const key of Object.keys(data) as Array<keyof IntroOptions>) {
    if (data[key] === undefined) delete data[key]
  }
  return data
}

export function parseIntroElement(el: HTMLElement): IntroOptions {
  const raw = el.getAttribute('data-prelude')?.trim()
  let base: Partial<IntroOptions> = {}

  if (raw && raw.startsWith('{')) {
    base = parseJson<Partial<IntroOptions>>(raw, {})
  } else if (el.tagName === 'SCRIPT' && el.textContent?.trim()) {
    base = parseJson<Partial<IntroOptions>>(el.textContent.trim(), {})
  }

  return resolveIntroOptions({ ...base, ...parseIntroData(el) })
}

export function resolveContainer(
  container: HTMLElement | string | null,
  doc: Document = document,
): HTMLElement {
  if (container instanceof HTMLElement) return container
  if (typeof container === 'string') {
    const found = doc.querySelector<HTMLElement>(container)
    if (found) return found
  }
  return doc.body
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function toCssSize(value: number | string | undefined): string | null {
  if (value === undefined || value === null || value === '') return null
  return typeof value === 'number' ? `${value}px` : value
}
