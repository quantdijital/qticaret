import { createContext, useCallback, useContext, useId, useLayoutEffect, useState } from "react"

/**
 * How a panel group counts its settings off their defaults when its form
 * does not say (adr/0065 Ek, sekmeler: the mark beside a group's title).
 * A setting off its default draws "Varsayılana dön" (`ResetButton`), which
 * tells the group it stands in while it is drawn; a closed group's fields
 * are drawn too, hidden, so they count.
 */
export const GroupMarkContext = createContext<((id: string) => () => void) | null>(null)

/** The group's side: what its fields told, and the way they tell it. */
export function useGroupMarks() {
  const [marks, setMarks] = useState<ReadonlySet<string>>(new Set())
  const note = useCallback((id: string) => {
    setMarks((was) => (was.has(id) ? was : new Set(was).add(id)))
    return () => {
      setMarks((was) => {
        const next = new Set(was)
        next.delete(id)
        return next
      })
    }
  }, [])
  return { count: marks.size, note }
}

/** A setting's side: drawn off its default, it counts on its group's title. */
export function useOffDefault() {
  const note = useContext(GroupMarkContext)
  const id = useId()
  useLayoutEffect(() => note?.(id), [note, id])
}
