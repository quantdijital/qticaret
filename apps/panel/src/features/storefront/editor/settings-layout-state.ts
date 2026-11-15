import { createContext, useCallback, useMemo, useState } from "react"
import { OPEN_AT_FIRST, SETTINGS_TABS } from "./panel-groups"
import type { SettingsTab } from "./panel-groups"

/**
 * A settings panel's tabs and groups (adr/0065 Ek, sekmeler): which tab
 * is open, which groups stand open, what is typed in its own search. The
 * groups are the panel's `PanelGroup`s: each names itself and registers
 * while it is drawn, so a tab with none is not offered and a group alone
 * in its tab stands open without a header to fold it. The groups a shop
 * opened or closed are remembered by the panel's kind (a section's type,
 * the theme), in this browser only; without storage it all still works.
 */

export interface SettingsLayout {
  /** The tab shown; all of a panel's groups sit in one when it has no tabs. */
  active: SettingsTab
  /** The tabs holding a group, in their order. */
  tabs: readonly SettingsTab[]
  /** Whether the panel offers tabs at all (the theme's has none). */
  tabbed: boolean
  query: string
  register: (name: string) => () => void
  /** A group tells how many of its settings are off their defaults (its title's mark). */
  mark: (name: string, count: number) => () => void
  /** Whether a group of the tab holds a setting off its default: a dot beside its name. */
  isMarked: (tab: SettingsTab) => boolean
  tabOf: (name: string) => SettingsTab
  isOpen: (name: string) => boolean
  /** Alone in its tab: open, its header not drawn. */
  isLone: (name: string) => boolean
  /** In the open tab and nothing typed in the search. */
  isShown: (name: string) => boolean
  toggle: (name: string) => void
  /** The tab and the group holding a field the shop is taken to; the search emptied. */
  reveal: (name: string) => void
  setActive: (tab: SettingsTab) => void
  setQuery: (query: string) => void
}

export const SettingsLayoutContext = createContext<SettingsLayout | null>(null)

const STORE = "qticaret.editor.groups.v1"
type Stored = Record<string, Record<string, boolean>>

function readStored(scope: string): Record<string, boolean> {
  try {
    const all = JSON.parse(window.localStorage.getItem(STORE) ?? "{}") as Stored
    const own = all[scope]
    return own && typeof own === "object" ? own : {}
  } catch {
    return {}
  }
}

function writeStored(scope: string, own: Record<string, boolean>) {
  try {
    const all = JSON.parse(window.localStorage.getItem(STORE) ?? "{}") as Stored
    window.localStorage.setItem(STORE, JSON.stringify({ ...all, [scope]: own }))
  } catch {
    // No storage (a private window, blocked site data): the groups are not remembered
  }
}

interface State {
  /** What the state belongs to: a section's id, so another section starts afresh. */
  key: string
  active: SettingsTab | null
  query: string
  /** The groups opened to show a field, not by the shop: not remembered. */
  revealed: ReadonlySet<string>
  stored: Record<string, boolean>
  /** The last field picked from outside (the settings search, the preview) already shown. */
  seen: number | null
}

const fresh = (key: string, scope: string): State => ({
  key,
  active: null,
  query: "",
  revealed: new Set(),
  stored: readStored(scope),
  seen: null,
})

/** A field picked from outside: the group it sits in, a fresh number for each pick. */
export interface LayoutFocus {
  group: string
  nonce: number
}

/**
 * The layout's state for one panel: `scope` its kind (remembered by),
 * `resetKey` the thing shown. Each new `focus` opens its group's tab and
 * the group, while the panel draws, so the field is shown in the same
 * pass that focuses it (`useFieldFocus`).
 */
export function useSettingsLayout({
  scope,
  resetKey,
  tabOf,
  tabbed,
  focus,
}: {
  scope: string
  resetKey: string
  tabOf: (name: string) => SettingsTab
  tabbed: boolean
  focus: LayoutFocus | null
}): SettingsLayout {
  const [state, setState] = useState(() => fresh(resetKey, scope))
  const [names, setNames] = useState<readonly string[]>([])
  let current = state.key === resetKey ? state : fresh(resetKey, scope)
  if (focus && focus.nonce !== current.seen) {
    current = {
      ...current,
      seen: focus.nonce,
      active: tabOf(focus.group),
      query: "",
      revealed: new Set(current.revealed).add(focus.group),
    }
  }
  if (current !== state) {
    setState(current)
  }
  const register = useCallback((name: string) => {
    setNames((was) => (was.includes(name) ? was : [...was, name]))
    return () => {
      setNames((was) => was.filter((other) => other !== name))
    }
  }, [])
  const [marks, setMarks] = useState<ReadonlyMap<string, number>>(new Map())
  const mark = useCallback((name: string, count: number) => {
    setMarks((was) => (was.get(name) === count ? was : new Map(was).set(name, count)))
    return () => {
      setMarks((was) => {
        const next = new Map(was)
        next.delete(name)
        return next
      })
    }
  }, [])
  const tabs = useMemo(
    () => SETTINGS_TABS.filter((tab) => names.some((name) => tabOf(name) === tab)),
    [names, tabOf]
  )
  const active =
    current.active !== null && (tabs.length === 0 || tabs.includes(current.active))
      ? current.active
      : (tabs[0] ?? "content")
  const isLone = (name: string) =>
    names.includes(name) && names.filter((other) => tabOf(other) === tabOf(name)).length === 1
  const isOpen = (name: string) =>
    isLone(name) || current.revealed.has(name) || (current.stored[name] ?? OPEN_AT_FIRST.has(name))
  return {
    active,
    tabs,
    tabbed,
    query: current.query,
    register,
    mark,
    isMarked: (tab) => [...marks].some(([name, count]) => count > 0 && tabOf(name) === tab),
    tabOf,
    isOpen,
    isLone,
    isShown: (name) => current.query.trim() === "" && tabOf(name) === active,
    toggle: (name) => {
      const stored = { ...current.stored, [name]: !isOpen(name) }
      const revealed = new Set(current.revealed)
      revealed.delete(name)
      writeStored(scope, stored)
      setState({ ...current, stored, revealed })
    },
    reveal: (name) => {
      setState({
        ...current,
        active: tabOf(name),
        query: "",
        revealed: new Set(current.revealed).add(name),
      })
    },
    setActive: (tab) => {
      setState({ ...current, active: tab })
    },
    setQuery: (query) => {
      setState({ ...current, query })
    },
  }
}
