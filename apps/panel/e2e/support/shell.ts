import type { Page } from "@playwright/test"

/**
 * The page's bottom and sides, measured on a rendered page (the owner,
 * 2026-11-03: a black band at the bottom of the settings pages). Scrolled
 * to its end, three things are reported:
 *
 * - an empty band: a page that scrolls ends with its own content, not with
 *   a stretch of bare background something beside it (a long menu) made
 *   room for. Only what shows counts: a row cut off by a list that scrolls
 *   inside itself is not content, so an invisible input escaping that list
 *   and stretching the page is caught (2026-11-03, /settings/marketing
 *   scrolled 1000 px past its end);
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
    const styles = new Map<Element, CSSStyleDeclaration>()
    const styleOf = (element: Element) => {
      let style = styles.get(element)
      if (!style) {
        style = getComputedStyle(element)
        styles.set(element, style)
      }
      return style
    }
    // The part of a box on screen: cut by every box that clips it. An absolutely
    // placed box is clipped only from its containing block (a positioned box) up.
    const shown = (element: Element) => {
      let { top, bottom, left: start, right: stop } = element.getBoundingClientRect()
      let absolute = styleOf(element).position === "absolute"
      for (let at = element.parentElement; at && at !== root; at = at.parentElement) {
        const style = styleOf(at)
        if (style.position === "fixed") {
          break
        }
        if (absolute && style.position === "static" && style.transform === "none") {
          continue
        }
        if (style.overflowX !== "visible" || style.overflowY !== "visible") {
          const clip = at.getBoundingClientRect()
          top = Math.max(top, clip.top + at.clientTop)
          bottom = Math.min(bottom, clip.top + at.clientTop + at.clientHeight)
          start = Math.max(start, clip.left + at.clientLeft)
          stop = Math.min(stop, clip.left + at.clientLeft + at.clientWidth)
        }
        absolute = style.position === "absolute"
      }
      return { top, bottom, left: start, right: stop }
    }
    let end = box.top
    for (const element of Array.from(column.querySelectorAll("*"))) {
      const style = styleOf(element)
      if (style.position === "fixed" || style.visibility === "hidden" || style.opacity === "0") {
        continue
      }
      if (!drawn(element, style)) {
        continue
      }
      const rect = shown(element)
      if (
        rect.bottom - rect.top > 0 &&
        rect.right - rect.left > 0 &&
        rect.right > from &&
        rect.left < right
      ) {
        end = Math.max(end, rect.bottom)
      }
    }
    // Under the content, the column's own padding: what the shell leaves at the bottom
    const content = document.querySelector("#content")
    const padding = content ? parseFloat(getComputedStyle(content).paddingBottom) : 0
    // How far the page scrolls past what it shows (scrolled to its end, the content ends `end` down)
    const scroller = document.scrollingElement ?? root
    const past = scroller.scrollHeight - (window.scrollY + end) - padding
    if (scroller.scrollHeight > height + 1 && past > 16) {
      issues.push(
        `scrolls ${String(Math.round(past))}px past its visible content (page ${String(scroller.scrollHeight)}px, content ends at ${String(Math.round(window.scrollY + end))}px)`
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
