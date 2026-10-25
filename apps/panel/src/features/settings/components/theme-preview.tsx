import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatMoney } from "@/lib/format"
import type { ResolvedMode } from "@/theme"

const ROWS = [
  { id: "1042", total: "1250.80", status: "paid" },
  { id: "1041", total: "349.90", status: "shipped" },
  { id: "1040", total: "2180.00", status: "awaitingPayment" },
] as const

const STATUS_CLASS: Record<(typeof ROWS)[number]["status"], string> = {
  paid: "bg-success/15 text-success",
  shipped: "bg-info/15 text-info",
  awaitingPayment: "bg-warning/15 text-warning",
}

/** What the choices do to real controls: buttons, a field and an order list. */
export function ThemePreview({ mode }: { mode: ResolvedMode }) {
  const { t } = useTranslation()
  return (
    <aside className="flex flex-col gap-3" aria-label={t("settings.appearance.preview")}>
      <div>
        <span className="text-sm font-medium">{t("settings.appearance.preview")}</span>
        <p className="text-xs text-muted-foreground">{t("settings.appearance.previewHint")}</p>
      </div>
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4" data-mode={mode}>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm">
            {t("common.save")}
          </Button>
          <Button type="button" size="sm" variant="outline">
            {t("common.cancel")}
          </Button>
          <Button type="button" size="sm" variant="destructive">
            {t("status.canceled")}
          </Button>
        </div>
        <Input
          readOnly
          value={t("settings.appearance.previewValue")}
          aria-label={t("settings.appearance.previewField")}
        />
        <table className="w-full text-sm">
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.id} className="h-[var(--row-height)] border-t">
                <td className="tabular font-medium">#{row.id}</td>
                <td>
                  <Badge variant="secondary" className={STATUS_CLASS[row.status]}>
                    {t(`status.${row.status}`)}
                  </Badge>
                </td>
                <td className="tabular text-right">{formatMoney(row.total, "try")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </aside>
  )
}
