import type { Page } from "@playwright/test"

/**
 * Stray scrollbars on a rendered page (the owner, 2026-11-24: a scrollbar
 * under the orders' stage tabs). Two kinds are reported:
 *
 * - the page itself wider than the window: it scrolls sideways;
 * - an element that scrolls (overflow auto or scroll) and whose content
 *   is bigger than its box on that axis, so it shows a scrollbar.
 *
 * A box that is meant to scroll says so on the axis it scrolls:
 * `data-scroll-area="x"` (a wide table), `"y"` (a long list in a box of
 * fixed height) or `"both"`. Its other axis is still measured: a table
 * that scrolls sideways must not also scroll a pixel up and down. Open
 * pop-ups (menus, dialogs) are not part of the page and are left out.
 *
 * A one-axis area must also shut its other axis (`overflow-y-hidden` on an
 * `"x"` area, `overflow-x-hidden` on a `"y"` one). CSS turns the other
 * axis of `overflow-x: auto` into `auto` too, and a border or a row's
 * outline then scrolls it by a pixel at some zoom or screen density only
 * (the owner on a Mac, 2026-11-24): that is reported at any size, whether
 * or not it overflows on this run.
 */
export function scrollIssues(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const issues: string[] = []
    const root = document.scrollingElement ?? document.documentElement
    if (root.scrollWidth > window.innerWidth) {
      issues.push(
        `page scrolls sideways: ${String(root.scrollWidth)}px in ${String(window.innerWidth)}px`
      )
    }
    const SCROLLS = new Set(["auto", "scroll"])
    const POPUP = "[role=dialog], [role=menu], [role=listbox], [data-radix-popper-content-wrapper]"
    const nameOf = (el: Element) => {
      const parts: string[] = []
      let at: Element | null = el
      while (at && at !== document.body && parts.length < 4) {
        const slot = at.getAttribute("data-slot")
        const label = at.getAttribute("aria-label")
        const role = at.getAttribute("role")
        const classes = Array.from(at.classList).slice(0, 4).join(".")
        parts.unshift(
          at.tagName.toLowerCase() +
            (slot ? `[data-slot=${slot}]` : "") +
            (role ? `[role=${role}]` : "") +
            (label ? `[aria-label="${label}"]` : "") +
            (classes ? `.${classes}` : "")
        )
        at = at.parentElement
      }
      return parts.join(" > ")
    }
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (el === root || el.closest(POPUP)) {
        continue
      }
      const style = getComputedStyle(el)
      const x = SCROLLS.has(style.overflowX)
      const y = SCROLLS.has(style.overflowY)
      if (!x && !y) {
        continue
      }
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.height === 0 || style.visibility === "hidden") {
        continue
      }
      const allowed = el.getAttribute("data-scroll-area") ?? ""
      if ((allowed === "x" && y) || (allowed === "y" && x)) {
        issues.push(
          `${allowed}-only scroll area leaves its other axis open (overflow ${style.overflowX} ${style.overflowY}): ${nameOf(el)}`
        )
      }
      const sideways = x && el.scrollWidth > el.clientWidth && !/^(x|both)$/.test(allowed)
      const upDown = y && el.scrollHeight > el.clientHeight && !/^(y|both)$/.test(allowed)
      if (sideways) {
        issues.push(
          `scrolls sideways ${String(el.scrollWidth)}/${String(el.clientWidth)}px: ${nameOf(el)}`
        )
      }
      if (upDown) {
        issues.push(
          `scrolls up-down ${String(el.scrollHeight)}/${String(el.clientHeight)}px: ${nameOf(el)}`
        )
      }
    }
    return [...new Set(issues)]
  })
}
