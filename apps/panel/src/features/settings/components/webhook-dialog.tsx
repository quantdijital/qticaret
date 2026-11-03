import { Check, Copy, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { WEBHOOK_EVENTS, eventKey, useSubscribeWebhook } from "@/features/settings/api/webhooks"
import type { WebhookEvent } from "@/features/settings/api/webhooks"
import { errorText } from "@/lib/errors"

const W = "settings.api.webhooks"

/** The signing secret as made: shown here once, for the receiving system. */
export function MadeSecret({ secret }: { secret: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-lg border border-dashed bg-muted/40 p-4">
        <span className="text-sm font-medium text-warning-text">{t(`${W}.secretOnce`)}</span>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 font-mono text-sm break-all select-all">{secret}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t(`${W}.copy`)}
            onClick={() => {
              // Refused without the page's clipboard permission: the secret stays selectable
              navigator.clipboard.writeText(secret).then(
                () => {
                  setCopied(true)
                },
                () => toast.error(t("settings.api.create.copyFailed"))
              )
            }}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
      </div>
      <p className="text-[13px] text-muted-foreground">{t(`${W}.verify`)}</p>
    </div>
  )
}

/** A new subscription: its https address and events; then its signing secret, once (F11.7). */
export function WebhookDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const subscribe = useSubscribeWebhook()
  const [url, setUrl] = useState("")
  const [events, setEvents] = useState<WebhookEvent[]>(["order.placed"])
  const [secret, setSecret] = useState<string | null>(null)
  const close = (next: boolean) => {
    if (!next) {
      setUrl("")
      setEvents(["order.placed"])
      setSecret(null)
      subscribe.reset()
    }
    onOpenChange(next)
  }
  const valid = url.trim().startsWith("https://") && events.length > 0
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`${W}.newTitle`)}</DialogTitle>
          <DialogDescription>{t(secret ? `${W}.madeHint` : `${W}.newHint`)}</DialogDescription>
        </DialogHeader>
        {secret ? (
          <MadeSecret secret={secret} />
        ) : (
          <div className="flex flex-col gap-4">
            <Field label={t(`${W}.url`)} htmlFor="webhook-url" hint={t(`${W}.urlHint`)}>
              <Input
                id="webhook-url"
                inputMode="url"
                placeholder="https://"
                autoComplete="off"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value)
                }}
              />
            </Field>
            <Field label={t(`${W}.eventsLabel`)}>
              <div className="grid gap-2 sm:grid-cols-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <label key={event} className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <Checkbox
                      checked={events.includes(event)}
                      onCheckedChange={(checked) => {
                        setEvents((current) =>
                          checked === true
                            ? [...current, event]
                            : current.filter((each) => each !== event)
                        )
                      }}
                    />
                    {t(`${W}.events.${eventKey(event)}`)}
                  </label>
                ))}
              </div>
            </Field>
          </div>
        )}
        <DialogFooter>
          {secret ? (
            <Button
              onClick={() => {
                close(false)
              }}
            >
              {t("settings.api.create.done")}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  close(false)
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                disabled={!valid || subscribe.isPending}
                onClick={() => {
                  subscribe.mutate(
                    { url: url.trim(), events },
                    {
                      onSuccess: (made) => {
                        setSecret(made.secret)
                      },
                      onError: (failure) => toast.error(errorText(t, failure)),
                    }
                  )
                }}
              >
                {subscribe.isPending ? <Loader2 className="animate-spin" /> : null}
                {t(`${W}.subscribe`)}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
