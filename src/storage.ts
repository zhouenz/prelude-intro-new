import type { ShowOnce } from './options'

const memoryStore = new Set<string>()
let memoryWarningShown = false

function memoryKey(mode: ShowOnce, key: string): string {
  return `${mode}:${key}`
}

function getStorage(mode: Exclude<ShowOnce, false>): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return mode === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    if (!memoryWarningShown) {
      memoryWarningShown = true
      console.warn('[prelude-intro] 无法访问 Web Storage，已回退到内存存储。')
    }
    return null
  }
}

export function isIntroSeen(mode: ShowOnce, key: string): boolean {
  if (!mode) return false
  const storage = getStorage(mode)
  if (storage) {
    try {
      return storage.getItem(key) === 'shown'
    } catch {
      return memoryStore.has(memoryKey(mode, key))
    }
  }
  return memoryStore.has(memoryKey(mode, key))
}

export function markIntroSeen(mode: ShowOnce, key: string): void {
  if (!mode) return
  const storage = getStorage(mode)
  if (storage) {
    try {
      storage.setItem(key, 'shown')
      return
    } catch {
      /* fall through to memory */
    }
  }
  memoryStore.add(memoryKey(mode, key))
}

export function clearIntroSeen(mode: ShowOnce, key: string): void {
  if (!mode) return
  const storage = getStorage(mode)
  if (storage) {
    try {
      storage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
  memoryStore.delete(memoryKey(mode, key))
}

export function clearIntroMemory(): void {
  memoryStore.clear()
}
