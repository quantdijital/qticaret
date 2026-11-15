import { useLayoutEffect, useRef } from "react"

/** How far up a chain of menus (a submenu's trigger in its parent menu) the opener is followed. */
const MENU_DEPTH = 4

/**
 * Where the caret was when a dialog opened: the focused element, and, when
 * that is a menu's item (gone once the menu closes), the trigger of each
 * menu around it, nearest first. Nothing while the caret is on the page.
 */
function openerChain(): HTMLElement[] {
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || active === document.body) {
    return []
  }
  const chain: HTMLElement[] = [active]
  let current: HTMLElement = active
  for (let depth = 0; depth < MENU_DEPTH; depth += 1) {
    const menu = current.closest<HTMLElement>('[role="menu"]')
    if (!menu?.id) {
      break
    }
    const trigger = Array.from(document.querySelectorAll<HTMLElement>("[aria-controls]")).find(
      (element) => element.getAttribute("aria-controls")?.split(/\s+/).includes(menu.id)
    )
    if (!trigger) {
      break
    }
    chain.push(trigger)
    current = trigger
  }
  return chain
}

/**
 * Returns the caret to what opened a dialog shown from state, with no Radix
 * trigger: Radix gives it back to the trigger only, so without one it falls
 * to the page (WCAG 2.4.3). The opener is taken as `open` turns true (the
 * first render included); on closing it goes to `returnFocus` when given,
 * otherwise to that opener while it is still in the page and takes it,
 * otherwise Radix's own way. Pass the result as `onCloseAutoFocus`.
 *
 * `returnFocus` keeps its own rule: what it gives, if in the page; null,
 * Radix's own way.
 */
export function useReturnFocus(open: boolean, returnFocus?: () => HTMLElement | null) {
  const opener = useRef<HTMLElement[]>([])
  const wasOpen = useRef(false)
  // Before Radix's focus scope (an effect) moves the caret into the dialog
  useLayoutEffect(() => {
    if (open && !wasOpen.current) {
      opener.current = openerChain()
    }
    wasOpen.current = open
  }, [open])
  return (event: Event) => {
    if (returnFocus) {
      const back = returnFocus()
      if (back?.isConnected) {
        event.preventDefault()
        back.focus()
      }
      return
    }
    const chain = opener.current
    opener.current = []
    for (const element of chain) {
      if (!element.isConnected) {
        continue
      }
      element.focus()
      if (document.activeElement === element) {
        event.preventDefault()
        return
      }
    }
  }
}
