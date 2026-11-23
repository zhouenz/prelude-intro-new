# Prelude

零依赖、TypeScript 编写的网页开场动画库。包含三块能力：

- **Intro**：全屏页面开场 / 加载动画，支持 GIF、图片、视频与任意自定义 DOM
- **Reveal**：元素进入视口时播放的滚动入场动画
- **Transition**：SPA 路由切换的离场 / 入场过渡

打包产物：`ESM` / `UMD` / `IIFE` + 独立 CSS + 类型声明。运行时无任何依赖。

## 特性

- 6 种开场退场变体、4 种加载指示器
- 自动等待 `window.load`、资源预加载与最短展示时间
- 资源预加载进度、百分比文本、`maxDuration` 兜底
- 媒体自动识别：GIF / WebP / APNG / SVG / PNG / JPG / MP4 / WebM
- 滚动入场支持分组错峰、一次性或重复触发
- 路由过渡优先使用 View Transitions API，自动回退到遮罩层
- 尊重 `prefers-reduced-motion`，加载遮罩带 `role="status"` 与跳过按钮
- 支持 `sessionStorage` / `localStorage` 只展示一次

## 安装

```bash
npm install prelude-intro
```

```ts
import { createIntro, reveal, createTransition } from 'prelude-intro'
import 'prelude-intro/prelude.css'
```

通过 `<script>` 直接引入：

```html
<link rel="stylesheet" href="https://unpkg.com/prelude-intro/dist/prelude.css" />
<script src="https://unpkg.com/prelude-intro/dist/prelude-intro.iife.js"></script>
<script>
  Prelude.createIntro({ variant: 'curtain', loader: 'bar' })
</script>
```

## 开场动画

```ts
import { createIntro } from 'prelude-intro'

const intro = createIntro({
  variant: 'curtain',               // fade | curtain | slide | zoom | mask | blur
  loader: 'bar',                    // none | spinner | dots | bar | pulse
  media: { src: '/loading.gif' },   // GIF / 图片 / 视频 / HTMLElement
  title: '正在加载',
  subtitle: '马上就好',
  showProgressText: true,
  preload: ['/hero.jpg', '/font.woff2'],
  waitFor: 'load',
  minDuration: 600,
  maxDuration: 8000,
  enter: 500,
  hold: 0,
  exit: 650,
  showOnce: 'session',
})

intro.on('progress', ({ percent }) => console.log(percent))
await intro.done
```

### 声明式用法

页面加载后扫描 `[data-prelude]` 并自动创建、启动：

```html
<div
  data-prelude
  data-variant="curtain"
  data-loader="bar"
  data-media='{"src":"/loading.gif","width":160}'
  data-preload="/loading.gif,/hero.jpg"
  data-min-duration="800"
  data-show-once="session"
></div>
```

也可以使用 JSON 配置块：

```html
<script type="application/json" data-prelude>
  {
    "variant": "zoom",
    "loader": "dots",
    "media": { "src": "/loading.gif", "width": 120 },
    "title": "Prelude",
    "minDuration": 800
  }
</script>
```

### 自定义媒体

```ts
const media = document.createElement('div')
media.innerHTML = '<img src="/brand-mark.svg" alt="" />'

createIntro({ media, loader: 'none', variant: 'fade' })

// 或视频
createIntro({
  media: { src: '/intro.mp4', type: 'video', autoplay: true, loop: true, muted: true },
})
```

### 进度

```ts
const intro = createIntro({ preload: ['/a.png', '/b.png'], loader: 'bar' })

intro.setProgress(0.35) // 手动模式：传 0 ~ 1
```

有 `preload` 或调用 `setProgress` 时显示确定进度；否则进度条为不确定动画。

### 配置项

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `variant` | `'fade' \| 'curtain' \| 'slide' \| 'zoom' \| 'mask' \| 'blur'` | `'fade'` | 退场动画 |
| `loader` | `'none' \| 'spinner' \| 'dots' \| 'bar' \| 'pulse'` | `'spinner'` | 加载指示器 |
| `media` | `MediaOptions \| string \| HTMLElement \| null` | `null` | 媒体图层 |
| `title` / `subtitle` | `string` | `''` | 文案 |
| `showProgressText` | `boolean` | `false` | 显示百分比文本 |
| `progressFormat` | `(value: number) => string` | `42%` | 百分比格式化 |
| `preload` | `string[]` | `[]` | 预加载资源 |
| `waitFor` | `'load' \| 'dom' \| 'none' \| selector \| Promise \| () => Promise` | `'load'` | 退场等待条件 |
| `minDuration` | `number` | `400` | 最短展示毫秒数，防闪烁 |
| `maxDuration` | `number` | `8000` | 强制退场兜底，`0` 表示不限 |
| `enter` / `hold` / `exit` | `number` | `500 / 0 / 650` | 进入 / 停留 / 退场毫秒数 |
| `easing` | `string` | `cubic-bezier(.22,.61,.36,1)` | 支持 `smooth`、`spring`、`snappy` 等别名 |
| `showOnce` | `false \| 'session' \| 'local'` | `false` | 只展示一次 |
| `storageKey` | `string` | `'prelude-intro'` | 存储键 |
| `dismissible` | `boolean` | `true` | 显示跳过按钮并支持 Esc |
| `skipLabel` | `string` | `'跳过'` | 跳过按钮文案 |
| `closeOnClick` | `boolean` | `false` | 点击遮罩即关闭 |
| `lockScroll` | `boolean` | `true` | 展示期间锁定滚动 |
| `respectReducedMotion` | `boolean` | `true` | 尊重系统减弱动效 |
| `zIndex` | `number` | `9999` | 层级 |
| `container` | `HTMLElement \| string \| null` | `null` | 挂载容器，默认 `body` |
| `autoStart` | `boolean` | `true` | `createIntro` 后立即开始 |

### 方法

| 成员 | 说明 |
| --- | --- |
| `start()` | 开始播放（幂等） |
| `dismiss({ immediate?, reason? })` | 主动关闭 |
| `setProgress(value)` | 设置进度，取值 `0 ~ 1` |
| `destroy()` | 立即移除并清理 |
| `done` | 关闭后 resolve 的 Promise |
| `on(type, fn)` / `off(type, fn)` | 事件订阅 / 取消 |
| `state` | `idle \| waiting \| leaving \| hidden \| destroyed` |
| `element` | 当前遮罩元素 |

事件：`show`、`progress`、`ready`、`dismiss`、`hidden`、`error`、`destroy`。

`showOnce` 已展示过时可调用 `clearIntroSeen('session', 'prelude-intro')` 重置。

`createIntro` 默认 `autoStart: true`。如果需要在开始前绑定事件，传 `autoStart: false` 再手动 `start()`：

```ts
const intro = createIntro({ autoStart: false, waitFor: 'none' })
intro.on('ready', () => console.log('资源就绪'))
intro.start()
```

不需要自动扫描 `[data-prelude]` 时，在加载脚本前设置：

```html
<script>window.__PRELUDE_NO_AUTO__ = true</script>
```

## 滚动入场

自动扫描 `[data-reveal]`：

```html
<section data-reveal-group data-reveal-stagger="80">
  <h2 data-reveal>标题</h2>
  <p data-reveal="fade-up" data-reveal-delay="120">段落</p>
  <div data-reveal="zoom" data-reveal-duration="500">卡片</div>
</section>
```

可用动画：`fade`、`fade-up`、`fade-down`、`fade-left`、`fade-right`、`zoom`、`flip`、`blur`、`mask`。

```ts
import { reveal } from 'prelude-intro'

reveal.init({
  once: true,
  threshold: 0.15,
  rootMargin: '0px 0px -10% 0px',
  animation: 'fade-up',
  duration: 700,
  stagger: 80,
})

reveal.observe(document.querySelector('#late-node'), { animation: 'zoom', delay: 100 })
reveal.refresh() // 动态插入 DOM 后调用
reveal.destroy()
```

## 路由过渡

与路由库解耦，自动串起「离场 → 更新 → 入场」：

```ts
import { createTransition } from 'prelude-intro'

const transition = createTransition({
  variant: 'curtain',        // fade | slide | curtain | wipe
  duration: 500,
  useViewTransition: true,   // 支持时使用 View Transitions API
})

await transition.run(async () => {
  await router.push('/next')
  await nextTick()
})
```

手动分步控制：

```ts
await transition.leave()
renderNewPage()
await transition.enter()
transition.destroy()
```

`run` 在回调抛错时也会执行入场清理。

## 主题

覆盖 CSS 变量即可换肤：

```css
:root {
  --prelude-bg: #0a0c12;
  --prelude-fg: #f4f6ff;
  --prelude-accent: #7c8cff;
  --prelude-accent-2: #b789ff;
  --prelude-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
  --prelude-media-size: 132px;
  --prelude-radius: 16px;
}
```

单次覆盖可写在触发元素上：

```html
<div data-prelude style="--prelude-bg:#0f172a;--prelude-accent:#22d3ee"></div>
```

## 无障碍与性能

- 遮罩带 `role="status"`、`aria-live="polite"`、`aria-busy`，关闭后完整恢复
- 默认提供「跳过」按钮，支持 `Esc`
- `prefers-reduced-motion: reduce` 时退化为快速淡出，滚动入场直接显示
- 动画只使用 `transform` / `opacity` / `clip-path`，不触发布局
- 关闭后移除 DOM、解绑监听、恢复滚动与焦点相关属性
- 禁用 JS 时滚动入场内容保持可见；开场遮罩由 JS 创建，不会遮挡页面

避免首屏闪烁，可在 `<head>` 内提前加上：

```html
<script>
  document.documentElement.classList.add('prelude-reveal')
</script>
```

## 开发

```bash
npm install
npm run dev        # 打开演示页
npm run test       # Vitest + jsdom
npm run build      # 产出 dist/
npm run typecheck
```

演示页包含开场变体切换、滚动入场重播、模拟路由切换。把任意 GIF 放到 `demo/assets/loading.gif` 即可替换开场媒体。

## 浏览器支持

现代浏览器（Chrome / Edge / Firefox / Safari 最新两个版本）。View Transitions API 不存在时自动回退到遮罩过渡；`IntersectionObserver` 不存在时直接显示入场内容。

## License

MIT

## 打开项目
   opencode -s ses_e1be06ee6ffeLdww3ubnqQxeFJ