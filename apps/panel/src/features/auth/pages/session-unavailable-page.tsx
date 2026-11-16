import { useRouter } from "@tanstack/react-router"
import type { ErrorComponentProps } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { SessionUnavailableError } from "@/features/auth/api/session"
import { AuthHeading, AuthShell } from "@/features/auth/components/auth-shell"

/**
 * The panel could not read who is signed in (too many requests, or no
 * answer) and had no one read before: not the sign-in page, which would
 * say the session ended, but "could not load" and a way to try again.
 */
export function SessionUnavailablePage({ reason }: { reason: SessionUnavailableError["reason"] }) {
  const { t } = useTranslation()
  const router = useRouter()
  return (
    <AuthShell>
      <div role="alert">
        <AuthHeading title={t(`session.${reason}.title`)} subtitle={t(`session.${reason}.text`)} />
      </div>
      <Button
        className="mt-8 w-full"
        variant="outline"
        onClick={() => {
          void router.invalidate()
        }}
      >
        {t("session.retry")}
      </Button>
    </AuthShell>
  )
}

/** Any other failure: the panel's own error state, no internals on screen. */
function RouteFailed() {
  const { t } = useTranslation()
  const router = useRouter()
  return (
    <div className="p-6">
      <ErrorState
        text={t("errors.loadFailed")}
        onRetry={() => {
          void router.invalidate()
        }}
      />
    </div>
  )
}

/** A signed-in route's error view: its own page for an unread session, the panel's state for the rest. */
export function SessionErrorBoundary({ error }: ErrorComponentProps) {
  return error instanceof SessionUnavailableError ? (
    <SessionUnavailablePage reason={error.reason} />
  ) : (
    <RouteFailed />
  )
}
