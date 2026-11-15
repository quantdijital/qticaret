import { useCallback, useEffect, useRef, useState } from "react"
import type { Dispatch } from "react"
import { useTranslation } from "react-i18next"
import type { BodyGroup, LayoutDocument } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import { findSection } from "@/features/storefront/layout/sections"
import { isDiscrete } from "@/features/storefront/layout/use-autosave"
import { BRIDGE_ON, whyNotShown } from "./bridge/bridge-client"
import { useLivePreview } from "./bridge/use-live-preview"
import type { Opened } from "./opened"

const V = "storefront.editor.preview"

interface Options {
  doc: LayoutDocument
  /** The page group being edited. */
  page: BodyGroup
  /** The page shown with the draft; null: the home page. */
  path: string | null
  opened: Opened
  ready: boolean
  round: number
  dispatch: Dispatch<EditorAction>
  /** The autosave's: the next change is saved at once. */
  hurry: () => void
}

/**
 * The theme editor's live preview wiring (adr/0065 Faz 1): every change
 * goes through `act`, which saves a change made in one go at once and,
 * for a moved section, scrolls to it once the save is drawn; the section
 * whose form opens is scrolled to (when off screen) and flashed, a new one
 * always. One that cannot show on this page says why (`notice`), as does a
 * live preview given up. The frame's undo and redo keys come back to the
 * editor's history.
 */
export function useEditorPreview({
  doc,
  page,
  path,
  opened,
  ready,
  round,
  dispatch,
  hurry,
}: Options) {
  const { t } = useTranslation()
  // Sections added in this editor whose form opens next: scrolled to whatever the view
  const fresh = useRef(new Set<string>())
  const selected = opened?.kind === "section" ? opened.id : null
  // The section the frame last said it could not find (it waited for it)
  const [lost, setLost] = useState<string | null>(null)
  // A moved section, scrolled to once its save is drawn (set below, once the preview is known)
  const afterSave = useRef<(id: string) => void>(() => undefined)
  const act = useCallback(
    (action: EditorAction) => {
      if (isDiscrete(action)) {
        hurry()
      }
      if (action.type === "move" || action.type === "place") {
        afterSave.current(action.id)
      }
      dispatch(action)
    },
    [dispatch, hurry]
  )
  const preview = useLivePreview({
    ready,
    round,
    page: path,
    selected,
    onKey: (key) => {
      if (key === "undo" || key === "redo") {
        act({ type: key })
      }
    },
    onMissing: (id) => {
      setLost(id)
    },
  })
  const { selectAfterSave, select, connected } = preview
  useEffect(() => {
    afterSave.current = (id) => {
      selectAfterSave(id, "if_hidden")
    }
  }, [selectAfterSave])

  // Why the open section is not in the frame, read from the document itself
  const found = selected ? findSection(doc, selected) : null
  const reason = found ? whyNotShown(found, page) : null
  // The opened section, shown in the frame; once per opening, not on every keystroke
  const shownReason = useRef(reason)
  useEffect(() => {
    shownReason.current = reason
  }, [reason])
  useEffect(() => {
    if (!connected) {
      return
    }
    if (!selected || shownReason.current) {
      select(null, "never", false)
      return
    }
    const isNew = fresh.current.delete(selected)
    select(selected, isNew ? "always" : "if_hidden", true)
  }, [selected, connected, page, select])

  const notice =
    BRIDGE_ON && !preview.live
      ? t(`${V}.liveOff`)
      : reason
        ? t(`${V}.missing.${reason}`)
        : selected !== null && lost === selected
          ? t(`${V}.missing.timeout`)
          : null

  return {
    preview,
    act,
    /** What the frame cannot show of what is asked, said beside it; null: nothing. */
    notice,
    /** A section just added: its form opens next and the frame scrolls to it once drawn. */
    markNew: (id: string) => {
      fresh.current.add(id)
    },
  }
}
