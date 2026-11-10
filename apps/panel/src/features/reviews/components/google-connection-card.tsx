import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import {
  googleLocationsQuery,
  startGoogleReviewsConnect,
  useGoogleReviewsAction,
} from "@/features/reviews/api/google-reviews"
import type { GoogleReviewsStatus } from "@/features/reviews/api/google-reviews"
import { errorText } from "@/lib/errors"
import { formatRelative } from "@qticaret/admin-ui/lib/format"

const G = "reviews.google"
const OUTCOMES = ["connected", "denied", "state_invalid", "no_refresh_token", "failed"] as const
// What the last sync's stop means for the shop: connect again, pick again, or wait
const RECONNECT = new Set(["invalid_grant", "reviews_scope", "not_connected"])
const LOST = new Set(["PERMISSION_DENIED", "NOT_FOUND", "http_403", "http_404"])

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
      toast.success(t(`${G}.connected`))
    } else {
      toast.error(t(`settings.marketing.google.outcome.${known}`))
    }
    params.delete("google")
    const rest = params.toString()
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`)
  }, [t])
}

/** "Google yorumlarını bağla": to Google's own screen, Business Profile's scope asked on top. */
function ConnectButton({ label }: { label: string }) {
  const { t } = useTranslation()
  const [leaving, setLeaving] = useState(false)
  return (
    <Button
      disabled={leaving}
      onClick={() => {
        setLeaving(true)
        startGoogleReviewsConnect().then(
          ({ url }) => {
            window.location.assign(url)
          },
          (failure: unknown) => {
            setLeaving(false)
            toast.error(errorText(t, failure))
          }
        )
      }}
    >
      {leaving ? <Loader2 className="animate-spin" /> : null}
      {label}
    </Button>
  )
}

/** The locations the account manages; the one picked is read from Google at once. */
function LocationPicker({
  current,
  onDone,
  onCancel,
}: {
  current: string | null
  onDone: () => void
  onCancel?: (() => void) | undefined
}) {
  const { t } = useTranslation()
  const locations = useQuery(googleLocationsQuery(true))
  const action = useGoogleReviewsAction()
  const [chosen, setChosen] = useState<string | null>(null)
  const list = locations.data?.locations ?? []
  const value = chosen ?? current ?? (list.length === 1 ? (list[0]?.location ?? "") : "")
  if (locations.isError) {
    return <p className="text-[13px] text-warning-text">{errorText(t, locations.error)}</p>
  }
  if (!locations.data) {
    return <Skeleton className="h-16" />
  }
  if (list.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">{t(`${G}.noLocations`)}</p>
        <ConnectButton label={t(`${G}.reconnect`)} />
      </div>
    )
  }
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        const picked = list.find((each) => each.location === value)
        if (!picked) {
          return
        }
        action.mutate(
          { kind: "location", account: picked.account, location: picked.location },
          {
            onSuccess: () => {
              setChosen(null)
              toast.success(t(`${G}.locationSaved`))
              onDone()
            },
            onError: (failure) => toast.error(errorText(t, failure)),
          }
        )
      }}
    >
      <div className="flex min-w-0 flex-[1_1_18rem] flex-col gap-2">
        <span id="google-location-label" className="text-sm font-medium">
          {t(`${G}.location`)}
        </span>
        <Select value={value} onValueChange={setChosen}>
          <SelectTrigger aria-labelledby="google-location-label">
            <SelectValue placeholder={t(`${G}.chooseLocation`)} />
          </SelectTrigger>
          <SelectContent>
            {list.map((each) => (
              <SelectItem key={each.location} value={each.location}>
                {each.address ? `${each.title} · ${each.address}` : each.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {onCancel ? (
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      ) : null}
      <Button type="submit" disabled={!value || value === current || action.isPending}>
        {action.isPending ? <Loader2 className="animate-spin" /> : null}
        {t(`${G}.useLocation`)}
      </Button>
    </form>
  )
}

/** One line of where the shop stands with Google: its figures, the last sync, or why it stopped. */
function StatusLine({ status }: { status: GoogleReviewsStatus }) {
  const { t, i18n } = useTranslation()
  const rating =
    status.rating === null
      ? null
      : new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(status.rating)
  const when = status.synced_at ? formatRelative(status.synced_at) : null
  const error = status.error
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm">
        {rating !== null
          ? t(`${G}.figures`, { rating, count: status.count ?? 0 })
          : t(`${G}.noFigures`)}
        {when ? ` · ${t(`${G}.syncedAgo`, { when })}` : ""}
      </p>
      {error ? (
        <p className="text-[13px] text-warning-text">
          {RECONNECT.has(error)
            ? t(`${G}.errorReconnect`)
            : LOST.has(error)
              ? t(`${G}.errorLost`)
              : t(`${G}.errorLater`)}
        </p>
      ) : null}
    </div>
  )
}

/**
 * The shop's Google reviews connection (adr/0058): through Google's own
 * screen with Business Profile's scope, the location whose reviews the
 * storefront shows, Google's figures and the last daily sync, "Şimdi
 * eşitle" and "Bağlantıyı kaldır" (the Google account stays connected).
 */
export function GoogleConnectionCard({ status }: { status: GoogleReviewsStatus | undefined }) {
  const { t } = useTranslation()
  useCallbackOutcome()
  const action = useGoogleReviewsAction()
  const [changing, setChanging] = useState(false)
  const [asking, setAsking] = useState(false)
  const failed = (failure: unknown) => toast.error(errorText(t, failure))
  const reconnect =
    status?.error !== null && status?.error !== undefined && RECONNECT.has(status.error)
  return (
    <SectionCard title={t(`${G}.title`)} description={t(`${G}.description`)}>
      {!status ? (
        <Skeleton className="h-20" />
      ) : !status.connected || !status.granted ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-prose text-[13px] text-muted-foreground">
            {t(status.connected ? `${G}.notGranted` : `${G}.notConnected`)}
          </p>
          <ConnectButton label={t(`${G}.connect`)} />
        </div>
      ) : !status.location || changing ? (
        <LocationPicker
          current={status.location?.location ?? null}
          onDone={() => {
            setChanging(false)
          }}
          onCancel={
            status.location
              ? () => {
                  setChanging(false)
                }
              : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">{status.location.title}</p>
            {status.location.address ? (
              <p className="text-[13px] text-muted-foreground">{status.location.address}</p>
            ) : null}
          </div>
          <StatusLine status={status} />
          <div className="grid gap-2 sm:flex sm:justify-end">
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() => {
                setAsking(true)
              }}
            >
              {t(`${G}.remove`)}
            </Button>
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() => {
                setChanging(true)
              }}
            >
              {t(`${G}.changeLocation`)}
            </Button>
            {reconnect ? (
              <ConnectButton label={t(`${G}.reconnect`)} />
            ) : (
              <Button
                disabled={action.isPending}
                onClick={() => {
                  action.mutate(
                    { kind: "sync" },
                    {
                      onSuccess: (answer) => {
                        const error = "sync" in answer ? answer.sync.error : null
                        if (error) {
                          toast.error(t(`${G}.syncFailed`))
                        } else {
                          toast.success(t(`${G}.synced`))
                        }
                      },
                      onError: failed,
                    }
                  )
                }}
              >
                {action.isPending ? <Loader2 className="animate-spin" /> : null}
                {t(`${G}.syncNow`)}
              </Button>
            )}
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
            { kind: "forget" },
            { onSuccess: () => toast.success(t(`${G}.removed`)), onError: failed }
          )
        }}
      />
    </SectionCard>
  )
}
