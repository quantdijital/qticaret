import { useEffect, useEffectEvent } from "react"

// A field keeps its own undo: the editor's steps are for everything else
const typing = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

/** ⌘Z / Ctrl+Z undoes the editor's last step, with Shift (or Ctrl+Y) redoes it. */
export function useUndoKeys(onUndo: () => void, onRedo: () => void) {
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || typing(event.target)) {
      return
    }
    const key = event.key.toLowerCase()
    if (key === "z") {
      event.preventDefault()
      if (event.shiftKey) {
        onRedo()
      } else {
        onUndo()
      }
    } else if (key === "y" && event.ctrlKey) {
      event.preventDefault()
      onRedo()
    }
  })
  useEffect(() => {
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
    }
  }, [])
}
