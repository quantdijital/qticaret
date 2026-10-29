import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { SectionCard } from "@/components/patterns/section-card"
import { LoadingRows } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import type { StatusTone } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  eventKey,
  useDeleteWebhook,
  useReactivateWebhook,
  webhookQuery,
  webhooksQuery,
} from "@/features/settings/api/webhooks"
import type { WebhookDelivery, WebhookSubscription } from "@/features/settings/api/webhooks"
import { WebhookDialog } from "@/features/settings/components/webhook-dialog"
import { errorText } from "@/lib/errors"
import { formatCount, formatRelative } from "@/lib/format"

const W = "settings.api.webhooks"

const DELIVERY_TONE: Record<WebhookDelivery["status"], StatusTone> = {
  delivered: "success",
  pending: "info",
  stopped: "danger",
}

/** The subscription's latest deliveries: event, answer, time; never a body. */
function DeliveriesDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t } = useTranslation()
  const detail = useQuery(webhookQuery(id))
  const deliveries = detail.data?.deliveries ?? []
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t(`${W}.log`)}</DialogTitle>
          <DialogDescription className="break-all">
            {detail.data?.subscription.url}
          </DialogDescription>
        </DialogHeader>
        {detail.isPending ? (
          <LoadingRows />
        ) : deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t(`${W}.noDeliveries`)}</p>
        ) : (
          <ul className="flex max-h-96 flex-col divide-y overflow-y-auto rounded-md border">
            {deliveries.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <StatusBadge tone={DELIVERY_TONE[row.status]}>
                  {t(`${W}.deliveryStatus.${row.status}`)}
                </StatusBadge>
                <span className="text-sm">
                  {t(`${W}.events.${eventKey(row.event)}`, { defaultValue: row.event })}
                </span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {[
                    row.last_status !== null
                      ? `HTTP ${String(row.last_status)}`
                      : row.last_error &&
                        t(`${W}.failure.${row.last_error}`, { defaultValue: row.last_error }),
                    row.last_duration_ms === null
                      ? null
                      : `${formatCount(row.last_duration_ms)} ms`,
                    t(`${W}.attempts`, { count: row.attempts }),
                    formatRelative(row.delivered_at ?? row.created_at),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

function SubscriptionRow({
  row,
  onLog,
  onDelete,
}: {
  row: WebhookSubscription
  onLog: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const reactivate = useReactivateWebhook()
  const off = row.status === "disabled"
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-5 py-3">
      <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-1">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{row.url}</span>
          <StatusBadge tone={off ? "danger" : "success"}>
            {t(`${W}.status.${row.status}`)}
          </StatusBadge>
        </span>
        <span className="text-xs text-muted-foreground">
          {row.events.map((event) => t(`${W}.events.${eventKey(event)}`)).join(" · ")}
          {row.failure_streak > 0 ? ` · ${t(`${W}.streak`, { count: row.failure_streak })}` : ""}
        </span>
      </div>
      <div className="flex gap-2">
        {off ? (
          <Button
            size="sm"
            disabled={reactivate.isPending}
            onClick={() => {
              reactivate.mutate(row.id, {
                onSuccess: () => toast.success(t(`${W}.reactivated`)),
                onError: (failure) => toast.error(errorText(t, failure)),
              })
            }}
          >
            {t(`${W}.reactivate`)}
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={onLog}>
          {t(`${W}.log`)}
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete}>
          {t(`${W}.delete`)}
        </Button>
      </div>
    </li>
  )
}

/**
 * Outgoing webhooks (F11.7, adr/0039 §7): the shop's own systems hear of
 * orders, stock and returns, each body signed; a subscription that fails
 * eight times in a row is turned off and can be turned on here.
 */
export function WebhooksCard() {
  const { t } = useTranslation()
  const list = useQuery(webhooksQuery())
  const remove = useDeleteWebhook()
  const [creating, setCreating] = useState(false)
  const [logOf, setLogOf] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<WebhookSubscription | null>(null)
  const rows = list.data?.subscriptions ?? []
  return (
    <SectionCard
      title={t(`${W}.title`)}
      description={t(`${W}.hint`)}
      flush
      action={
        <Button
          size="sm"
          onClick={() => {
            setCreating(true)
          }}
        >
          <Plus />
          {t(`${W}.new`)}
        </Button>
      }
    >
      {list.isPending ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <p className="border-t px-5 py-4 text-sm text-muted-foreground">{t(`${W}.empty`)}</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <SubscriptionRow
              key={row.id}
              row={row}
              onLog={() => {
                setLogOf(row.id)
              }}
              onDelete={() => {
                setDeleting(row)
              }}
            />
          ))}
        </ul>
      )}
      <WebhookDialog open={creating} onOpenChange={setCreating} />
      {logOf ? (
        <DeliveriesDialog
          id={logOf}
          onClose={() => {
            setLogOf(null)
          }}
        />
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
          }
        }}
        title={t(`${W}.deleteTitle`)}
        description={t(`${W}.deleteHint`, { url: deleting?.url ?? "" })}
        confirmLabel={t(`${W}.delete`)}
        destructive
        onConfirm={() => {
          if (deleting) {
            remove.mutate(deleting.id, {
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }
          setDeleting(null)
        }}
      />
    </SectionCard>
  )
}
