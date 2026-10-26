import { ChartColumn, LayoutGrid, Package, ShoppingBag, Users } from "lucide-react"
import { useTranslation } from "react-i18next"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ResolvedMode } from "@/theme"

const ROWS = [
  { id: "1042", total: "1250.80", status: "paid" },
  { id: "1041", total: "349.90", status: "shipped" },
  { id: "1040", total: "2180.00", status: "awaitingPayment" },
] as const

// The panel's own badges, as an order list shows them
const STATUS_TONE = {
  paid: "success",
  shipped: "info",
  awaitingPayment: "warning",
} as const satisfies Record<(typeof ROWS)[number]["status"], string>

const MENU = [
  { key: "dashboard", icon: LayoutGrid },
  { key: "orders", icon: ShoppingBag },
  { key: "products", icon: Package },
  { key: "customers", icon: Users },
  { key: "reports", icon: ChartColumn },
] as const

/** The menu in miniature: its ground, its text and the page it marks (the menu choice). */
function MiniMenu() {
  const { t } = useTranslation()
  return (
    <div className="hidden w-44 shrink-0 flex-col gap-1 bg-sidebar p-3 text-sidebar-foreground sm:flex">
      <span className="mb-2 flex items-center gap-2 px-2 text-[13px] font-semibold">
        <span className="size-5 rounded-md bg-sidebar-primary" aria-hidden="true" />
        {t("app.name")}
      </span>
      {MENU.map(({ key, icon: Icon }, index) => (
        <span
          key={key}
          className={cn(
            "flex h-8 items-center gap-2 rounded-md px-2 text-[13px]",
            index === 1
              ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
              : "text-sidebar-muted-foreground"
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {t(`nav.${key}`)}
        </span>
      ))}
    </div>
  )
}

/** The panel in miniature: the menu, then buttons, a field and an order list as the choices paint them. */
export function ThemePreview({ mode }: { mode: ResolvedMode }) {
  const { t } = useTranslation()
  return (
    <div
      className="flex flex-1 overflow-hidden rounded-lg border bg-background"
      data-mode={mode}
      // A picture of the panel: the card's title names it, its controls do nothing
      aria-hidden="true"
    >
      <MiniMenu />
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-base font-semibold">{t("nav.orders")}</span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" tabIndex={-1}>
              {t("common.cancel")}
            </Button>
            <Button type="button" size="sm" tabIndex={-1}>
              {t("common.save")}
            </Button>
          </div>
        </div>
        <Input
          readOnly
          tabIndex={-1}
          value={t("settings.appearance.previewValue")}
          aria-label={t("settings.appearance.previewField")}
          className="max-w-sm"
        />
        <div className="overflow-hidden rounded-md border bg-card">
          <table className="w-full text-sm">
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.id} className="h-[var(--row-height)] border-t first:border-t-0">
                  <td className="px-4 font-medium tabular-nums">#{row.id}</td>
                  <td className="hidden sm:table-cell">
                    <StatusBadge tone={STATUS_TONE[row.status]}>
                      {t(`status.${row.status}`)}
                    </StatusBadge>
                  </td>
                  <td className="px-4 text-right whitespace-nowrap tabular-nums">
                    {formatMoney(row.total, "try")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
