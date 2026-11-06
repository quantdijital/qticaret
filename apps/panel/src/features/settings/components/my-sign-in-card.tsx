import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import {
  myProfileQuery,
  mySessionsQuery,
  useCancelEmailChange,
  useEndOtherSessions,
} from "@/features/settings/api/account"
import { errorText } from "@/lib/errors"
import { formatDateTime } from "@/lib/format"
import { EmailDialog, PasswordDialog } from "./credential-dialogs"

const S = "settings.security.signIn"

/** One line of the card: what it is, its value, and the one thing to do with it. */
function Row({ label, value, action }: { label: string; value: ReactNode; action: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <span className="truncate text-sm font-medium">{value}</span>
      </div>
      <div className="flex shrink-0">{action}</div>
    </div>
  )
}

/** A row's one action: every row's the same size. */
function RowButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button variant="outline" size="sm" className="w-36" disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  )
}

/**
 * "Giriş bilgileri" (the owner, 2026-11-06): the member's sign-in address
 * (and a change waiting for its link, cancelled here) and password, each
 * changed in its own dialog, and their open sessions (asked apart), the
 * others ended at once. Any role, their own account only.
 */
export function MySignInCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const query = useQuery(myProfileQuery())
  const sessionsQuery = useQuery(mySessionsQuery())
  const endOthers = useEndOtherSessions()
  const cancel = useCancelEmailChange()
  const [open, setOpen] = useState<"email" | "password" | null>(null)
  const close = () => {
    setOpen(null)
  }
  const data = query.data
  const sessions = sessionsQuery.data?.open ?? null

  return (
    <SectionCard title={t(`${S}.title`)} description={t(`${S}.hint`)} className={className}>
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !data ? (
        <LoadingRows rows={3} />
      ) : (
        <div className="flex flex-col divide-y">
          <Row
            label={t(`${S}.email`)}
            value={data.profile.email}
            action={
              <RowButton
                onClick={() => {
                  setOpen("email")
                }}
              >
                {t(`${S}.change`)}
              </RowButton>
            }
          />
          {data.pending_email ? (
            <Row
              label={t(`${S}.pending`, { at: formatDateTime(data.pending_email.expires_at) })}
              value={data.pending_email.to}
              action={
                <RowButton
                  disabled={cancel.isPending}
                  onClick={() => {
                    cancel.mutate(undefined, {
                      onSuccess: () => {
                        toast.success(t(`${S}.pendingCanceled`))
                      },
                      onError: (error) => toast.error(errorText(t, error)),
                    })
                  }}
                >
                  {t(`${S}.cancelPending`)}
                </RowButton>
              }
            />
          ) : null}
          <Row
            label={t(`${S}.password`)}
            value={<span aria-label={t(`${S}.passwordHidden`)}>••••••••••</span>}
            action={
              <RowButton
                onClick={() => {
                  setOpen("password")
                }}
              >
                {t(`${S}.change`)}
              </RowButton>
            }
          />
          <Row
            label={t(`${S}.sessions`)}
            value={
              sessions === null
                ? t(sessionsQuery.isPending ? "common.loading" : `${S}.sessionsUnknown`)
                : t(`${S}.sessionsOpen`, { count: sessions })
            }
            action={
              <RowButton
                disabled={sessions === null || sessions < 2 || endOthers.isPending}
                onClick={() => {
                  endOthers.mutate(undefined, {
                    onSuccess: (result) => {
                      toast.success(t(`${S}.sessionsEnded`, { count: result.ended }))
                    },
                    onError: (error) => toast.error(errorText(t, error)),
                  })
                }}
              >
                {t(`${S}.endOthers`)}
              </RowButton>
            }
          />
        </div>
      )}
      {open === "password" ? <PasswordDialog onClose={close} /> : null}
      {open === "email" && data ? (
        <EmailDialog current={data.profile.email} onClose={close} />
      ) : null}
    </SectionCard>
  )
}
