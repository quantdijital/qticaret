import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { PaymentSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"

const I = "settings.payments.installments"
// 0: what the provider allows the shop's account
const LIMITS = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

/**
 * Installments for card payments (F5 V6): whether they are offered, and
 * how many at most. Every card provider follows it; the surcharge is the
 * provider's. Each change is saved at once.
 */
export function InstallmentsCard() {
  const { t } = useTranslation()
  const section = useQuery(sectionQuery<PaymentSettings>("payments"))
  const save = useSaveSection<PaymentSettings>("payments")
  const values = section.data?.values
  const change = (patch: Partial<PaymentSettings>) => {
    save.mutate(patch, {
      onSuccess: () => toast.success(t("settings.saved")),
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  return (
    <SectionCard title={t(`${I}.title`)} description={t(`${I}.description`)} flush>
      {values ? (
        <ul className="flex flex-col">
          <li className="flex items-center justify-between gap-4 border-t px-5 py-4">
            <label htmlFor="installments-enabled" className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">{t(`${I}.enabled`)}</span>
              <span className="text-[13px] text-muted-foreground">{t(`${I}.enabledHint`)}</span>
            </label>
            <Switch
              id="installments-enabled"
              checked={values.installments_enabled}
              disabled={save.isPending}
              onCheckedChange={(enabled) => {
                change({ installments_enabled: enabled })
              }}
            />
          </li>
          <li className="flex flex-wrap items-center justify-between gap-4 border-t px-5 py-4">
            <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-0.5">
              <span id="installments-max-label" className="text-sm font-medium">
                {t(`${I}.max`)}
              </span>
              <span className="text-[13px] text-muted-foreground">{t(`${I}.maxHint`)}</span>
            </div>
            <Select
              value={String(values.max_installment)}
              disabled={!values.installments_enabled || save.isPending}
              onValueChange={(next) => {
                change({ max_installment: Number(next) })
              }}
            >
              <SelectTrigger className="w-64" aria-labelledby="installments-max-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIMITS.map((limit) => (
                  <SelectItem key={limit} value={String(limit)}>
                    {limit === 0 ? t(`${I}.providerMax`) : t(`${I}.count`, { count: limit })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </li>
        </ul>
      ) : (
        <Skeleton className="m-5 h-24" />
      )}
    </SectionCard>
  )
}
