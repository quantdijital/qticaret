import { useState } from "react"
import type { LayoutLink } from "@/features/storefront/api/layout"
import type { LinkTarget } from "@/features/storefront/api/menus"
import { LinkPickerDialog } from "@/features/storefront/components/link-picker-dialog"
import type { LinkPick } from "@/features/storefront/components/link-picker-panes"
import type { MenuRow } from "@/features/storefront/menu-rows"

/** A link as the menus' picker reads it: what it points at and its wording. */
const rowOf = (link: LayoutLink): MenuRow => ({
  key: "layout-link",
  depth: 0,
  to:
    link.kind === "url"
      ? { kind: "url", url: link.url }
      : ({ kind: link.kind, target: link.target } as LinkTarget),
  label: link.label ?? "",
  name: null,
  path: null,
  broken: false,
})

/** The picked target as the document keeps it; a record keeps the shop's own wording. */
function linkOf(pick: LinkPick, was: LayoutLink | null): LayoutLink {
  if (pick.to.kind === "url") {
    return { kind: "url", url: pick.to.url, label: pick.label ?? "" }
  }
  const label = was && was.kind !== "url" ? was.label : null
  return { kind: pick.to.kind, target: pick.to.target, label }
}

/** Opens the menus' link picker; `onPick` gets the new link. */
export function useLinkPicker(onPick: (link: LayoutLink, was: LayoutLink | null) => void) {
  const [editing, setEditing] = useState<{ link: LayoutLink | null } | null>(null)
  return {
    open: (link: LayoutLink | null) => {
      setEditing({ link })
    },
    dialog: editing ? (
      <LinkPickerDialog
        row={editing.link ? rowOf(editing.link) : null}
        onClose={() => {
          setEditing(null)
        }}
        onPick={(pick) => {
          onPick(linkOf(pick, editing.link), editing.link)
          setEditing(null)
        }}
      />
    ) : null,
  }
}
