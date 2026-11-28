import { useCallback, useState } from "react"
import { useStaff } from "@/features/auth/api/staff"
import { MAIN_PARTS, SIDE_PARTS, TAB_KEYS, isLocked } from "./parts"
import type { PartKey } from "./parts"

/**
 * The product page as one person likes to see it ("Görünüm", WordPress's
 * "Screen Options"): the parts they hid for themselves, over the shop's
 * layout (which stays the team's), and the parts this kind of product does
 * not use (a dated tour's stock) they turned on anyway. Kept per person in
 * this browser (keyed by the staff member's id), as the product list's
 * options are; without storage the defaults stand.
 */
export interface ViewPrefs {
  /** Hidden for this person. */
  hidden: readonly PartKey[]
  /** Not used by this kind of product, shown for this person anyway. */
  shown: readonly PartKey[]
}

export const DEFAULT_VIEW: ViewPrefs = { hidden: [], shown: [] }

const KNOWN: readonly PartKey[] = [
  ...MAIN_PARTS.map((part) => part.key),
  ...SIDE_PARTS.map((part) => part.key),
  ...TAB_KEYS,
]

const STORE = "qt.panel.products.view.v1"

const keysOf = (raw: unknown): PartKey[] =>
  Array.isArray(raw) ? KNOWN.filter((key) => raw.includes(key) && !isLocked(key)) : []

/** Reads what was stored, keeping only the parts the page knows and may hide. */
export function parseView(raw: unknown): ViewPrefs {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_VIEW
  }
  const { hidden, shown } = raw as { hidden?: unknown; shown?: unknown }
  const off = keysOf(hidden)
  return { hidden: off, shown: keysOf(shown).filter((key) => !off.includes(key)) }
}

const keyFor = (person: string) => `${STORE}:${person}`

export function readView(person: string): ViewPrefs {
  try {
    const raw = window.localStorage.getItem(keyFor(person))
    return raw ? parseView(JSON.parse(raw)) : DEFAULT_VIEW
  } catch {
    return DEFAULT_VIEW
  }
}

function writeView(person: string, prefs: ViewPrefs) {
  try {
    window.localStorage.setItem(keyFor(person), JSON.stringify(prefs))
  } catch {
    // No storage (a private window, blocked site data): kept for this visit only
  }
}

/**
 * Whether the person keeps a part off: hidden by them, or not used by this
 * kind of product (`unused`) and not turned on by them.
 */
export function viewOff(prefs: ViewPrefs, key: PartKey, unused: boolean): boolean {
  if (isLocked(key)) {
    return false
  }
  return prefs.hidden.includes(key) || (unused && !prefs.shown.includes(key))
}

/** The preferences with a part switched on or off by the person. */
export function toggleView(prefs: ViewPrefs, key: PartKey, unused: boolean): ViewPrefs {
  if (isLocked(key)) {
    return prefs
  }
  const on = !viewOff(prefs, key, unused)
  const hidden = prefs.hidden.filter((each) => each !== key)
  const shown = prefs.shown.filter((each) => each !== key)
  if (on) {
    // Turned off: an unused part goes back to its kind's default, any other is hidden
    return { hidden: unused ? hidden : [...hidden, key], shown }
  }
  return { hidden, shown: unused ? [...shown, key] : shown }
}

/** The signed-in person's view and its setter; "anon" until the staff answer is in. */
export function useViewPrefs(): [ViewPrefs, (next: ViewPrefs) => void] {
  const person = useStaff()?.user_id ?? "anon"
  const [state, setState] = useState<{ person: string; prefs: ViewPrefs }>(() => ({
    person,
    prefs: readView(person),
  }))
  // Someone else signed in (or the staff answer arrived): their own view
  const current = state.person === person ? state.prefs : readView(person)
  if (state.person !== person) {
    setState({ person, prefs: current })
  }
  const set = useCallback(
    (next: ViewPrefs) => {
      writeView(person, next)
      setState({ person, prefs: next })
    },
    [person]
  )
  return [current, set]
}
