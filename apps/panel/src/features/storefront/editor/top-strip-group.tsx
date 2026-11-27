import { Eye, EyeOff, Link2, PanelTop } from "lucide-react"
import type { Dispatch, ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { cn } from "@qticaret/admin-ui/lib/utils"
import type { AnySection, LayoutDocument } from "@/features/storefront/api/layout"
import { MARQUEE_LIMITS } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import { mainOf } from "@/features/storefront/layout/main-sections"
import { anyPageMarqueesFull } from "@/features/storefront/layout/page-layouts"
import { AddRow, ElsewhereRow, ThemeRow, TreeGroup } from "./tree-rows"

const T = "storefront.editor.tree"
const S = "storefront.editor.topStrip"

/**
 * The top strip in the tree (owner 2026-11-27): everything drawn above the
 * header's own row, apart from it. The announcement bar and the header's
 * scrolling strip are its sections (the stored `header` group, shown and
 * hidden by their own eyes); the top links and the phone sit on the bar
 * from 1024 px whether it has lines or not, and the catalog header keeps a
 * thin strip of its own. The heading's eye turns all of it off at once
 * (`header_bar.top_strip`): nothing drawn on any width, nothing falling
 * back to the bar when the catalog's strip is off. On again, the key goes,
 * so the bar reads and stores as it did before the switch.
 */
export function TopStripGroup({
  doc,
  dispatch,
  row,
  onAdd,
  onOpenHeader,
}: {
  doc: LayoutDocument
  dispatch: Dispatch<EditorAction>
  /** A section's row, as the tree draws it. */
  row: (section: AnySection) => ReactNode
  onAdd: (which: "announcement" | "marquee") => void
  onOpenHeader: (id: string) => void
}) {
  const { t } = useTranslation()
  // The header draws its bar first, its strip under it (adr/0049 Ek 2026-11-14 §4.1)
  const bar = doc.header.find((section) => section.type === "announcement_bar")
  const strip = doc.header.find((section) => section.type === "marquee")
  // A strip in the header shows on every page: not while a page already has its two
  const stripFull = anyPageMarqueesFull(doc)
  const header = mainOf(doc, "header_bar")
  const on = header?.top_strip !== false
  const toggle = header ? (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-pressed={!on}
      aria-label={t(on ? `${S}.hide` : `${S}.show`)}
      className={cn(!on && "text-muted-foreground")}
      onClick={() => {
        if (on) {
          dispatch({ type: "update", section: { ...header, top_strip: false } })
        } else {
          const back = { ...header }
          delete back.top_strip
          dispatch({ type: "update", section: back })
        }
      }}
    >
      {on ? <Eye /> : <EyeOff />}
    </Button>
  ) : null
  return (
    <TreeGroup title={t(`${S}.title`)} action={toggle}>
      {on ? null : <p className="px-2 text-xs text-muted-foreground">{t(`${S}.off`)}</p>}
      <ul className={cn("flex flex-col gap-0.5", !on && "opacity-60")}>
        {bar ? (
          row(bar)
        ) : (
          <AddRow
            label={t(`${T}.addAnnouncement`)}
            onClick={() => {
              onAdd("announcement")
            }}
          />
        )}
        {strip ? (
          row(strip)
        ) : (
          <AddRow
            label={t(`${T}.addMarquee`)}
            full={
              stripFull
                ? t("storefront.editor.marquee.full", { max: MARQUEE_LIMITS.perPage })
                : null
            }
            onClick={() => {
              onAdd("marquee")
            }}
          />
        )}
        {header?.variant === "catalog" ? (
          // The catalog header's own thin strip: its switch and note are in the header's panel
          <li>
            <ThemeRow
              icon={PanelTop}
              label={t(`${S}.catalog`)}
              onClick={() => {
                onOpenHeader(header.id)
              }}
            />
          </li>
        ) : header?.variant !== "inline" ? (
          <ElsewhereRow
            icon={Link2}
            name={t(`${S}.links`)}
            links={[
              { to: "/storefront/menus", label: t(`${T}.menus`) },
              { to: "/settings/store", label: t(`${T}.storeProfile`) },
            ]}
          />
        ) : null}
      </ul>
    </TreeGroup>
  )
}
