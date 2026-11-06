/** How long a page that paints no frames (a hidden tab) waits instead. */
export const PAINTLESS_WAIT_MS = 100

/**
 * Runs `work` once the browser has drawn what the current event changed:
 * the frame after it, then a task of its own. A form's own feedback (its
 * button saying it is sending, the cookie card closing) is drawn before
 * the work of starting its server action begins (INP, docs/21 "Sepete
 * ekle ve çerez onayı"). A page that draws no frames (a hidden tab) runs
 * it after a short wait; never twice.
 */
export function afterPaint(work: () => void): void {
  let done = false
  const run = () => {
    if (!done) {
      done = true
      work()
    }
  }
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => {
      setTimeout(run, 0)
    })
  }
  setTimeout(run, PAINTLESS_WAIT_MS)
}
