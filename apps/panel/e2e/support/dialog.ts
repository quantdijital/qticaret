import type { Page } from "@playwright/test"

/** The width under which the panel's dialogs are sheets along the screen's edge (Tailwind's `sm`). */
export const SHEET_BELOW = 640

/**
 * The open dialog measured as drawn (the owner, 2026-11-03: the refund
 * dialog spilled out of its box). Reported: a box off the screen, anything
 * wider than the box (a row pushed out by a long name), a footer that
 * cannot be reached, footer buttons of different heights, a box taller than
 * 85% of the screen from `sm` up, and on a phone a box that is not a
 * full-width sheet along the screen's bottom (or top) edge.
 */
export async function dialogIssues(page: Page): Promise<string[]> {
  return page.evaluate((sheetBelow) => {
    const issues: string[] = []
    const box = document.querySelector(
      "[role=dialog][data-state=open], [role=alertdialog][data-state=open]"
    )
    if (!box) {
      return ["no open dialog"]
    }
    const width = window.innerWidth
    const height = window.innerHeight
    const rect = box.getBoundingClientRect()
    if (rect.top < -1 || rect.bottom > height + 1 || rect.left < -1 || rect.right > width + 1) {
      issues.push(
        `box off the screen: ${String(Math.round(rect.left))},${String(Math.round(rect.top))} to ${String(Math.round(rect.right))},${String(Math.round(rect.bottom))}`
      )
    }
    if (box.scrollWidth > box.clientWidth + 1) {
      issues.push(`content ${String(box.scrollWidth - box.clientWidth)}px wider than the box`)
    }
    // A row pushed past the box's sides, outside anything that scrolls sideways on purpose
    for (const element of Array.from(box.querySelectorAll("*"))) {
      const own = element.getBoundingClientRect()
      if (own.width === 0 || own.right <= rect.right + 1) {
        continue
      }
      let scroller = element.parentElement
      while (scroller && scroller !== box && getComputedStyle(scroller).overflowX === "visible") {
        scroller = scroller.parentElement
      }
      if (scroller === box) {
        issues.push(
          `${element.tagName.toLowerCase()} runs ${String(Math.round(own.right - rect.right))}px past the box`
        )
        break
      }
    }
    const footer = box.querySelector(
      "[data-slot=dialog-footer], [data-slot=alert-dialog-footer], [data-slot=sheet-footer]"
    )
    if (footer) {
      const end = footer.getBoundingClientRect()
      if (end.bottom > Math.min(rect.bottom, height) + 1) {
        issues.push(`footer ends ${String(Math.round(end.bottom - height))}px under the screen`)
      }
      const heights = new Set(
        Array.from(footer.querySelectorAll("button, a"))
          .filter((control) => control.getBoundingClientRect().height > 0)
          .map((control) => Math.round(control.getBoundingClientRect().height))
      )
      if (heights.size > 1) {
        issues.push(`footer buttons of ${[...heights].join(" and ")}px`)
      }
    }
    const sheet = box.getAttribute("data-slot") === "sheet-content"
    // From `sm` up a dialog is at most `--dialog-max-height` (85% of the screen) tall and
    // scrolls inside (the owner, 2026-11-05: "o modal niye bu kadar yüksek?")
    if (!sheet && width >= sheetBelow && rect.height > height * 0.85 + 1) {
      issues.push(`box ${String(Math.round(rect.height))}px tall, past 85% of the screen`)
    }
    // A sheet along the bottom edge (the command menu hangs from the top, clear of the keyboard)
    const edge = rect.bottom >= height - 1 || rect.top <= 1
    if (!sheet && width < sheetBelow && (rect.left > 1 || rect.right < width - 1 || !edge)) {
      issues.push("not a full-width sheet along the screen's edge on a phone")
    }
    return issues
  }, SHEET_BELOW)
}
