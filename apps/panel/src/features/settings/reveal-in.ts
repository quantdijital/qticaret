/**
 * Scrolls `box` the least that shows all of `item`: the box only, never
 * the page around it (the settings menu, scrolling on its own beside a
 * page, brings the current page's link into view).
 */
export function revealIn(box: HTMLElement, item: HTMLElement): void {
  const outer = box.getBoundingClientRect()
  const inner = item.getBoundingClientRect()
  if (inner.top < outer.top) {
    box.scrollTop -= outer.top - inner.top
  } else if (inner.bottom > outer.bottom) {
    // An item taller than the box keeps its top in view
    box.scrollTop += Math.min(inner.bottom - outer.bottom, inner.top - outer.top)
  }
}
