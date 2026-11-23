import {
  createIntro,
  createTransition,
  reveal,
  type IntroVariant,
  type LoaderType,
  type MediaInput,
  type TransitionVariant,
} from '../src/index'

function el<T extends HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (!found) throw new Error(`缺少元素: ${selector}`)
  return found
}

const introVariant = el<HTMLSelectElement>('#intro-variant')
const introLoader = el<HTMLSelectElement>('#intro-loader')
const introMedia = el<HTMLSelectElement>('#intro-media')
const introProgress = el<HTMLInputElement>('#intro-progress')
const introPlay = el<HTMLButtonElement>('#intro-play')
const introReplay = el<HTMLButtonElement>('#play-intro')
const introStatus = el<HTMLSpanElement>('#intro-status')
const introCode = el<HTMLElement>('#intro-code')

let activeIntro: ReturnType<typeof createIntro> | null = null

function customOrb(): HTMLElement {
  const orb = document.createElement('div')
  orb.className = 'intro-orb'
  orb.innerHTML = '<span></span><span></span><span></span>'
  return orb
}

function mediaFor(value: string): { label: string; media: MediaInput | null } {
  if (value === 'custom') return { label: 'customOrb()', media: customOrb() }
  if (value === 'none') return { label: 'null', media: null }
  return {
    label: "{ src: '/demo/assets/loading.svg', width: 120 }",
    media: { src: '/demo/assets/loading.svg', width: 120, height: 120 },
  }
}

function introSnippet(): string {
  return `createIntro({
  variant: '${introVariant.value}',
  loader: '${introLoader.value}',
  media: ${mediaFor(introMedia.value).label},
  preload: ['/demo/assets/loading.svg'],
  minDuration: 1200,
  showProgressText: ${introProgress.checked},
})`
}

function renderIntroCode(): void {
  introCode.textContent = introSnippet()
}

function playIntro(): void {
  document.querySelectorAll<HTMLButtonElement>('.prelude .prelude__skip').forEach((btn) => btn.click())
  activeIntro?.destroy()
  introStatus.textContent = '开场中…'

  const intro = createIntro({
    variant: introVariant.value as IntroVariant,
    loader: introLoader.value as LoaderType,
    media: mediaFor(introMedia.value).media,
    title: 'Prelude',
    subtitle: '正在准备页面…',
    showProgressText: introProgress.checked,
    preload: ['/demo/assets/loading.svg'],
    minDuration: 1200,
    maxDuration: 5000,
    autoStart: false,
    showOnce: false,
  })

  activeIntro = intro

  intro.on('progress', ({ percent }) => {
    introStatus.textContent = `加载中 ${Math.round(percent)}%`
  })
  intro.on('ready', () => {
    introStatus.textContent = '资源就绪，正在退场'
  })
  intro.on('error', ({ source }) => {
    introStatus.textContent = `资源加载异常（${source}），已继续`
  })
  intro.on('hidden', () => {
    introStatus.textContent = '已完成'
    if (activeIntro === intro) activeIntro = null
  })

  intro.start()
}

introPlay.addEventListener('click', playIntro)
introReplay.addEventListener('click', playIntro)
introVariant.addEventListener('change', renderIntroCode)
introLoader.addEventListener('change', renderIntroCode)
introMedia.addEventListener('change', renderIntroCode)
introProgress.addEventListener('change', renderIntroCode)
renderIntroCode()

el<HTMLButtonElement>('#reveal-replay').addEventListener('click', () => {
  const section = el<HTMLElement>('#reveal')
  section.querySelectorAll<HTMLElement>('[data-reveal]').forEach((node) => {
    node.classList.remove('reveal--visible')
    node.removeAttribute('data-reveal-visible')
  })
  reveal.destroy()
  reveal.init({ once: true })
  section.scrollIntoView({ block: 'start', behavior: 'smooth' })
})

type PageId = 'home' | 'work' | 'about'

interface PageData {
  eyebrow: string
  title: string
  body: string
}

const pages: Record<PageId, PageData> = {
  home: {
    eyebrow: 'Home',
    title: '把每一次跳转做成一次开场',
    body: '切换标签会执行 transition.run(() => 更新页面)，离场、更新、入场自动串起来。',
  },
  work: {
    eyebrow: 'Work',
    title: '离场与入场之间，是一个 Promise',
    body: '异步请求、渲染、滚动复位都可以放进 run 的回调，过渡会等它完成再收尾。',
  },
  about: {
    eyebrow: 'About',
    title: '与路由库保持距离',
    body: '这里没有绑定任何框架。你可以在 Vue Router、React Router 或原生 History API 里调用同一套 API。',
  },
}

const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab'))
const pageContent = el<HTMLElement>('#page-content')
const transitionVariant = el<HTMLSelectElement>('#transition-variant')
const transitionVT = el<HTMLInputElement>('#transition-vt')
let currentPage: PageId = 'home'

function renderPage(id: PageId): void {
  const page = pages[id]
  pageContent.innerHTML = `
    <p class="page-content__eyebrow">${page.eyebrow}</p>
    <h3>${page.title}</h3>
    <p>${page.body}</p>
    <div class="page-content__grid"><span></span><span></span><span></span><span></span></div>
  `
  tabs.forEach((tab) => {
    const active = tab.dataset.page === id
    tab.classList.toggle('is-active', active)
    tab.setAttribute('aria-selected', String(active))
  })
}

async function navigate(id: PageId): Promise<void> {
  if (id === currentPage) return

  const transition = createTransition({
    variant: transitionVariant.value as TransitionVariant,
    duration: 480,
    useViewTransition: transitionVT.checked,
    respectReducedMotion: true,
  })

  try {
    await transition.run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 160))
      renderPage(id)
      currentPage = id
    })
  } finally {
    transition.destroy()
  }
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const id = tab.dataset.page as PageId
    if (id) void navigate(id)
  })
})
