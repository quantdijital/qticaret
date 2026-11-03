import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useStaff } from "@/features/auth/api/staff"
import type { PaymentLinkSettings } from "@/features/payment-links/api/types"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"
import { parseCountInput } from "@/lib/money-input"

const C = "settings.payments.paymentLinks"

/**
 * Settings > Payment > Ödeme bağlantıları (adr/0051): how far an admin may
 * discount a link, and whether a link's order may be paid at the door.
 * The owner's to change (an admin would otherwise raise their own limit);
 * the others see them.
 */
export function PaymentLinkSettingsCard() {
  const { t } = useTranslation()
  const owner = useStaff()?.role === "owner"
  const section = useQuery(sectionQuery<PaymentLinkSettings>("payment_links"))
  const save = useSaveSection<PaymentLinkSettings>("payment_links")
  const [limit, setLimit] = useState<string | null>(null)
  const [cod, setCod] = useState<boolean | null>(null)
  const values = section.data?.values
  const limitText = limit ?? (values ? String(values.admin_max_discount_percent) : "")
  const limitValue = parseCountInput(limitText)
  const valid = limitValue !== null && limitValue <= 99
  const changed = limit !== null || cod !== null
  return (
    <SectionCard title={t(`${C}.title`)} description={t(`${C}.description`)}>
      {section.isError ? (
        <ErrorState text={errorText(t, section.error)} onRetry={() => void section.refetch()} />
      ) : !values ? (
        <Skeleton className="h-32" />
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!valid) {
              return
            }
            save.mutate(
              {
                ...(limit !== null ? { admin_max_discount_percent: limitValue } : {}),
                ...(cod !== null ? { allow_cod: cod } : {}),
              },
              {
                onSuccess: () => {
                  setLimit(null)
                  setCod(null)
                  toast.success(t(`${C}.saved`))
                },
                onError: (failure) => toast.error(errorText(t, failure)),
              }
            )
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="link-admin-limit" className="text-sm font-medium">
              {t(`${C}.limit`)}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">%</span>
              <Input
                id="link-admin-limit"
                inputMode="numeric"
                className="w-24 tabular-nums"
                value={limitText}
                disabled={!owner}
                aria-invalid={!valid || undefined}
                aria-describedby="link-admin-limit-hint"
                onChange={(event) => {
                  setLimit(event.target.value.trim())
                }}
              />
            </div>
            <p
              id="link-admin-limit-hint"
              className={valid ? "text-xs text-muted-foreground" : "text-xs text-destructive-text"}
            >
              {t(valid ? `${C}.limitHint` : `${C}.limitInvalid`)}
            </p>
          </div>
          <div className="flex items-start justify-between gap-4 border-t pt-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <label htmlFor="link-allow-cod" className="text-sm font-medium">
                {t(`${C}.cod`)}
              </label>
              <span id="link-allow-cod-hint" className="text-[13px] text-muted-foreground">
                {t(`${C}.codHint`)}
              </span>
            </div>
            <Switch
              id="link-allow-cod"
              aria-describedby="link-allow-cod-hint"
              checked={cod ?? values.allow_cod}
              disabled={!owner}
              onCheckedChange={setCod}
            />
          </div>
          {owner ? (
            <div className="flex justify-end">
              <Button type="submit" disabled={!changed || !valid || save.isPending}>
                {save.isPending ? <Loader2 className="animate-spin" /> : null}
                {t("common.save")}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t(`${C}.ownerOnly`)}</p>
          )}
        </form>
      )}
    </SectionCard>
  )
}
