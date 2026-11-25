import { useCallback, useState } from "react"
import { useStaff } from "@/features/auth/api/staff"

/**
 * The product list's screen options (WooCommerce's "Screen Options"): how
 * many products a page shows and which columns stand. Kept per person in
 * this browser (keyed by the staff member's id), so two people sharing a
 * computer each keep their own; without storage the defaults stand.
 */

export const PAGE_SIZES = [20, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]

/** The columns that can be hidden; the product, its menu and the picks always stand. */
export const HIDEABLE_COLUMNS = [
  "status",
  "stock",
  "variants",
  "category",
  "updated",
  "seo",
  "price",
] as const
export type HideableColumn = (typeof HIDEABLE_COLUMNS)[number]

export interface ListPrefs {
  pageSize: PageSize
  hidden: readonly HideableColumn[]
}

export const DEFAULT_PREFS: ListPrefs = { pageSize: 20, hidden: [] }

const STORE = "qt.panel.products.list.v1"

/** Reads what was stored, keeping only values the list knows. */
export function parsePrefs(raw: unknown): ListPrefs {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_PREFS
  }
  const { pageSize, hidden } = raw as { pageSize?: unknown; hidden?: unknown }
  return {
    pageSize: PAGE_SIZES.find((size) => size === pageSize) ?? DEFAULT_PREFS.pageSize,
    hidden: Array.isArray(hidden)
      ? HIDEABLE_COLUMNS.filter((column) => hidden.includes(column))
      : DEFAULT_PREFS.hidden,
  }
}

const keyFor = (person: string) => `${STORE}:${person}`

export function readPrefs(person: string): ListPrefs {
  try {
    const raw = window.localStorage.getItem(keyFor(person))
    return raw ? parsePrefs(JSON.parse(raw)) : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

function writePrefs(person: string, prefs: ListPrefs) {
  try {
    window.localStorage.setItem(keyFor(person), JSON.stringify(prefs))
  } catch {
    // No storage (a private window, blocked site data): kept for this visit only
  }
}

/** The signed-in person's options and their setter; "anon" until the staff answer is in. */
export function useListPrefs(): [ListPrefs, (next: ListPrefs) => void] {
  const person = useStaff()?.user_id ?? "anon"
  const [state, setState] = useState<{ person: string; prefs: ListPrefs }>(() => ({
    person,
    prefs: readPrefs(person),
  }))
  // Someone else signed in (or the staff answer arrived): their own options
  const current = state.person === person ? state.prefs : readPrefs(person)
  if (state.person !== person) {
    setState({ person, prefs: current })
  }
  const set = useCallback(
    (next: ListPrefs) => {
      writePrefs(person, next)
      setState({ person, prefs: next })
    },
    [person]
  )
  return [current, set]
}
