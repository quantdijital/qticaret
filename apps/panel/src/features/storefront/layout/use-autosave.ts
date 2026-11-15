import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSaveLayout } from "@/features/storefront/api/layout"
import type { LayoutDocument } from "@/features/storefront/api/layout"
import { errorText } from "@/lib/errors"
import type { EditorAction } from "./editor-state"

/** How long the editor waits after the last change before it saves the draft. */
export const AUTOSAVE_MS = 1500

/**
 * A change made in one go (adr/0065 §5): adding, removing, moving, hiding,
 * a choice picked, undo and redo. Saved at once; typing (a change with a
 * `merge` key) waits for a pause as before.
 */
export const isDiscrete = (action: EditorAction): boolean =>
  action.type !== "load" && !("merge" in action && action.merge)

export type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  /** The server refused `body` (the document as sent); it is not sent again until it changes. */
  | { kind: "error"; message: string; body: string }

interface AutosaveOptions {
  doc: LayoutDocument
  /** The draft as stored; null: never saved (the default design), so the first save is due. */
  stored: LayoutDocument | null
  /** The draft has a problem the server would refuse: it waits until it is fixed. */
  blocked: boolean
  delay?: number
}

/**
 * The theme editor's autosave (adr/0049): a change is saved to the draft
 * once nothing changed for a moment, a change made in one go at once
 * (`hurry`, adr/0065 §5). One save runs at a time; a change
 * made meanwhile is saved after it. A refused save keeps the local
 * document as it is and says why; the next change, or "retry", sends again.
 */
export function useAutosave({ doc, stored, blocked, delay = AUTOSAVE_MS }: AutosaveOptions) {
  const { t } = useTranslation()
  const save = useSaveLayout()
  const [saved, setSaved] = useState(() => (stored ? JSON.stringify(stored) : ""))
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" })
  // Each saved draft has a new preview link: the frame asks for one per round
  const [round, setRound] = useState(0)
  const body = JSON.stringify(doc)
  const dirty = body !== saved
  // What async callers (leave, publish) read after awaiting
  const live = useRef({ doc, saved, running: null as Promise<boolean> | null })
  // The next save goes without waiting (a change made in one go)
  const urgent = useRef(false)
  useEffect(() => {
    live.current.doc = doc
  }, [doc])

  const send = useCallback(
    (document: LayoutDocument): Promise<boolean> => {
      const sent = JSON.stringify(document)
      setStatus({ kind: "saving" })
      const run = save.mutateAsync(document).then(
        () => {
          live.current.saved = sent
          setSaved(sent)
          setStatus({ kind: "saved", at: new Date() })
          setRound((was) => was + 1)
          return true
        },
        (failure: unknown) => {
          setStatus({ kind: "error", message: errorText(t, failure), body: sent })
          return false
        }
      )
      live.current.running = run
      void run.finally(() => {
        if (live.current.running === run) {
          live.current.running = null
        }
      })
      return run
    },
    [save, t]
  )

  const saving = status.kind === "saving"
  const refusedAsIs = status.kind === "error" && status.body === body
  const onQuiet = useEffectEvent(() => {
    void send(doc)
  })
  useEffect(() => {
    if (!dirty || saving || blocked || refusedAsIs) {
      return
    }
    const timer = setTimeout(
      () => {
        urgent.current = false
        onQuiet()
      },
      urgent.current ? 0 : delay
    )
    return () => {
      clearTimeout(timer)
    }
  }, [body, dirty, saving, blocked, refusedAsIs, delay])

  /** Saves what is waiting now (before leaving, publishing or previewing); true once it is stored. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (live.current.running) {
      await live.current.running
    }
    const latest = live.current.doc
    if (JSON.stringify(latest) === live.current.saved) {
      return true
    }
    return blocked ? false : send(latest)
  }, [blocked, send])

  /** A document the server just gave (discarded, restored): stored as it is, nothing to save. */
  const reset = useCallback((next: LayoutDocument) => {
    const text = JSON.stringify(next)
    live.current.doc = next
    live.current.saved = text
    setSaved(text)
    setStatus({ kind: "idle" })
    setRound((was) => was + 1)
  }, [])

  const hurry = useCallback(() => {
    urgent.current = true
  }, [])

  return {
    status,
    /** A change not yet stored (waiting, being saved or refused). */
    dirty,
    round,
    flush,
    reset,
    retry: () => void send(live.current.doc),
    /** The change about to be made is saved at once, not after the pause. */
    hurry,
  }
}
