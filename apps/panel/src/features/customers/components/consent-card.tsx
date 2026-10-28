import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { customerConsentsQuery, saveCustomerConsent } from "@/features/customers/api/customers"
import type { ConsentChannel, ConsentState } from "@/features/customers/api/customers"
import { errorText } from "@/lib/errors"
import { formatDate } from "@/lib/format"

const C = "customers.consents"
const CHANNELS: readonly ConsentChannel[] = ["email", "sms"]

/** What the row says under the channel: the answer, where it came from and when. */
function stateText(t: TFunction, state: ConsentState): string {
  if (!state.address) {
    return t(`${C}.noAddress`)
  }
  if (!state.consent) {
    return t(`${C}.none`)
  }
  return t(`${C}.${state.consent.status}`, {
    source: t(`${C}.sources.${state.consent.source}`),
    date: formatDate(state.consent.changed_at),
  })
}

/**
 * Whether the customer takes campaign e-mail and SMS (F9.5, adr/0036).
 * Staff record what the customer said outside the storefront; each change
 * is kept with who made it, and campaigns go only where it is granted.
 */
export function ConsentCard({ customerId }: { customerId: string }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const query = useQuery(customerConsentsQuery(customerId))
  const save = useMutation({
    mutationFn: (body: { channel: ConsentChannel; status: "granted" | "revoked" }) =>
      saveCustomerConsent(customerId, body),
    onSuccess: (consents) => {
      client.setQueryData(customerConsentsQuery(customerId).queryKey, consents)
      toast.success(t(`${C}.saved`))
    },
    onError: (failure) => {
      toast.error(errorText(t, failure))
    },
  })
  return (
    <SectionCard title={t(`${C}.title`)} description={t(`${C}.description`)}>
      {!query.data ? (
        <Skeleton className="h-16" />
      ) : (
        <ul className="flex flex-col gap-4">
          {CHANNELS.map((channel) => {
            const state = query.data[channel]
            const id = `consent-${channel}`
            return (
              <li key={channel} className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <label htmlFor={id} className="text-sm font-medium">
                    {t(`${C}.channels.${channel}`)}
                  </label>
                  <span id={`${id}-state`} className="text-[13px] text-muted-foreground">
                    {stateText(t, state)}
                  </span>
                </div>
                <Switch
                  id={id}
                  aria-describedby={`${id}-state`}
                  checked={state.consent?.status === "granted"}
                  disabled={!state.address || save.isPending}
                  onCheckedChange={(checked) => {
                    save.mutate({ channel, status: checked ? "granted" : "revoked" })
                  }}
                />
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}
