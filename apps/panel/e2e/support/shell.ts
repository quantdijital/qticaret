import type { Page } from "@playwright/test"

/**
 * The page's bottom and sides, measured on a rendered page (the owner,
 * 2026-11-03: a black band at the bottom of the settings pages). Scrolled
 * to its end, three things are reported:
 *
 * - an empty band: a page that scrolls ends with its own content, not with
 *   a stretch of bare background something beside it (a long menu) made
 *   room for;
 * - colour: between the content's end and the bottom of the screen the
 *   page's own background shows, not a darker or lighter band (a wrapper
 *   ending short, the canvas showing through, a surface of another colour);
 * - width: nothing is wider than the screen, so the page never scrolls
 *   sideways (a sideways scrollbar is a band at the bottom too).
 *
 * The content is measured in the page's column (the shell's `<main>`, or
 * a full-screen page's root) without its left quarter, where a menu beside
 * the page lies (settings'), never on the app's menu.
 */
export async function shellIssues(page: Page): Promise<string[]> {
  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight)
  })
  // A scroll-linked header settles in a frame
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      })
  )
  return page.evaluate(() => {
    const issues: string[] = []
    const root = document.documentElement
    const width = root.clientWidth
    const height = window.innerHeight
    if (root.scrollWidth > width) {
      issues.push(`scrolls sideways: ${String(root.scrollWidth - width)}px wider than the screen`)
    }
    const transparent = (color: string) =>
      color === "transparent" || /^rgba\(.*,\s*0\)$/.test(color) || /\/\s*0\)$/.test(color)
    // The canvas: the root's background, else the body's (CSS propagates it)
    const canvas = () => {
      const own = getComputedStyle(root).backgroundColor
      return transparent(own) ? getComputedStyle(document.body).backgroundColor : own
    }
    const paintAt = (x: number, y: number) => {
      for (const element of document.elementsFromPoint(x, y)) {
        const color = getComputedStyle(element).backgroundColor
        if (!transparent(color)) {
          return { color, element }
        }
      }
      return { color: canvas(), element: root }
    }
    const nameOf = (element: Element) => {
      const id = element.id ? `#${element.id}` : ""
      const slot = element.getAttribute("data-slot")
      return `${element.tagName.toLowerCase()}${id}${slot ? `[${slot}]` : ""}`
    }
    const column =
      document.querySelector("main") ?? document.querySelector("#root > *") ?? document.body
    const box = column.getBoundingClientRect()
    // The page's own surface: the column's background, or the nearest one behind it
    let surface = canvas()
    for (let at: Element | null = column; at && at !== root; at = at.parentElement) {
      const color = getComputedStyle(at).backgroundColor
      if (!transparent(color)) {
        surface = color
        break
      }
    }
    // The surface is the canvas' colour: a short page shows no seam under it
    if (surface !== canvas()) {
      issues.push(`page ${surface} on a canvas of ${canvas()} (${nameOf(column)})`)
    }
    // Something a person sees: text, a picture or a control, a filled or outlined box
    const MEDIA = "img, svg, video, canvas, iframe, input, textarea, select, button, hr"
    const drawn = (element: Element, style: CSSStyleDeclaration) =>
      element.matches(MEDIA) ||
      !transparent(style.backgroundColor) ||
      (parseFloat(style.borderBottomWidth) > 0 && !transparent(style.borderBottomColor)) ||
      Array.from(element.childNodes).some(
        (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== ""
      )
    // The column without its left quarter: where a page's own content runs (a menu
    // beside it, like settings', lies in that quarter and is not the page)
    const left = Math.max(box.left, 0)
    const right = Math.min(box.right, width)
    const from = left + (right - left) / 4
    let end = box.top
    for (const element of Array.from(column.querySelectorAll("*"))) {
      const style = getComputedStyle(element)
      if (style.position === "fixed" || style.visibility === "hidden" || style.opacity === "0") {
        continue
      }
      const rect = element.getBoundingClientRect()
      if (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > from &&
        rect.left < right &&
        drawn(element, style)
      ) {
        end = Math.max(end, rect.bottom)
      }
    }
    // Under the content, the column's own padding: what the shell leaves at the bottom
    const content = document.querySelector("#content")
    const padding = content ? parseFloat(getComputedStyle(content).paddingBottom) : 0
    const scrolls = root.scrollHeight > height + 1
    if (scrolls && height - end > padding + 24) {
      issues.push(
        `scrolls into an empty band: the content ends ${String(Math.round(height - end))}px above the bottom`
      )
    }
    const top = Math.ceil(end) + 1
    if (top < height - 1) {
      for (const y of new Set([top, Math.round((top + height) / 2), height - 2])) {
        for (const x of [from + 8, (from + right) / 2, right - 8].map(Math.round)) {
          const paint = paintAt(x, y)
          if (paint.color !== surface) {
            issues.push(
              `under the content at ${String(x)},${String(y)}: ${nameOf(paint.element)} ${paint.color}, the page is ${surface}`
            )
          }
        }
      }
    }
    return [...new Set(issues)]
  })
}
