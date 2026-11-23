import './styles.css'
import { Prelude } from './prelude'
import {
  parseIntroElement,
  resolveIntroOptions,
  type IntroOptions,
} from './options'
import { createReveal, reveal } from './reveal'
import { createTransition } from './transition'
import { clearIntroSeen } from './storage'

export { Prelude, reveal, createReveal, createTransition, clearIntroSeen }
export {
  INTRO_VARIANTS,
  LOADER_TYPES,
  MEDIA_TYPES,
  TRANSITION_VARIANTS,
  parseIntroData,
  parseIntroElement,
  resolveIntroOptions,
} from './options'
export { REVEAL_ANIMATIONS } from './reveal'

export type {
  IntroOptions,
  IntroVariant,
  LoaderType,
  MediaInput,
  MediaOptions,
  MediaType,
  ShowOnce,
  TransitionVariant,
  WaitFor,
} from './options'
export type { DismissOptions, IntroEventMap, PreludeState } from './prelude'
export type {
  RevealAnimation,
  RevealInstance,
  RevealObserveOptions,
  RevealOptions,
} from './reveal'
export type {
  TransitionInstance,
  TransitionOptions,
  TransitionState,
} from './transition'

export function createIntro(input: Partial<IntroOptions> | HTMLElement = {}): Prelude {
  const isElement = typeof HTMLElement !== 'undefined' && input instanceof HTMLElement
  const options = isElement
    ? parseIntroElement(input)
    : resolveIntroOptions(input as Partial<IntroOptions>)
  if (isElement) input.classList.add('prelude-config')
  const intro = new Prelude(options)
  if (intro.options.autoStart) intro.start()
  return intro
}

const initializedConfigs = new WeakSet<Element>()

export function autoInit(root: ParentNode = document): void {
  if (typeof document === 'undefined') return

  const configs: HTMLElement[] = []
  if (root instanceof HTMLElement && root.matches('[data-prelude]')) configs.push(root)
  root.querySelectorAll<HTMLElement>('[data-prelude]').forEach((el) => configs.push(el))

  configs.forEach((el) => {
    if (initializedConfigs.has(el)) return
    initializedConfigs.add(el)
    el.classList.add('prelude-config')
    createIntro(el)
  })

  reveal.init()
}

if (
  typeof document !== 'undefined' &&
  !(globalThis as { __PRELUDE_NO_AUTO__?: boolean }).__PRELUDE_NO_AUTO__
) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => autoInit(), { once: true })
  } else {
    autoInit()
  }
}
