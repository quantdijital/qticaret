import type { Page } from "@playwright/test"

/**
 * The panel's balance rules (docs/18 §2, "Denge"), measured on a rendered
 * page. Two kinds of imbalance are reported:
 *
 * - cards: blocks side by side on one row (single cards, or columns of
 *   cards) whose last cards end on different lines;
 * - controls: buttons, fields and segmented groups side by side in one
 *   row with different heights.
 *
 * A sticky summary column (`data-layout-free`) follows the scroll and is
 * left out, as are tables, dialogs and the sidebar.
 */
export function layoutIssues(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const CONTROL =
      "button, a[data-slot=button], input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=color]), select, [role=combobox], [role=group], [role=radiogroup], [role=tablist]"
    const SKIP = "table, [role=dialog], [data-sidebar], [data-layout-free]"
    const issues: string[] = []
    const main = document.querySelector("main") ?? document.body
    const visible = (el: Element) => {
      const box = el.getBoundingClientRect()
      return box.width > 0 && box.height > 0
    }
    const nameOf = (el: Element) => {
      const text = (el.querySelector("h1, h2, h3")?.textContent ?? el.textContent).trim()
      return `${el.tagName.toLowerCase()} "${text.slice(0, 32)}"`
    }
    const rowsOf = <T extends { el: Element }>(items: T[], at: (el: Element) => number) => {
      const rows = new Map<number, T[]>()
      for (const item of items) {
        const key = Math.round(at(item.el) / 6)
        rows.set(key, [...(rows.get(key) ?? []), item])
      }
      return [...rows.values()].filter((row) => row.length > 1)
    }
    const containers = Array.from(main.querySelectorAll("*")).filter((el) => {
      if (el.closest(SKIP)) {
        return false
      }
      const style = getComputedStyle(el)
      return (
        style.display === "grid" ||
        ((style.display === "flex" || style.display === "inline-flex") &&
          style.flexDirection === "row")
      )
    })
    for (const container of containers) {
      const children = Array.from(container.children).filter(
        (child) => visible(child) && !child.matches("[data-layout-free]")
      )
      // Cards: a card, or a column whose own children are cards
      const blocks = children.flatMap((child) => {
        const cards = child.matches("section")
          ? [child]
          : Array.from(child.querySelectorAll(":scope > section, :scope > div > section"))
        return cards.length > 0
          ? [
              {
                el: child,
                end: Math.max(...cards.map((card) => card.getBoundingClientRect().bottom)),
              },
            ]
          : []
      })
      for (const row of rowsOf(blocks, (el) => el.getBoundingClientRect().top)) {
        const ends = row.map((block) => Math.round(block.end))
        const spread = Math.max(...ends) - Math.min(...ends)
        if (spread > 2) {
          issues.push(
            `cards end ${String(spread)}px apart: ${row.map((block) => nameOf(block.el)).join(" | ")}`
          )
        }
      }
      // Controls: a control, or a tight wrapper around exactly one
      const controls = children.flatMap((child) => {
        if (child.matches(CONTROL)) {
          return [{ el: child, height: child.getBoundingClientRect().height }]
        }
        const inner = Array.from(child.querySelectorAll(CONTROL)).filter(visible)
        const only = inner.length === 1 ? inner[0] : undefined
        const height = child.getBoundingClientRect().height
        return only && Math.abs(only.getBoundingClientRect().height - height) <= 1
          ? [{ el: child, height }]
          : []
      })
      const middle = (el: Element) => {
        const box = el.getBoundingClientRect()
        return box.top + box.height / 2
      }
      for (const row of rowsOf(controls, middle)) {
        const heights = row.map((control) => Math.round(control.height))
        if (Math.max(...heights) - Math.min(...heights) > 1) {
          issues.push(
            `controls ${heights.join("/")}px: ${row
              .map((control) => {
                const text = control.el.textContent.trim()
                return (text !== "" ? text : (control.el.getAttribute("aria-label") ?? "")).slice(
                  0,
                  24
                )
              })
              .join(" | ")}`
          )
        }
      }
    }
    return [...new Set(issues)]
  })
}
