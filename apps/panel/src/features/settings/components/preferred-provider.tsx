import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { sectionQuery, useSaveSection } from "@/features/settings/api/sections"
import type { PaymentSettings } from "@/features/settings/api/sections"
import { errorText } from "@/lib/errors"

const P = "settings.payments"

/**
 * With two card providers connected, which one the storefront offers first
 * and whose installment table it shows (F5 V10). A row of the card
 * providers' list; nothing to choose with one.
 */
export function PreferredProviderRow({ connected }: { connected: ("paytr" | "iyzico")[] }) {
  const { t } = useTranslation()
  const section = useQuery(sectionQuery<PaymentSettings>("payments"))
  const save = useSaveSection<PaymentSettings>("payments")
  const values = section.data?.values
  if (connected.length < 2 || !values) {
    return null
  }
  // Unset or no longer connected: the backend uses the first connected
  const current =
    connected.find((provider) => provider === values.card_provider) ?? connected[0] ?? "paytr"
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t px-5 py-4">
      <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-0.5">
        <span id="preferred-provider-label" className="text-sm font-medium">
          {t(`${P}.preferred.title`)}
        </span>
        <span className="text-[13px] text-muted-foreground">{t(`${P}.preferred.hint`)}</span>
      </div>
      <Select
        value={current}
        disabled={save.isPending}
        onValueChange={(next) => {
          save.mutate(
            { card_provider: next as PaymentSettings["card_provider"] },
            {
              onSuccess: () => toast.success(t("settings.saved")),
              onError: (failure) => toast.error(errorText(t, failure)),
            }
          )
        }}
      >
        <SelectTrigger className="w-64" aria-labelledby="preferred-provider-label">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {connected.map((provider) => (
            <SelectItem key={provider} value={provider}>
              {t(`${P}.methods.${provider}.name`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </li>
  )
}
