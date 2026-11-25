import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react"
import type { ReactNode } from "react"

/** A form on the page that saves on its own (a card): what the page's save bar needs of it. */
export interface DirtyEntry {
  dirty: boolean
  saving: boolean
  /** Saves it as its own "Kaydet" does (its checks included). */
  submit: () => void
  /** Lets its changes go as its own "Geri al" / "Vazgeç" does. */
  reset: () => void
}

/** What the page knows of its forms together. */
export interface DirtyState {
  /** Forms holding unsaved changes. */
  dirty: number
  /** Some form is saving. */
  saving: boolean
}

const CLEAN: DirtyState = { dirty: 0, saving: false }

/**
 * The page's forms by id: each card puts its latest state in, the save bar
 * reads the count and saves or lets go of all of them. Listeners hear only
 * when the count or the saving changes, not on every keystroke.
 */
export function createDirtyRegistry() {
  const entries = new Map<string, DirtyEntry>()
  const listeners = new Set<() => void>()
  let state: DirtyState = CLEAN
  const refresh = () => {
    const list = [...entries.values()]
    const next: DirtyState = {
      dirty: list.filter((entry) => entry.dirty).length,
      saving: list.some((entry) => entry.saving),
    }
    if (next.dirty !== state.dirty || next.saving !== state.saving) {
      state = next
      for (const listener of listeners) {
        listener()
      }
    }
  }
  return {
    set(id: string, entry: DirtyEntry) {
      entries.set(id, entry)
      refresh()
    },
    remove(id: string) {
      entries.delete(id)
      refresh()
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    state: () => state,
    /** Saves every form with changes, each through its own save. */
    submitAll() {
      for (const entry of [...entries.values()]) {
        if (entry.dirty && !entry.saving) {
          entry.submit()
        }
      }
    },
    /** Lets every form's changes go. */
    resetAll() {
      for (const entry of [...entries.values()]) {
        if (entry.dirty) {
          entry.reset()
        }
      }
    },
  }
}

export type DirtyRegistry = ReturnType<typeof createDirtyRegistry>

const Registry = createContext<DirtyRegistry | null>(null)

/** A page whose cards save on their own and share one save bar (docs/06 "Ürün sayfası"). */
export function DirtyRegistryProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(createDirtyRegistry)
  return <Registry.Provider value={registry}>{children}</Registry.Provider>
}

/**
 * Puts a form into the page's registry while it is drawn; outside a page
 * that has one, nothing. `CardForm` and the side cards' forms call it.
 */
export function useDirtyEntry(entry: DirtyEntry): void {
  const registry = useContext(Registry)
  const id = useId()
  // Its latest state and functions on every draw; the count changes only when `dirty` does
  useLayoutEffect(() => {
    registry?.set(id, entry)
  })
  useEffect(
    () => () => {
      registry?.remove(id)
    },
    [registry, id]
  )
}

/** The page's registry and its state, for the save bar; null outside a page that has one. */
export function useDirtyRegistry(): (DirtyRegistry & { now: DirtyState }) | null {
  const registry = useContext(Registry)
  const now = useSyncExternalStore(
    (listener) => registry?.subscribe(listener) ?? (() => undefined),
    () => registry?.state() ?? CLEAN,
    () => CLEAN
  )
  return registry ? { ...registry, now } : null
}
