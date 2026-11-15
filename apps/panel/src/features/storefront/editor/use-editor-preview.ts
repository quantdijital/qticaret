import { useCallback, useEffect, useRef, useState } from "react"
import type { Dispatch } from "react"
import { useTranslation } from "react-i18next"
import type { BodyGroup, LayoutDocument } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import {
  findSection,
  idsOf,
  isBodyGroup,
  newSectionId,
} from "@/features/storefront/layout/sections"
import { isDiscrete } from "@/features/storefront/layout/use-autosave"
import { BRIDGE_ON, whyNotShown } from "./bridge/bridge-client"
import { useLivePreview } from "./bridge/use-live-preview"
import { usePreviewPicking } from "./bridge/use-preview-picking"
import type { PreviewField } from "./forms/preview-fields"
import type { Opened } from "./opened"

const V = "storefront.editor.preview"

interface Options {
  doc: LayoutDocument
  /** The page group being edited. */
  page: BodyGroup
  /** The page shown with the draft; null: the home page. */
  path: string | null
  /** The page's first sample is still looked up: `path` does not name it yet. */
  finding?: boolean
  opened: Opened
  ready: boolean
  round: number
  dispatch: Dispatch<EditorAction>
  /** The autosave's: the next change is saved at once. */
  hurry: () => void
  /** A page reached in the frame that is none of the editor's (its path); null: the page picked. */
  visited?: string | null
  /** Faz 2: open a section's form (its edit label pressed in the frame); Faz 2b: at a field. */
  onOpen?: (id: string, focus?: PreviewField) => void
  /** Faz 2: a link followed in the frame. */
  onVisit?: (path: string) => void
  /** Faz 2: the page the frame drew and whose sections it has. */
  onLand?: (path: string, group: BodyGroup | null) => void
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
  finding = false,
  opened,
  ready,
  round,
  dispatch,
  hurry,
  visited = null,
  onOpen = () => undefined,
  onVisit = () => undefined,
  onLand = () => undefined,
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
      // A copy: its id chosen here, so the frame scrolls to it once its save is drawn
      if (action.type === "duplicate" && !action.copyId) {
        const copyId = newSectionId(idsOf(doc))
        afterSave.current(copyId)
        dispatch({ ...action, copyId })
        return
      }
      dispatch(action)
    },
    [dispatch, hurry, doc]
  )
  const preview = useLivePreview({
    ready,
    round,
    page: path,
    holding: finding,
    selected,
    onKey: (key) => {
      if (key === "undo" || key === "redo") {
        act({ type: key })
      }
    },
    onMissing: (id) => {
      setLost(id)
    },
    onPick: (message) => {
      pick.current(message)
    },
  })
  const { selectAfterSave, select, connected } = preview
  // Faz 2: hovering both ways, the edit label, the names, links held in the frame
  const picking = usePreviewPicking({
    doc,
    connected,
    handshakes: preview.handshakes,
    post: preview.post,
    onOpen,
    onVisit,
    onLand,
  })
  const pick = useRef(picking.onPick)
  useEffect(() => {
    pick.current = picking.onPick
  })
  useEffect(() => {
    afterSave.current = (id) => {
      selectAfterSave(id, "if_hidden")
    }
  }, [selectAfterSave])

  // Why the open section is not in the frame, read from the document itself
  const found = selected ? findSection(doc, selected) : null
  // On a page reached in the frame (the cart, a brand) only the header and footer show
  const reason = found
    ? visited !== null && isBodyGroup(found.group)
      ? "other_page"
      : whyNotShown(found, page)
    : null
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
      : (picking.blocked ??
        (reason
          ? t(`${V}.missing.${reason}`)
          : selected !== null && lost === selected
            ? t(`${V}.missing.timeout`)
            : visited !== null
              ? t(`${V}.elsewhere`, { path: visited })
              : null))

  return {
    preview,
    /** Faz 2: the tree's side of hovering, and what a live region says. */
    hover: picking.hover,
    announce: picking.announce,
    act,
    /** What the frame cannot show of what is asked, said beside it; null: nothing. */
    notice,
    /** A section just added: its form opens next and the frame scrolls to it once drawn. */
    markNew: (id: string) => {
      fresh.current.add(id)
    },
  }
}
