import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { BRIDGE_MAX_SECTIONS } from "@qticaret/types/editor-bridge"
import type { BodyGroup, LayoutDocument } from "@/features/storefront/api/layout"
import { allSections, findSection, isBodyGroup } from "@/features/storefront/layout/sections"
import { sectionLabel } from "../section-meta"
import type { LivePreview, PickMessage } from "./use-live-preview"

const V = "storefront.editor.preview"

interface Options {
  doc: LayoutDocument
  /** The frame listens (the bridge said it is ready). */
  connected: boolean
  post: LivePreview["post"]
  /** A section's edit label was pressed in the frame: its form opens. */
  onOpen: (id: string) => void
  /** A link followed in the frame: that page is shown. */
  onVisit: (path: string) => void
  /** The frame drew `path`, with `group`'s sections (null: none of the editor's pages). */
  onLand: (path: string, group: BodyGroup | null) => void
}

/** The page group whose sections the frame shows: the first body section's; null for none. */
export function groupOf(doc: LayoutDocument, ids: readonly string[]): BodyGroup | null {
  for (const id of ids) {
    const group = findSection(doc, id)?.group
    if (group && isBodyGroup(group)) {
      return group
    }
  }
  return null
}

/** Each section's name as the tree shows it, for the frame's labels (text only there). */
export function sectionNames(
  doc: LayoutDocument,
  name: (section: ReturnType<typeof allSections>[number], inFooter: boolean) => string
): Record<string, string> {
  const footer = new Set(doc.footer.map((section) => section.id))
  const names: Record<string, string> = {}
  for (const section of allSections(doc).slice(0, BRIDGE_MAX_SECTIONS)) {
    names[section.id] = name(section, footer.has(section.id)).slice(0, 120)
  }
  return names
}

/**
 * Picking in the preview (adr/0065 §6, Faz 2; owner's decision 1): the
 * section pointed at in the frame lights its tree row, a row pointed at
 * frames its section, the edit label opens the form (said aloud), the
 * frame learns each section's name, and a link followed in the frame
 * shows that page with the draft (or says why not). What the frame says
 * is its word only: an id is acted on only when the document has it, a
 * path is printed as text.
 */
export function usePreviewPicking({ doc, connected, post, onOpen, onVisit, onLand }: Options) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState<string | null>(null)
  const [announce, setAnnounce] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<string | null>(null)

  const names = useMemo(
    () => sectionNames(doc, (section, inFooter) => sectionLabel(t, section, inFooter).name),
    [doc, t]
  )
  const labelKey = JSON.stringify(names)
  useEffect(() => {
    if (connected) {
      post("labels", { edit: t(`${V}.edit`), names })
    }
    // Sent again only when a name changes, not on every keystroke elsewhere
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, labelKey, t, post])

  const hover = useCallback(
    (id: string | null) => {
      post("hover", { id })
    },
    [post]
  )

  const onPick = (message: PickMessage) => {
    switch (message.type) {
      case "hover": {
        const { id } = message.payload
        setHovered(id && findSection(doc, id) ? id : null)
        return
      }
      case "click": {
        const found = findSection(doc, message.payload.id)
        if (found) {
          setBlocked(null)
          onOpen(found.section.id)
          setAnnounce(t(`${V}.selected`, { name: names[found.section.id] ?? "" }))
        }
        return
      }
      case "navigate-request":
        if (message.payload.previewable) {
          setBlocked(null)
          onVisit(message.payload.path)
        } else {
          setBlocked(message.payload.path)
        }
        return
      case "location":
        onLand(message.payload.path, groupOf(doc, message.payload.sections))
        return
      case "left":
        if (message.payload.path) {
          onVisit(message.payload.path)
        }
        return
    }
  }

  return {
    /** The tree's side of hovering (`SectionHoverContext`). */
    hover: { hovered, hover },
    onPick,
    /** Said by a live region: the section opened from the frame. */
    announce,
    /** A page the preview will not open, said beside it; null: none. */
    blocked: blocked ? t(`${V}.blocked`, { path: blocked }) : null,
    clearBlocked: () => {
      setBlocked(null)
    },
  }
}
