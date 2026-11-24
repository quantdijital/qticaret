import { PANEL_RECORDS, PANEL_RECORD_ID } from "@qticaret/types/panel-map"
import type { PanelRecordType } from "@qticaret/types/panel-map"
import { PANEL_MAP } from "@/features/panel-map/map"
import type { PanelScreen } from "@/features/panel-map/map"

/**
 * The open screen as the assistant is told it (adr/0079 §4): a key of the
 * panel's map and, on a record's own screen, its kind and id. Never its
 * content: the server reads the record itself.
 */
export interface OpenScreen {
  key: string
  record?: { type: PanelRecordType; id: string }
}

type Search = Readonly<Record<string, unknown>>

const RECORD_ROUTES = PANEL_RECORDS.map((record) => ({
  ...record,
  // "/products/$id" → /^\/products\/([^/]+)$/
  pattern: new RegExp(
    `^${record.route.replace(/[.*+?^{}()|[\]\\]/g, "\\$&").replace("$id", "([^/]+)")}$`
  ),
}))

const matchesSearch = (screen: PanelScreen, search: Search) =>
  Object.entries(screen.search ?? {}).every(([name, value]) => search[name] === value)

const withPart = (screen: PanelScreen) => Object.keys(screen.search ?? {}).length

/**
 * The map's entry for a path and its search: the very screen (its part's
 * entry when the search opens one), else a record's screen under its
 * list, else the deepest entry the path sits under; none for a path the
 * map does not hold.
 */
export function openScreenOf(pathname: string, search: Search = {}): OpenScreen | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname
  const exact = PANEL_MAP.filter((screen) => screen.path === path && matchesSearch(screen, search))
  if (exact.length > 0) {
    const best = exact.reduce((one, other) => (withPart(other) > withPart(one) ? other : one))
    return { key: best.key }
  }
  for (const route of RECORD_ROUTES) {
    const id = route.pattern.exec(path)?.[1]
    if (id !== undefined) {
      return PANEL_RECORD_ID.test(id)
        ? { key: route.screen, record: { type: route.type, id } }
        : { key: route.screen }
    }
  }
  const under = PANEL_MAP.filter(
    (screen) => screen.path !== "/" && !screen.search && path.startsWith(`${screen.path}/`)
  )
  if (under.length === 0) {
    return null
  }
  const deepest = under.reduce((one, other) => (other.path.length > one.path.length ? other : one))
  return { key: deepest.key }
}

/** What the empty conversation offers on this screen: three questions of its kind. */
export type ExampleSet = "orders" | "products" | "settings" | "reports" | "general"

export function exampleSetOf(screen: OpenScreen | null): ExampleSet {
  if (!screen) {
    return "general"
  }
  const top = screen.key.split(".")[0]
  return top === "orders" || top === "products" || top === "settings" || top === "reports"
    ? top
    : "general"
}
