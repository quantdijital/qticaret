import { Eye, EyeOff } from "lucide-react"
import type { Dispatch, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { AnySection, LayoutDocument } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import { anyPageMarqueesFull } from "@/features/storefront/layout/page-layouts"
import { AddRow, TreeGroup } from "./tree-rows"

const S = "storefront.editor.topStrip"

/**
 * The top strip in the tree (owner's decision 2026-11-27, adr/0066 Ek): its
 * own sections above the header, never the header's. The strip in one of
 * its designs (`announcement_bar`, dark bar or light strip) and the
 * scrolling strip, each opened, hidden and removed on its own row; the
 * heading's eye hides or shows both at once. No strip section: nothing is
 * drawn above the header, whatever the header's variant.
 */
export function TopStripGroup({
  doc,
  dispatch,
  row,
  onAdd,
}: {
  doc: LayoutDocument
  dispatch: Dispatch<EditorAction>
  /** A section's row, as the tree draws it. */
  row: (section: AnySection) => ReactNode
  /** Opens the group's chooser: a strip in one of its looks, or the scrolling strip. */
  onAdd: () => void
}) {
  const { t } = useTranslation()
  // The header draws its bar first, its strip under it (adr/0049 Ek 2026-11-14 §4.1)
  const bar = doc.header.find((section) => section.type === "announcement_bar")
  const strip = doc.header.find((section) => section.type === "marquee")
  // A strip in the header shows on every page: not while a page already has its two
  const stripFull = anyPageMarqueesFull(doc)
  const parts = [bar, strip].filter((section) => section !== undefined)
  const on = parts.some((section) => section.visible)
  // Each part switched to the heading's state: one step each, as its own eye would
  const toggle =
    parts.length > 0 ? (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-pressed={!on}
        aria-label={t(on ? `${S}.hide` : `${S}.show`)}
        className={cn(!on && "text-muted-foreground")}
        onClick={() => {
          for (const section of parts) {
            if (section.visible === on) {
              dispatch({ type: "toggle", id: section.id })
            }
          }
        }}
      >
        {on ? <Eye /> : <EyeOff />}
      </Button>
    ) : null
  return (
    <TreeGroup title={t(`${S}.title`)} action={toggle}>
      {parts.length > 0 && !on ? (
        <p className="px-2 text-xs text-muted-foreground">{t(`${S}.off`)}</p>
      ) : null}
      <ul className="flex flex-col gap-0.5">
        {parts.map((section) => row(section))}
        <AddRow
          label={t(`${S}.add`)}
          full={bar && (strip || stripFull) ? t(`${S}.full`) : null}
          onClick={onAdd}
        />
      </ul>
    </TreeGroup>
  )
}
