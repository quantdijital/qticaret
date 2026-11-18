import { useQuery } from "@tanstack/react-query"
import { KeyRound, Loader2, RefreshCw, TriangleAlert } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Alert, AlertDescription } from "@qticaret/admin-ui/ui/alert"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { useStaff } from "@/features/auth/api/staff"
import {
  birfaturaSiteUrl,
  birfaturaStatusQuery,
  useMakeBirfaturaToken,
} from "@/features/settings/api/einvoice"
import type { BirfaturaStatus } from "@/features/settings/api/einvoice"
import { BirfaturaTokenDialog } from "@/features/settings/components/birfatura-token-dialog"
import { NotificationAddress } from "@/features/settings/components/notification-address"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"

const B = "settings.einvoice.birfatura"

/** Where the password stands: none yet, made (and when), or no longer readable by the server. */
function PasswordState({ token }: { token: BirfaturaStatus["token"] }) {
  const { t } = useTranslation()
  if (!token) {
    return <p className="text-[13px] text-muted-foreground">{t(`${B}.password.none`)}</p>
  }
  if (token.state === "unreadable") {
    return <p className="text-[13px] text-destructive-text">{t(`${B}.password.unreadable`)}</p>
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge tone="success">{t(`${B}.password.made`)}</StatusBadge>
      <span className="text-xs text-muted-foreground">
        {t(`${B}.password.since`, { when: formatDateTime(token.made_at) })}
      </span>
    </div>
  )
}

/** BirFatura's last pull, or a warning (not a block) that it has not pulled yet. */
function LastPull({ pull }: { pull: BirfaturaStatus["last_pull"] }) {
  const { t } = useTranslation()
  if (!pull) {
    return (
      <Alert>
        <TriangleAlert aria-hidden="true" className="text-warning-text" />
        <AlertDescription>{t(`${B}.neverPulled`)}</AlertDescription>
      </Alert>
    )
  }
  return (
    <p className="text-[13px]">
      {t(`${B}.lastPull`, { when: formatDateTime(pull.at), count: pull.orders })}
    </p>
  )
}

/**
 * BirFatura's connection (adr/0072): the site address and the connection
 * password typed into BirFatura's "Özel Entegrasyon" shop, its last pull,
 * and the steps on BirFatura's side. The password is the owner's to make,
 * proving themselves again; it is shown once. Making a new one asks first:
 * the old one stops at once and BirFatura cannot pull until it has the new.
 */
export function BirfaturaConnection({ className }: { className?: string }) {
  const { t } = useTranslation()
  const status = useQuery(birfaturaStatusQuery())
  const owner = useStaff()?.role === "owner"
  const make = useMakeBirfaturaToken()
  const [confirming, setConfirming] = useState(false)
  const data = status.data
  const token = make.data?.token ?? null
  const fail = (failure: unknown) => toast.error(errorText(t, failure))
  const run = () => {
    make.mutate(undefined, { onError: fail })
  }
  // Read afresh before choosing: a password made meanwhile (another session) is always asked about
  const start = async () => {
    const fresh = await status.refetch()
    if (fresh.isError) {
      fail(fresh.error)
    } else if (fresh.data?.token) {
      setConfirming(true)
    } else {
      run()
    }
  }
  return (
    <SectionCard
      title={t(`${B}.title`)}
      description={t(`${B}.description`)}
      {...(className ? { className } : {})}
    >
      {status.isError ? (
        <p className="text-[13px] text-muted-foreground">{errorText(t, status.error)}</p>
      ) : !data ? (
        <Skeleton className="h-48 rounded-md" />
      ) : (
        <div className="flex h-full flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t(`${B}.site`)}</span>
            <NotificationAddress
              id="birfatura-site"
              url={birfaturaSiteUrl(window.location.origin)}
              label={t(`${B}.site`)}
              hint={t(`${B}.siteHint`)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t(`${B}.password.label`)}</span>
            <PasswordState token={data.token} />
            {owner ? null : (
              <p className="text-xs text-muted-foreground">{t(`${B}.password.ownerOnly`)}</p>
            )}
          </div>
          <LastPull pull={data.last_pull} />
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px] text-muted-foreground">
            <li>{t(`${B}.steps.open`)}</li>
            <li>{t(`${B}.steps.fill`)}</li>
            <li>{t(`${B}.steps.save`)}</li>
          </ol>
          {owner ? (
            <div className="mt-auto grid gap-2 sm:grid-cols-2">
              <Button
                variant={data.token ? "outline" : "default"}
                disabled={make.isPending || status.isFetching}
                onClick={() => void start()}
              >
                {make.isPending || status.isFetching ? (
                  <Loader2 className="animate-spin" />
                ) : data.token ? (
                  <RefreshCw />
                ) : (
                  <KeyRound />
                )}
                {t(data.token ? `${B}.password.renew` : `${B}.password.make`)}
              </Button>
            </div>
          ) : null}
        </div>
      )}
      <BirfaturaTokenDialog
        confirming={confirming}
        token={token}
        pending={make.isPending}
        onConfirm={run}
        onClose={() => {
          setConfirming(false)
          // The password leaves the page with the dialog: it is never shown again
          make.reset()
        }}
      />
    </SectionCard>
  )
}
