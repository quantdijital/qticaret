import { sectionSelector } from "./bridge-core"

/**
 * Calls `found` with a section's element once it is in the page (now, or
 * when a redraw brings it), or `late` when `ms` pass first. Returns the
 * stop; nothing waits for an id that is not a section's.
 */
export function waitForSection(
  id: string,
  found: (element: Element) => void,
  late: () => void,
  ms: number
): (() => void) | null {
  const selector = sectionSelector(id)
  const now = selector ? document.querySelector(selector) : null
  if (now || !selector) {
    if (now) {
      found(now)
    }
    return null
  }
  const observer = new MutationObserver(() => {
    const element = document.querySelector(selector)
    if (element) {
      stop()
      found(element)
    }
  })
  const timer = setTimeout(() => {
    stop()
    late()
  }, ms)
  const stop = () => {
    observer.disconnect()
    clearTimeout(timer)
  }
  observer.observe(document.body, { childList: true, subtree: true })
  return stop
}
