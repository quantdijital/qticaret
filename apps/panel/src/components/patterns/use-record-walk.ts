import { useState } from "react"
import type { RecordSteps } from "./record-stepper"

/**
 * The record a list's dialog shows, and its ‹ n / m › through the list on
 * screen (docs/18 §7). The list's own copy is shown once it is fresher
 * (a save refetched it); a record the list no longer holds stays as it
 * was, without arrows.
 */
export function useRecordWalk<T>(rows: readonly T[] | undefined, keyOf: (row: T) => string) {
  const [opened, setOpened] = useState<T | null>(null)
  const list = rows ?? []
  const key = opened === null ? null : keyOf(opened)
  const index = key === null ? -1 : list.findIndex((row) => keyOf(row) === key)
  const current = index >= 0 ? (list[index] ?? opened) : opened
  const steps: RecordSteps = {
    index: Math.max(index, 0),
    total: index >= 0 ? list.length : 1,
    onGo: (to) => {
      const row = list[to]
      if (row !== undefined) {
        setOpened(row)
      }
    },
  }
  return {
    /** The record open in the dialog; null while it is closed. */
    open: current,
    show: (row: T) => {
      setOpened(row)
    },
    close: () => {
      setOpened(null)
    },
    steps,
  }
}
