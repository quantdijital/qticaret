import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import { myProfileQuery, useEndOtherSessions } from "@/features/settings/api/account"
import { errorText } from "@/lib/errors"
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

/**
 * "Giriş bilgileri" (the owner, 2026-11-06): the member's sign-in address
 * and password, each changed in its own dialog, and their open sessions,
 * the others ended at once. Any role, their own account only.
 */
export function MySignInCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const query = useQuery(myProfileQuery())
  const endOthers = useEndOtherSessions()
  const [open, setOpen] = useState<"email" | "password" | null>(null)
  const close = () => {
    setOpen(null)
  }
  const data = query.data
  const sessions = data?.sessions.open ?? null

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
              <Button
                variant="outline"
                size="sm"
                className="w-36"
                onClick={() => {
                  setOpen("email")
                }}
              >
                {t(`${S}.change`)}
              </Button>
            }
          />
          <Row
            label={t(`${S}.password`)}
            value={<span aria-label={t(`${S}.passwordHidden`)}>••••••••••</span>}
            action={
              <Button
                variant="outline"
                size="sm"
                className="w-36"
                onClick={() => {
                  setOpen("password")
                }}
              >
                {t(`${S}.change`)}
              </Button>
            }
          />
          <Row
            label={t(`${S}.sessions`)}
            value={
              sessions === null
                ? t(`${S}.sessionsUnknown`)
                : t(`${S}.sessionsOpen`, { count: sessions })
            }
            action={
              <Button
                variant="outline"
                size="sm"
                className="w-36"
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
              </Button>
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
