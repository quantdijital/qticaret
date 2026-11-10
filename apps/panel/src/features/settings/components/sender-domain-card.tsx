import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import {
  addSenderDomain,
  checkSenderDomain,
  removeSenderDomain,
  senderDomainQuery,
} from "@/features/settings/api/messaging"
import type { DnsRecord, SenderDomainView } from "@/features/settings/api/messaging"
import { SenderDnsList } from "@/features/settings/components/sender-dns"
import { errorText } from "@/lib/errors"

const D = "settings.notifications.domain"

const TONE: Record<NonNullable<SenderDomainView["domain"]>["status"], StatusTone> = {
  verified: "success",
  not_started: "warning",
  pending: "warning",
  temporary_failure: "warning",
  failure: "danger",
}

/** One DNS record to publish, its value copied rather than typed. */
function RecordRow({ record, suggested }: { record: DnsRecord; suggested?: boolean }) {
  const { t } = useTranslation()
  return (
    <li className="flex flex-col gap-1 px-3 py-2.5">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{record.type}</span>
        <span className="font-mono">{record.name}</span>
        {record.priority === undefined ? null : (
          <span>{t(`${D}.priority`, { value: String(record.priority) })}</span>
        )}
        {suggested ? <span>· {t(`${D}.suggested`)}</span> : null}
      </span>
      <span className="flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1 font-mono text-xs">
          {record.value}
        </code>
        <Button
          size="icon"
          variant="ghost"
          aria-label={t(`${D}.copy`, { name: record.name })}
          onClick={() => {
            void navigator.clipboard.writeText(record.value).then(() => {
              toast.success(t(`${D}.copied`))
            })
          }}
        >
          <Copy aria-hidden="true" />
        </Button>
      </span>
    </li>
  )
}

/**
 * Settings > Notifications: the domain the shop's e-mail goes from (F9.6,
 * adr/0036). Until the shop's own domain is verified at Resend, e-mail
 * goes from the platform's address under the shop's name. Where no domain
 * can be verified (a transport other than Resend) the card shows only the
 * address; where nothing sends, one line says so (docs/06 principle 10).
 */
export function SenderDomainCard() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const query = useQuery(senderDomainQuery())
  const [name, setName] = useState("")
  const [localPart, setLocalPart] = useState("bildirim")
  const done = (view: SenderDomainView) => {
    client.setQueryData(senderDomainQuery().queryKey, view)
  }
  const failed = (failure: unknown) => {
    toast.error(errorText(t, failure))
  }
  const add = useMutation({
    mutationFn: () => addSenderDomain({ name: name.trim(), local_part: localPart.trim() }),
    onSuccess: done,
    onError: failed,
  })
  const check = useMutation({
    mutationFn: checkSenderDomain,
    onSuccess: (view) => {
      done(view)
      toast[view.domain?.status === "verified" ? "success" : "warning"](
        t(view.domain?.status === "verified" ? `${D}.verified` : `${D}.notYet`)
      )
    },
    onError: failed,
  })
  const remove = useMutation({ mutationFn: removeSenderDomain, onSuccess: done, onError: failed })
  const view = query.data
  const busy = add.isPending || check.isPending || remove.isPending
  // The shop's own domain only where it can verify one; otherwise the address it sends from
  const ownDomain = !view || (view.sending && view.available)
  // Nothing sends: the one line in the body says it all
  const description = ownDomain
    ? t(`${D}.description`)
    : view.sending
      ? t(`${D}.senderDescription`)
      : ""
  return (
    <SectionCard title={t(ownDomain ? `${D}.title` : `${D}.senderTitle`)} description={description}>
      {!view ? (
        <Skeleton className="h-24" />
      ) : !view.sending ? (
        <p className="text-[13px] text-muted-foreground">{t(`${D}.notSending`)}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            {t(`${D}.sender`)} <span className="font-mono">{view.sender}</span>
          </p>
          {view.transport === "smtp" && view.dns ? <SenderDnsList dns={view.dns} /> : null}
          {!view.available ? null : !view.domain ? (
            <form
              className="grid gap-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]"
              onSubmit={(event) => {
                event.preventDefault()
                add.mutate()
              }}
            >
              <label htmlFor="sender-local" className="sr-only">
                {t(`${D}.localPart`)}
              </label>
              <Input
                id="sender-local"
                value={localPart}
                onChange={(event) => {
                  setLocalPart(event.target.value)
                }}
              />
              <label htmlFor="sender-domain" className="sr-only">
                {t(`${D}.name`)}
              </label>
              <Input
                id="sender-domain"
                placeholder="magaza.com.tr"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                }}
              />
              <Button type="submit" variant="outline" disabled={busy || name.trim() === ""}>
                {t(`${D}.add`)}
              </Button>
            </form>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{view.domain.name}</span>
                <StatusBadge tone={TONE[view.domain.status]}>
                  {t(`${D}.statuses.${view.domain.status}`)}
                </StatusBadge>
              </div>
              {view.domain.status === "verified" ? null : (
                <p className="text-[13px] text-muted-foreground">{t(`${D}.publish`)}</p>
              )}
              <ul className="flex flex-col divide-y rounded-md border">
                {view.domain.records.map((record) => (
                  <RecordRow
                    key={`${record.type}-${record.name}-${record.value}`}
                    record={record}
                  />
                ))}
                <RecordRow record={view.dmarc} suggested />
              </ul>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    remove.mutate()
                  }}
                >
                  {t(`${D}.remove`)}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => {
                    check.mutate()
                  }}
                >
                  {t(`${D}.check`)}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </SectionCard>
  )
}
