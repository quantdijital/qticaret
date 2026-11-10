import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { formatDateTime } from "@qticaret/admin-ui/lib/format"
import { sessionsQuery, useEndOtherSessions, useEndSession } from "@/features/account/api"
import { errorText } from "@/lib/errors"
import { isStepUpCancelled } from "@/lib/step-up"

/**
 * One's own open panel sessions (adr/0061 Ek C4): each by its handle and
 * when it runs out, this one marked. Ending one, or all the others, asks
 * the step-up (a sign-in with a code in the last minutes stands in for
 * "the others"): a stolen session must not lock its owner out.
 */
export function SessionsCard() {
  const { t } = useTranslation()
  const sessions = useQuery(sessionsQuery())
  const endOne = useEndSession()
  const endOthers = useEndOtherSessions()
  const fail = (error: unknown) => {
    if (!isStepUpCancelled(error)) {
      toast.error(errorText(t, error))
    }
  }
  const others = (sessions.data ?? []).filter((session) => !session.current).length
  return (
    <SectionCard
      title={t("account.sessions.title")}
      description={t("account.sessions.text")}
      flush
      action={
        <Button
          variant="outline"
          size="sm"
          disabled={others === 0 || endOthers.isPending}
          onClick={() => {
            endOthers.mutate(undefined, {
              onSuccess: () => {
                toast.success(t("account.sessions.othersEnded"))
              },
              onError: fail,
            })
          }}
        >
          {t("account.sessions.endOthers")}
        </Button>
      }
    >
      {sessions.isPending ? (
        <div className="px-5 pb-5">
          <LoadingRows rows={2} />
        </div>
      ) : sessions.isError ? (
        <div className="px-5 pb-5">
          <ErrorState text={errorText(t, sessions.error)} onRetry={() => void sessions.refetch()} />
        </div>
      ) : (
        <ul className="flex flex-col border-t">
          {sessions.data.map((session) => (
            <li
              key={session.id}
              className="flex min-h-[var(--row-height)] flex-wrap items-center gap-x-4 gap-y-2 border-b px-5 py-2.5 last:border-b-0"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-mono text-[13px]">{session.id.slice(0, 12)}</span>
                <span className="text-xs text-muted-foreground">
                  {t("account.sessions.until", { at: formatDateTime(session.expires_at) })}
                </span>
              </div>
              {session.current ? (
                <StatusBadge tone="info">{t("account.sessions.current")}</StatusBadge>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={endOne.isPending}
                  onClick={() => {
                    endOne.mutate(session.id, {
                      onSuccess: () => {
                        toast.success(t("account.sessions.ended"))
                      },
                      onError: fail,
                    })
                  }}
                >
                  {t("account.sessions.end")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
