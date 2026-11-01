import { MailCheck } from "lucide-react"
import type { AuthActions, AuthMode, AuthPageView, Translate } from "@qticaret/ui"
import { AuthForm } from "./account/AuthForms"
import { PageContainer } from "./components/Container"

const ERRORS = [
  "account.login_failed",
  "account.register_failed",
  "account.email_taken",
  "account.terms_required",
  "account.code_invalid",
  "account.reset_failed",
  "account.reset_link_invalid",
  "account.token_before_password_change",
  "auth.password_too_short",
  "auth.password_too_long",
  "auth.password_common",
  "auth.password_contains_email",
  "auth.password_breached",
  "checkout.email_invalid",
  "checkout.phone_invalid",
  "checkout.name_required",
  "messaging.email_domain_refuses",
  "fraud.refused",
  "fraud.velocity",
  "errors.too_many_requests",
  "errors.challenge_failed",
]

const FALLBACK: Record<AuthMode, string> = {
  login: "account.login_failed",
  register: "account.register_failed",
  forgot: "account.reset_failed",
  reset: "account.reset_link_invalid",
  verify: "account.code_invalid",
}

/**
 * Signing in, registering, verifying the e-mail and resetting the
 * password: one quiet column, the shop's own words above the form, the
 * other forms a link away.
 */
export function AuthPage({
  view,
  t,
  actions,
}: {
  view: AuthPageView
  t: Translate
  actions: AuthActions
}) {
  const { mode } = view
  const errors = Object.fromEntries(ERRORS.map((key) => [key, t(key)]))
  const sent = mode === "verify" && view.notice !== null && view.token === null
  return (
    <PageContainer>
      <div className="mx-auto flex max-w-md flex-col gap-8 py-6 lg:py-12">
        <header className="flex flex-col gap-3 text-center">
          {sent && (
            <span className="mx-auto flex size-16 items-center justify-center rounded-full border bg-card">
              <MailCheck className="size-7 text-primary" aria-hidden="true" />
            </span>
          )}
          <h1 className="text-4xl leading-tight">{t(`account.${mode}_title`)}</h1>
          <p className="text-muted-foreground">{t(`account.${mode}_text`)}</p>
        </header>
        {view.notice && (
          <p
            role="status"
            className="rounded-2xl border border-success/30 bg-success/5 p-4 text-sm text-success"
          >
            {view.notice}
          </p>
        )}
        <div className="rounded-3xl border bg-card p-6 sm:p-8">
          <AuthForm
            view={view}
            action={actions[mode]}
            words={{
              email: t("checkout.email"),
              password: t("account.password"),
              passwordHint: t("account.password_hint"),
              newPassword: t("account.new_password"),
              firstName: t("checkout.first_name"),
              lastName: t("checkout.last_name"),
              phone: t("checkout.phone"),
              phoneOptional: t("account.optional"),
              code: t("account.code"),
              accept: t("account.accept_terms"),
              submit: t(`account.${mode}_submit`),
              working: t("account.working"),
              checking: t("checkout.checking"),
              errors,
              fallback: t(FALLBACK[mode]),
            }}
          >
            {mode === "register" && view.terms && (
              <details className="rounded-2xl border bg-background">
                <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:hidden">
                  {view.terms.title}
                </summary>
                {/* adr/0019: the backend's own rendering of a checked document */}
                <div
                  className="max-h-56 overflow-y-auto border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: view.terms.html }}
                />
              </details>
            )}
          </AuthForm>
        </div>
        <nav className="flex flex-col items-center gap-2 text-sm">
          {mode === "login" && (
            <>
              <a href={view.links.forgot} className="font-medium underline underline-offset-4">
                {t("account.forgot_link")}
              </a>
              <p className="text-muted-foreground">
                {t("account.no_account")}{" "}
                <a
                  href={view.links.register}
                  className="font-semibold text-foreground underline underline-offset-4"
                >
                  {t("account.register_link")}
                </a>
              </p>
            </>
          )}
          {mode !== "login" && (
            <p className="text-muted-foreground">
              {t("account.have_account")}{" "}
              <a
                href={view.links.login}
                className="font-semibold text-foreground underline underline-offset-4"
              >
                {t("account.login_link")}
              </a>
            </p>
          )}
        </nav>
      </div>
    </PageContainer>
  )
}
