import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react"

/** A line the page on screen adds to the command menu (⌘K): a place on it to go to. */
export interface PageCommand {
  key: string
  label: string
  /** Other words it is found by ("fiyat" for the variants). */
  keywords?: readonly string[]
  run: () => void
}

/** The page's lines under their heading ("Alana git"); none on most pages. */
export interface PageCommands {
  heading: string
  items: readonly PageCommand[]
}

let current: PageCommands | null = null
const listeners = new Set<() => void>()

const notify = () => {
  for (const listener of listeners) {
    listener()
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The lines the page on screen offers, for the command menu. */
export function usePageCommandList(): PageCommands | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null
  )
}

/**
 * Offers the page's own places in the command menu while it is on screen
 * (the product page's sections and fields, docs/06 "Ürün sayfası"). Its
 * lines change only when their keys or names do; each runs what the page
 * gives it last.
 */
export function usePageCommands(heading: string, items: readonly PageCommand[]): void {
  const latest = useRef(items)
  useLayoutEffect(() => {
    latest.current = items
  })
  const shape = `${heading}|${items.map((item) => `${item.key}:${item.label}`).join("|")}`
  useEffect(() => {
    const mine: PageCommands = {
      heading,
      items: latest.current.map((item) => ({
        ...item,
        run: () => {
          latest.current.find((each) => each.key === item.key)?.run()
        },
      })),
    }
    current = mine
    notify()
    return () => {
      if (current === mine) {
        current = null
        notify()
      }
    }
    // `shape` stands for the items' keys and names: new functions alone redraw nothing
  }, [heading, shape])
}
