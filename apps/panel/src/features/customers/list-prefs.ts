import { useCallback, useState } from "react"
import { useStaff } from "@/features/auth/api/staff"

/**
 * The customer list's columns (WooCommerce's "Screen Options"): which of
 * the optional ones stand. Kept per person in this browser (keyed by the
 * staff member's id); without storage the defaults stand.
 */

/** The columns that can be hidden; the customer and their kind always stand. */
export const OPTIONAL_COLUMNS = [
  "orders",
  "spent",
  "average",
  "lastOrder",
  "city",
  "joined",
] as const
export type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number]

/** A column's name as its header reads it. */
export const COLUMN_LABEL: Record<OptionalColumn, string> = {
  orders: "customers.columns.orders",
  spent: "customers.columns.spent",
  average: "customers.columns.average",
  lastOrder: "customers.columns.lastOrder",
  city: "customers.columns.city",
  joined: "customers.columns.joined",
}

/** The numbers columns: none shown, no totals are read. */
export const STATS_COLUMNS: readonly OptionalColumn[] = [
  "orders",
  "spent",
  "average",
  "lastOrder",
  "city",
]

// The average basket is one more money column; it waits to be asked for
export const DEFAULT_HIDDEN: readonly OptionalColumn[] = ["average"]

const STORE = "qt.panel.customers.columns.v1"

/** Reads what was stored, keeping only columns the list knows. */
export function parseHidden(raw: unknown): readonly OptionalColumn[] {
  return Array.isArray(raw)
    ? OPTIONAL_COLUMNS.filter((column) => raw.includes(column))
    : DEFAULT_HIDDEN
}

const keyFor = (person: string) => `${STORE}:${person}`

function readHidden(person: string): readonly OptionalColumn[] {
  try {
    const raw = window.localStorage.getItem(keyFor(person))
    return raw ? parseHidden(JSON.parse(raw)) : DEFAULT_HIDDEN
  } catch {
    return DEFAULT_HIDDEN
  }
}

function writeHidden(person: string, hidden: readonly OptionalColumn[]) {
  try {
    window.localStorage.setItem(keyFor(person), JSON.stringify(hidden))
  } catch {
    // No storage (a private window, blocked site data): kept for this visit only
  }
}

/** The signed-in person's hidden columns and their setter; "anon" until the staff answer is in. */
export function useHiddenColumns(): [
  readonly OptionalColumn[],
  (next: readonly OptionalColumn[]) => void,
] {
  const person = useStaff()?.user_id ?? "anon"
  const [state, setState] = useState(() => ({ person, hidden: readHidden(person) }))
  const current = state.person === person ? state.hidden : readHidden(person)
  if (state.person !== person) {
    setState({ person, hidden: current })
  }
  const set = useCallback(
    (next: readonly OptionalColumn[]) => {
      const kept = OPTIONAL_COLUMNS.filter((column) => next.includes(column))
      writeHidden(person, kept)
      setState({ person, hidden: kept })
    },
    [person]
  )
  return [current, set]
}
