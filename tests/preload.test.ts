import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { preloadAssets } from '../src/preload'

describe('preloadAssets', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves immediately with no sources', async () => {
    const progress = vi.fn()
    const task = preloadAssets([], progress)

    await expect(task.promise).resolves.toEqual({ loaded: 0, total: 0, failures: [] })
    expect(progress).toHaveBeenCalledWith(0, 0)
  })

  it('deduplicates sources and can be cancelled', async () => {
    const task = preloadAssets(['/a.gif', '/a.gif', '', '/b.mp4'])
    task.cancel()

    const result = await task.promise
    expect(result.total).toBe(2)
    expect(result.failures).toEqual([])
  })

  it('counts timeouts as failures', async () => {
    const progress = vi.fn()
    const task = preloadAssets(['/slow.png'], progress)

    await vi.advanceTimersByTimeAsync(15001)
    const result = await task.promise

    expect(result.loaded).toBe(1)
    expect(result.total).toBe(1)
    expect(result.failures).toHaveLength(1)
    expect(progress).toHaveBeenCalled()
  })
})
