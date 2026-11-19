import { FileText, Mail } from "lucide-react"
import type { Dispatch } from "react"
import { useTranslation } from "react-i18next"
import { PAGE_LAYOUT_LIMITS } from "@qticaret/types"
import type { BodySection, LayoutDocument, Placement } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import {
  pageSectionsFull,
  pageSectionsOf,
  pagesFull,
} from "@/features/storefront/layout/page-layouts"
import { placed } from "@/features/storefront/layout/sections"
import { AddButton } from "./page-sections"
import { SectionList } from "./section-list"
import { ThemeRow } from "./tree-rows"

const C = "storefront.editor.contentPage"

interface ContentPageSectionsProps {
  doc: LayoutDocument
  /** The content page picked; null: none yet (none in İçerik). */
  pageId: string | null
  /** The contact page (`contact_page_id`): its text stands with the form. */
  contact: boolean
  problems: ReadonlySet<string>
  dispatch: Dispatch<EditorAction>
  onOpen: (id: string) => void
  onRemove: (section: BodySection) => void
  onAdd: (placement: Placement) => void
  /** Opens the fixed row's panel: what the page's own text is and where it is written. */
  onOpenText: () => void
}

/**
 * A content page's own layout (adr/0073 §5), as a category page's: the
 * sections above the page's text, the text itself as a fixed row (never
 * moved nor removed: it is İçerik's, the contact page's with its form),
 * and the sections below it. The first section added makes the page's
 * layout and the last one removed takes it away; a page without one adds
 * none while twenty pages have theirs.
 */
export function ContentPageSections({
  doc,
  pageId,
  contact,
  problems,
  dispatch,
  onOpen,
  onRemove,
  onAdd,
  onOpenText,
}: ContentPageSectionsProps) {
  const { t } = useTranslation()
  if (pageId === null) {
    return <p className="px-2 py-1 text-xs text-muted-foreground">{t(`${C}.pick`)}</p>
  }
  const sections = pageSectionsOf(doc, pageId)
  const fullHere = pageSectionsFull(doc, pageId)
  const noRoom = pagesFull(doc, pageId)
  const note = noRoom
    ? t(`${C}.pagesFull`, { max: PAGE_LAYOUT_LIMITS.pages })
    : fullHere
      ? t(`${C}.sectionsFull`, { max: PAGE_LAYOUT_LIMITS.sections })
      : null
  const side = (placement: Placement) => {
    const items = placed(sections, placement)
    const label = t(`${C}.sides.${placement}`)
    return (
      <div className="flex flex-col gap-1">
        <h3 className="px-2 text-xs font-medium text-muted-foreground">{label}</h3>
        {items.length === 0 ? null : (
          <SectionList
            label={label}
            sections={items}
            full={fullHere}
            placement={placement}
            placeLabel={(to) => t(`${C}.place.${to}`)}
            problems={problems}
            dispatch={dispatch}
            onOpen={onOpen}
            onRemove={onRemove}
          />
        )}
        <AddButton
          label={t(`storefront.editor.tree.addTo.${placement}`)}
          disabled={note !== null}
          onClick={() => {
            onAdd(placement)
          }}
        />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {side("top")}
      <div className="rounded-md border border-dashed">
        <ThemeRow
          icon={contact ? Mail : FileText}
          label={t(`${C}.text.${contact ? "contact" : "page"}`)}
          onClick={onOpenText}
        />
      </div>
      {side("bottom")}
      {note ? <p className="px-2 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  )
}
