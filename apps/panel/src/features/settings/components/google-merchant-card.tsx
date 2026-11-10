import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { googleQuery, startGoogleConnect, useGoogleAction } from "@/features/settings/api/google"
import { errorText } from "@/lib/errors"
import { formatRelative } from "@qticaret/admin-ui/lib/format"

const G = "settings.marketing.google"
const OUTCOMES = ["connected", "denied", "state_invalid", "no_refresh_token", "failed"] as const

/** The word Google's callback sent the panel back with, once; the address is cleaned. */
function useCallbackOutcome() {
  const { t } = useTranslation()
  const shown = useRef(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const outcome = params.get("google")
    if (!outcome || shown.current) {
      return
    }
    shown.current = true
    const known = (OUTCOMES as readonly string[]).includes(outcome) ? outcome : "failed"
    if (known === "connected") {
      toast.success(t(`${G}.outcome.connected`))
    } else {
      toast.error(t(`${G}.outcome.${known}`))
    }
    params.delete("google")
    const rest = params.toString()
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`)
  }, [t])
}

/**
 * Settings > Marketing: the shop's Google account, connected through
 * Google's own consent screen, and its Merchant Center account, where the
 * products go every two hours through Merchant API (F10 M13, adr/0038 §5).
 * Not shown until the platform has opened Google: the shop can do nothing
 * with it before (docs/06 principle 10).
 */
export function GoogleMerchantCard() {
  const { t } = useTranslation()
  useCallbackOutcome()
  const status = useQuery(googleQuery())
  const action = useGoogleAction()
  const [merchantId, setMerchantId] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const google = status.data?.google
  const failed = (failure: unknown) => toast.error(errorText(t, failure))
  const typed = merchantId ?? google?.merchant_id ?? ""
  const sync = google?.last_sync
  if (google?.configured === false) {
    return null
  }
  return (
    <SectionCard title={t(`${G}.title`)} description={t(`${G}.description`)}>
      {!google ? (
        <Skeleton className="h-24" />
      ) : !google.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-muted-foreground">{t(`${G}.notConnected`)}</p>
          <Button
            disabled={leaving}
            onClick={() => {
              setLeaving(true)
              startGoogleConnect().then(
                ({ url }) => {
                  window.location.assign(url)
                },
                (failure: unknown) => {
                  setLeaving(false)
                  failed(failure)
                }
              )
            }}
          >
            {leaving ? <Loader2 className="animate-spin" /> : null}
            {t(`${G}.connect`)}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-sm">
            {t(`${G}.connectedAs`)} <span className="font-medium">{google.email ?? "—"}</span>
          </p>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              action.mutate(
                { kind: "merchant", merchantId: typed.trim() },
                {
                  onSuccess: () => {
                    setMerchantId(null)
                    toast.success(t(`${G}.merchantSaved`))
                  },
                  onError: failed,
                }
              )
            }}
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="google-merchant-id" className="text-sm font-medium">
                {t(`${G}.merchantId`)}
              </label>
              <Input
                id="google-merchant-id"
                inputMode="numeric"
                className="w-56 tabular-nums"
                aria-describedby="google-merchant-id-hint"
                value={typed}
                onChange={(event) => {
                  setMerchantId(event.target.value)
                }}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={action.isPending || !/^\d{1,20}$/.test(typed.trim()) || merchantId === null}
            >
              {t("common.save")}
            </Button>
          </form>
          <p id="google-merchant-id-hint" className="-mt-3 text-[13px] text-muted-foreground">
            {t(`${G}.merchantIdHint`)}
          </p>
          {sync ? (
            <p
              className={
                sync.error ? "text-[13px] text-warning-text" : "text-[13px] text-muted-foreground"
              }
            >
              {sync.error
                ? t(`${G}.syncError`, { when: formatRelative(sync.at) })
                : t(`${G}.synced`, {
                    sent: sync.sent,
                    removed: sync.removed,
                    failed: sync.failed,
                    when: formatRelative(sync.at),
                  })}
            </p>
          ) : null}
          <div className="grid gap-2 sm:flex sm:justify-end">
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() => {
                setAsking(true)
              }}
            >
              {t(`${G}.disconnect`)}
            </Button>
            <Button
              disabled={action.isPending || !google.merchant_id}
              onClick={() => {
                action.mutate(
                  { kind: "sync" },
                  { onSuccess: () => toast.success(t(`${G}.syncDone`)), onError: failed }
                )
              }}
            >
              {action.isPending ? <Loader2 className="animate-spin" /> : null}
              {t(`${G}.syncNow`)}
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t(`${G}.confirm.title`)}
        description={t(`${G}.confirm.description`)}
        confirmLabel={t(`${G}.confirm.action`)}
        destructive
        onConfirm={() => {
          setAsking(false)
          action.mutate(
            { kind: "disconnect" },
            { onSuccess: () => toast.success(t(`${G}.disconnected`)), onError: failed }
          )
        }}
      />
    </SectionCard>
  )
}
