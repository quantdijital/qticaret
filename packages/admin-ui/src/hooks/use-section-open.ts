import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"

const PREFIX = "qt.panel.section"

/**
 * Whose choices the sections remember: the app reads its signed-in person
 * (asked on every draw, so a sign-in in between counts); none, in a test
 * or before sign-in, is "anyone". The package knows no app's user.
 */
export const SectionOwner = createContext<() => string | undefined>(() => undefined)

/**
 * How the page around would have a section start, by its remembered name
 * (the shop's layout opening its folded parts, "Gelişmiş"); undefined
 * leaves the section's own default. A person's own choice still wins.
 */
export const SectionDefaults = createContext<(name: string) => boolean | undefined>(() => undefined)

const keyOf = (user: string, name: string) => `${PREFIX}:${user}:${name}`

/** The person's last choice for a section, or none; storage may refuse (private mode, blocked). */
export function readSectionOpen(user: string, name: string): boolean | null {
  try {
    const value = window.localStorage.getItem(keyOf(user, name))
    return value === "1" ? true : value === "0" ? false : null
  } catch {
    return null
  }
}

function writeSectionOpen(user: string, name: string, open: boolean): void {
  try {
    window.localStorage.setItem(keyOf(user, name), open ? "1" : "0")
  } catch {
    // Not remembered: the section opens as it would the first time
  }
}

/**
 * A person's last choice among a few (a card's open tab), remembered per
 * user in this browser beside the sections' (`name`: "product.dataTab");
 * the fallback until they chose, or when storage refuses.
 */
export function useRememberedChoice<T extends string>(
  name: string,
  fallback: T
): [string, (next: T) => void] {
  const user = useContext(SectionOwner)() ?? "anyone"
  const [value, setValue] = useState<string>(() => {
    try {
      return window.localStorage.getItem(keyOf(user, name)) ?? fallback
    } catch {
      return fallback
    }
  })
  const choose = (next: T) => {
    setValue(next)
    try {
      window.localStorage.setItem(keyOf(user, name), next)
    } catch {
      // Not remembered: the next visit starts on the fallback
    }
  }
  return [value, choose]
}

// The sections on the page by their element id: a jump to a field inside a closed one opens it first
const openers = new Map<string, () => void>()

// A card in a column that follows the scroll (`PageColumn sticky`, where the columns stand side by side)
const inStuckColumn = (el: Element): boolean => {
  const column = el.closest("[data-sticks]")
  return column !== null && getComputedStyle(column).position === "sticky"
}

/**
 * Takes the person to a section (the SEO advisor's "go to field"): a
 * closed one opens first, then the page scrolls to it, its top in sight.
 * An id that is not a section is only scrolled to. A card of a side
 * column that follows the scroll moves with the page until held: the
 * page moves only as far as it needs to show the card whole.
 */
export function revealSection(id: string): void {
  const open = openers.get(id)
  if (open) {
    flushSync(open)
  }
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: inStuckColumn(el) ? "nearest" : "start" })
  }
}

/**
 * A place that is not a section but is shown only on demand (a card's
 * other view): the advisor's jump to `id` runs `reveal` first, then
 * scrolls to the element with that id.
 */
export function useRevealTarget(id: string, reveal: () => void): void {
  const latest = useRef(reveal)
  useLayoutEffect(() => {
    latest.current = reveal
  })
  useEffect(() => {
    const opener = () => {
      latest.current()
    }
    openers.set(id, opener)
    return () => {
      if (openers.get(id) === opener) {
        openers.delete(id)
      }
    }
  }, [id])
}

interface SectionOpenOptions {
  /** The section's element id, for `revealSection`. */
  id: string
  /** Its name in the person's remembered choices ("content.seo"); shared by the pages that show it. */
  name: string
  /** Something in it to see to: it opens, whatever was chosen before. */
  attention: boolean
  /** Open the first time, before the person chose. */
  defaultOpen: boolean
}

/**
 * A collapsible section's open state (docs/18 §7 CollapsibleSection): one
 * that needs attention opens, also when that is known only after the
 * first draw (the advisor answers later); otherwise the person's last
 * choice for it, remembered per user in this browser; otherwise its
 * default. Opening for attention is not remembered as a choice.
 */
export function useSectionOpen({ id, name, attention, defaultOpen }: SectionOpenOptions) {
  // The signed-in person, as the app already loaded them; none in a test
  const user = useContext(SectionOwner)() ?? "anyone"
  const preferred = useContext(SectionDefaults)(name) ?? defaultOpen
  const [open, setOpen] = useState(() => attention || (readSectionOpen(user, name) ?? preferred))
  const [needed, setNeeded] = useState(attention)
  if (attention !== needed) {
    setNeeded(attention)
    if (attention) {
      setOpen(true)
    }
  }
  // The page's default changed (its layout loaded, or a preset is tried): followed until the person chose
  const [wanted, setWanted] = useState(preferred)
  if (preferred !== wanted) {
    setWanted(preferred)
    if (readSectionOpen(user, name) === null) {
      setOpen(attention || preferred)
    }
  }
  useEffect(() => {
    const opener = () => {
      setOpen(true)
    }
    openers.set(id, opener)
    return () => {
      // A newer section under the same id (the next page's) keeps its own
      if (openers.get(id) === opener) {
        openers.delete(id)
      }
    }
  }, [id])
  const toggle = () => {
    const next = !open
    setOpen(next)
    writeSectionOpen(user, name, next)
  }
  return { open, toggle }
}
