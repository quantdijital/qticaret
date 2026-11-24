import type { PopupMemory } from "./popup-rules"

/**
 * What the browser remembers for the pop-ups (adr/0080 §4): functional
 * storage, no personal data (adr/0038's cookie classes). In `localStorage`
 * each pop-up's last showing and whether it was done with, and the mark
 * that this browser has seen the shop before; in `sessionStorage` the
 * pop-ups shown in this session and whether this session's visitor came
 * back. A storage that throws (blocked, full, a private window) never
 * breaks the page: what it could not keep is kept for this page alone.
 */

const MEMORY_KEY = "qt:popups"
const SESSION_KEY = "qt:popups:session"
const VISITED_KEY = "qt:visited"
const VISIT_KEY = "qt:visit"
/** Kept at most: the oldest showings go first, a shop never has that many live. */
const MAX_REMEMBERED = 50

type Area = "local" | "session"

// What a storage that threw could not keep, for this page's life
const fallback: Record<Area, Map<string, string>> = { local: new Map(), session: new Map() }

const storageOf = (area: Area): Storage =>
  area === "local" ? window.localStorage : window.sessionStorage

function read(area: Area, key: string): string | null {
  try {
    return storageOf(area).getItem(key)
  } catch {
    return fallback[area].get(key) ?? null
  }
}

function write(area: Area, key: string, value: string): void {
  try {
    storageOf(area).setItem(key, value)
  } catch {
    fallback[area].set(key, value)
  }
}

function parsed(text: string | null): unknown {
  if (text === null) {
    return null
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** Each pop-up's memory; anything unreadable is forgotten. */
export function popupMemory(): Record<string, PopupMemory> {
  const stored = parsed(read("local", MEMORY_KEY))
  if (!isRecord(stored)) {
    return {}
  }
  const memory: Record<string, PopupMemory> = {}
  for (const [id, value] of Object.entries(stored)) {
    if (!isRecord(value)) {
      continue
    }
    const { shown_at: shownAt, dismissed } = value as { shown_at?: unknown; dismissed?: unknown }
    const each: PopupMemory = {}
    if (typeof shownAt === "number" && Number.isFinite(shownAt)) {
      each.shown_at = shownAt
    }
    if (dismissed === true) {
      each.dismissed = true
    }
    memory[id] = each
  }
  return memory
}

function remember(id: string, change: PopupMemory): void {
  const known = popupMemory()
  const memory = { ...known, [id]: { ...known[id], ...change } }
  const kept = Object.entries(memory)
    .sort(([, a], [, b]) => (b.shown_at ?? 0) - (a.shown_at ?? 0))
    .slice(0, MAX_REMEMBERED)
  write("local", MEMORY_KEY, JSON.stringify(Object.fromEntries(kept)))
}

/** The pop-ups shown in this browser session. */
export function sessionShown(): Set<string> {
  const stored = parsed(read("session", SESSION_KEY))
  return new Set(
    Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : []
  )
}

/** Notes a showing: its time, and this session's. */
export function rememberShown(id: string, now: number = Date.now()): void {
  remember(id, { shown_at: now })
  const shown = sessionShown()
  shown.add(id)
  write("session", SESSION_KEY, JSON.stringify([...shown]))
}

/** Notes it done with (closed, clicked, signed up from): `until_closed` stops asking. */
export function rememberDismissed(id: string): void {
  remember(id, { dismissed: true })
}

/**
 * Whether this session's visitor had seen the shop before it began:
 * decided on the session's first page and kept for its others, so a new
 * visitor stays new for the whole visit.
 */
export function returningVisitor(now: number = Date.now()): boolean {
  const decided = read("session", VISIT_KEY)
  if (decided === "new" || decided === "returning") {
    return decided === "returning"
  }
  const returning = read("local", VISITED_KEY) !== null
  if (!returning) {
    write("local", VISITED_KEY, String(now))
  }
  write("session", VISIT_KEY, returning ? "returning" : "new")
  return returning
}

/** Forgets what a throwing storage kept for this page (a test's fresh page). */
export function forgetPopupFallback(): void {
  fallback.local.clear()
  fallback.session.clear()
}
