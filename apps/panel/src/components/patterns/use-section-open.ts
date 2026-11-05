import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { CURRENT_USER_KEY } from "@/features/auth/api/me"
import type { CurrentUser } from "@/features/auth/api/me"

const PREFIX = "qt.panel.section"

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

// The sections on the page by their element id: a jump to a field inside a closed one opens it first
const openers = new Map<string, () => void>()

/**
 * Takes the person to a section (the SEO advisor's "go to field"): a
 * closed one opens first, then the page scrolls to it, its top in sight.
 * An id that is not a section is only scrolled to.
 */
export function revealSection(id: string): void {
  const open = openers.get(id)
  if (open) {
    flushSync(open)
  }
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
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
  // The signed-in person, as the shell already loaded them; none in a test
  const user = useQueryClient().getQueryData<CurrentUser>(CURRENT_USER_KEY)?.id ?? "anyone"
  const [open, setOpen] = useState(() => attention || (readSectionOpen(user, name) ?? defaultOpen))
  const [needed, setNeeded] = useState(attention)
  if (attention !== needed) {
    setNeeded(attention)
    if (attention) {
      setOpen(true)
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
