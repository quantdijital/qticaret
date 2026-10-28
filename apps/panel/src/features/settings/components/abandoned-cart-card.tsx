import { useQuery } from "@tanstack/react-query"
import { Loader2, MailCheck, ShoppingBag, ShoppingCart } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { KpiTile } from "@/components/patterns/kpi-tile"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { cartReminderSummaryQuery } from "@/features/settings/api/cart-reminders"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { MarketingSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { formatCount } from "@/lib/format"

const C = "settings.marketing.abandonedCart"
const DELAYS = [30, 60, 180, 360, 1440] as const

/**
 * Settings > Marketing: the reminder a shopper gets once for a cart left
 * behind (F10.7, adr/0038 §1). It is a commercial message: only addresses
 * with e-mail consent get it. Below, what the last 30 days' reminders did.
 */
export function AbandonedCartCard() {
  const { t } = useTranslation()
  const section = useQuery(sectionQuery<MarketingSettings>("marketing"))
  const summary = useQuery(cartReminderSummaryQuery())
  const save = useSaveSection<MarketingSettings>("marketing")
  const [draft, setDraft] = useState<Partial<MarketingSettings>>({})
  const stored = section.data?.values
  const values = stored ? { ...stored, ...draft } : null
  const counts = summary.data?.summary
  return (
    <SectionCard title={t(`${C}.title`)} description={t(`${C}.description`)}>
      {!values ? (
        <Skeleton className="h-32" />
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate(draft, {
              onSuccess: () => {
                setDraft({})
                toast.success(t(`${C}.saved`))
              },
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <label htmlFor="abandoned-cart-enabled" className="text-sm font-medium">
                {t(`${C}.enabled`)}
              </label>
              <span id="abandoned-cart-enabled-hint" className="text-[13px] text-muted-foreground">
                {t(`${C}.enabledHint`)}
              </span>
            </div>
            <Switch
              id="abandoned-cart-enabled"
              aria-describedby="abandoned-cart-enabled-hint"
              checked={values.abandoned_cart_enabled}
              onCheckedChange={(checked) => {
                setDraft((current) => ({ ...current, abandoned_cart_enabled: checked }))
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span id="abandoned-cart-delay-label" className="text-sm font-medium">
              {t(`${C}.delay`)}
            </span>
            <Select
              value={String(values.abandoned_cart_delay_minutes)}
              disabled={!values.abandoned_cart_enabled}
              onValueChange={(next) => {
                setDraft((current) => ({ ...current, abandoned_cart_delay_minutes: Number(next) }))
              }}
            >
              <SelectTrigger className="w-64" aria-labelledby="abandoned-cart-delay-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DELAYS.map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {minutes < 60
                      ? t(`${C}.minutes`, { count: minutes })
                      : t(`${C}.hours`, { count: minutes / 60 })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={Object.keys(draft).length === 0 || save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" /> : null}
              {t("common.save")}
            </Button>
          </div>
        </form>
      )}
      <section aria-label={t(`${C}.stats.title`)} className="mt-5 border-t pt-4">
        <h3 className="text-sm font-medium">{t(`${C}.stats.title`)}</h3>
        {counts ? (
          <div className="grid grid-cols-3 gap-3">
            <KpiTile
              icon={MailCheck}
              label={t(`${C}.stats.sent`)}
              value={formatCount(counts.sent)}
              className="px-0"
            />
            <KpiTile
              icon={ShoppingCart}
              label={t(`${C}.stats.returned`)}
              value={formatCount(counts.returned)}
              className="px-0"
            />
            <KpiTile
              icon={ShoppingBag}
              label={t(`${C}.stats.ordered`)}
              value={formatCount(counts.ordered)}
              className="px-0"
            />
          </div>
        ) : (
          <Skeleton className="mt-3 h-20" />
        )}
      </section>
    </SectionCard>
  )
}
