import { Settings2 } from "lucide-react"
import type { Dispatch } from "react"
import { useTranslation } from "react-i18next"
import { PAGE_LAYOUT_LIMITS, isPageOnlyType } from "@qticaret/types"
import type { BodySection, LayoutDocument } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import {
  pageSectionsFull,
  pageSectionsOf,
  pagesFull,
} from "@/features/storefront/layout/page-layouts"
import { AddButton } from "./page-sections"
import { SectionList } from "./section-list"
import { ThemeRow } from "./tree-rows"

const C = "storefront.editor.contentPage"

interface ContentPageSectionsProps {
  /** The draft as the editor shows it: a page with no entry, its text made into sections. */
  doc: LayoutDocument
  /** The content page picked; null: none yet. */
  pageId: string | null
  /** The page's sections are its text made into them (K1): the first change makes its entry. */
  synthesized: boolean
  /** The design has no room for the page's entry: its text is only shown. */
  shownOnly: boolean
  problems: ReadonlySet<string>
  dispatch: Dispatch<EditorAction>
  onOpen: (id: string) => void
  onRemove: (section: BodySection) => void
  onAdd: () => void
  /** Opens the page's own settings: its title, address, search look, cover, status. */
  onSettings: () => void
}

/**
 * A content page in the theme editor (adr/0073 Ek 2026-11-19 (2) K5): its
 * settings first, then its sections as one list, its text among them, as
 * the home page's; a section added below. The first section added makes
 * the page's layout and the last one removed takes it away; a page
 * without one takes none while fifty pages have theirs.
 */
export function ContentPageSections({
  doc,
  pageId,
  synthesized,
  shownOnly,
  problems,
  dispatch,
  onOpen,
  onRemove,
  onAdd,
  onSettings,
}: ContentPageSectionsProps) {
  const { t } = useTranslation()
  if (pageId === null) {
    return <p className="px-2 py-1 text-xs text-muted-foreground">{t(`${C}.pick`)}</p>
  }
  const sections = pageSectionsOf(doc, pageId)
  const fullHere = pageSectionsFull(doc, pageId)
  const noRoom = shownOnly || (!synthesized && pagesFull(doc, pageId))
  const note = shownOnly
    ? t(`${C}.shownOnly`)
    : noRoom
      ? t(`${C}.pagesFull`, { max: PAGE_LAYOUT_LIMITS.pages })
      : fullHere
        ? t(`${C}.sectionsFull`, { max: PAGE_LAYOUT_LIMITS.sections })
        : null
  const label = t(`${C}.sections`)
  return (
    <div className="flex flex-col gap-1">
      <div className="mb-1 rounded-md border border-dashed">
        <ThemeRow icon={Settings2} label={t(`${C}.settings.open`)} onClick={onSettings} />
      </div>
      {sections.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">{t(`${C}.noSections`)}</p>
      ) : (
        <SectionList
          label={label}
          sections={sections}
          full={fullHere || noRoom}
          copies={(section) => !isPageOnlyType(section.type)}
          problems={problems}
          dispatch={dispatch}
          onOpen={onOpen}
          onRemove={onRemove}
        />
      )}
      <AddButton label={t("storefront.editor.tree.add")} disabled={note !== null} onClick={onAdd} />
      {note ? <p className="px-2 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  )
}
