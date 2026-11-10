import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qticaret/admin-ui/ui/dialog"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { Textarea } from "@qticaret/admin-ui/ui/textarea"
import { customerConsentsQuery, saveCustomerConsent } from "@/features/customers/api/customers"
import type { ConsentChannel, ConsentState } from "@/features/customers/api/customers"
import { errorText } from "@/lib/errors"
import { formatDate } from "@qticaret/admin-ui/lib/format"

const C = "customers.consents"
const CHANNELS: readonly ConsentChannel[] = ["email", "sms"]
/** The shortest proof the server takes: a word or two says nothing. */
const MIN_EVIDENCE = 10

/** Asks how the customer gave the consent before it is recorded. */
function EvidenceDialog({
  channel,
  pending,
  onGrant,
  onClose,
}: {
  channel: ConsentChannel | null
  pending: boolean
  onGrant: (evidence: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [evidence, setEvidence] = useState("")
  const [error, setError] = useState<string | undefined>()
  return (
    <Dialog
      open={channel !== null}
      onOpenChange={(open) => {
        if (!open) {
          setEvidence("")
          setError(undefined)
          onClose()
        }
      }}
    >
      <DialogContent>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            if (evidence.trim().length < MIN_EVIDENCE) {
              setError(t(`${C}.evidenceShort`))
              return
            }
            onGrant(evidence.trim())
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t(`${C}.evidenceTitle`, { channel: channel ? t(`${C}.channels.${channel}`) : "" })}
            </DialogTitle>
            <DialogDescription>{t(`${C}.evidenceDescription`)}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field label={t(`${C}.evidence`)} htmlFor="consent-evidence" error={error} required>
              <Textarea
                id="consent-evidence"
                autoFocus
                maxLength={500}
                placeholder={t(`${C}.evidencePlaceholder`)}
                value={evidence}
                onChange={(event) => {
                  setEvidence(event.target.value)
                }}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t(`${C}.cancel`)}
            </Button>
            <Button type="submit" disabled={pending}>
              {t(`${C}.grant`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

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
 * Staff record what the customer said outside the storefront; a grant
 * says how it was given (adr/0038 §2), a withdrawal needs nothing. Each
 * change is kept with who made it, and campaigns go only where it is granted.
 */
export function ConsentCard({ customerId }: { customerId: string }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const query = useQuery(customerConsentsQuery(customerId))
  const [granting, setGranting] = useState<ConsentChannel | null>(null)
  const save = useMutation({
    mutationFn: (body: {
      channel: ConsentChannel
      status: "granted" | "revoked"
      evidence?: string
    }) => saveCustomerConsent(customerId, body),
    onSuccess: (consents) => {
      client.setQueryData(customerConsentsQuery(customerId).queryKey, consents)
      setGranting(null)
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
                    if (checked) {
                      setGranting(channel)
                      return
                    }
                    save.mutate({ channel, status: "revoked" })
                  }}
                />
              </li>
            )
          })}
        </ul>
      )}
      <EvidenceDialog
        // A fresh form for each channel asked about
        key={granting ?? "none"}
        channel={granting}
        pending={save.isPending}
        onGrant={(evidence) => {
          if (granting) {
            save.mutate({ channel: granting, status: "granted", evidence })
          }
        }}
        onClose={() => {
          setGranting(null)
        }}
      />
    </SectionCard>
  )
}
