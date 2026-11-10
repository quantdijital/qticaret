import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { isThreshold } from "@/features/inventory/drafts"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { InventorySettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"

/**
 * The shop's low-stock line (F3.8, adr/0020): an item at or under it is
 * low, and dropping to it sends the bell an alert. An item may set its own
 * on the stock page.
 */
export function LowStockCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const section = useQuery(sectionQuery<InventorySettings>("inventory"))
  const save = useSaveSection<InventorySettings>("inventory")
  const stored = section.data?.values.low_stock_threshold
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? (stored === undefined ? "" : String(stored))
  const valid = isThreshold(text)
  return (
    <SectionCard
      title={t("settings.locations.lowStock.title")}
      description={t("settings.locations.lowStock.hint")}
      className={className}
    >
      {section.data ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate(
              { low_stock_threshold: Number(text) },
              {
                onSuccess: () => {
                  setDraft(null)
                  toast.success(t("settings.locations.lowStock.saved"))
                  void client.invalidateQueries({ queryKey: ["inventory"] })
                  void client.invalidateQueries({ queryKey: ["dashboard"] })
                },
                onError: (failure) => toast.error(errorText(t, failure)),
              }
            )
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="low-stock-threshold" className="text-sm font-medium">
              {t("settings.locations.lowStock.label")}
            </label>
            <NumberField
              min={0}
              max={100_000}
              id="low-stock-threshold"
              className="w-40"
              value={text}
              aria-invalid={!valid || undefined}
              onChange={(event) => {
                setDraft(event.target.value.trim())
              }}
            />
          </div>
          <Button type="submit" disabled={!valid || draft === null || save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {t("common.save")}
          </Button>
        </form>
      ) : (
        <Skeleton className="h-16" />
      )}
    </SectionCard>
  )
}
