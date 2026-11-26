import { EllipsisVertical } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { Button } from "../ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../ui/dropdown-menu"

/**
 * A page header's "…" menu (docs/18 §7; the owner 2026-11-26: a row of side
 * by side buttons was cramped): the primary action and at most one
 * secondary stay as buttons, the rest are items here (`DropdownMenuItem`,
 * a link one with `asChild`). Its label names it for screen readers and
 * on hover.
 */
export function HeaderMenu({
  children,
  label,
  size = "default",
}: {
  children: ReactNode
  /** What the button is called; "Diğer işlemler" by default. */
  label?: string
  /** As tall as the buttons beside it ("sm" beside small ones). */
  size?: "default" | "sm"
}) {
  const { t } = useTranslation(ADMIN_UI_NS)
  const name = label ?? t("headerMenu.more")
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size === "sm" ? "icon-sm" : "icon"}
          aria-label={name}
          title={name}
        >
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
