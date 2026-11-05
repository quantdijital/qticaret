import {
  CircleAlert,
  CircleCheck,
  Heart,
  MailCheck,
  MapPin,
  Package,
  RotateCcw,
} from "lucide-react"
import type { AuthActions, AuthMode, AuthPageView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { placeholderWords } from "../parts/placeholders"
import { AuthForm, type AuthFormWords } from "./AuthForm"
import { LookupPage } from "./LookupPage"

const ERRORS = [
  "account.login_failed",
  "account.register_failed",
  "account.email_taken",
  "account.email_required",
  "account.password_required",
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
  lookup: "account.lookup_failed",
}

/** What an account does here, each a thing the shop's pages really do. */
const PERKS = [
  { icon: Package, key: "account.perk_orders" },
  { icon: MapPin, key: "account.perk_addresses" },
  { icon: Heart, key: "account.perk_favorites" },
  { icon: RotateCcw, key: "account.perk_returns" },
] as const

const formWords = (t: Translate, mode: AuthMode): AuthFormWords => ({
  email: t("checkout.email"),
  password: t("account.password"),
  passwordHint: t("account.password_hint"),
  newPassword: t("account.new_password"),
  firstName: t("checkout.first_name"),
  lastName: t("checkout.last_name"),
  phone: `${t("checkout.phone")} ${t("account.optional")}`,
  phoneHint: t("account.mobile_hint"),
  code: t("account.code"),
  accept: t("account.accept_terms"),
  read: t("checkout.read"),
  privacy: t("account.privacy_intro"),
  privacyLink: t("newsletter.privacy_link"),
  forgot: t("account.forgot_link"),
  show: t("account.show_password"),
  hide: t("account.hide_password"),
  submit: t(`account.${mode}_submit`),
  working: t("account.working"),
  checking: t("checkout.checking"),
  errors: Object.fromEntries(ERRORS.map((key) => [key, t(key)])),
  fallback: t(FALLBACK[mode]),
  placeholders: placeholderWords(t),
})

/** What an account does, on the graphite side from 1024 px and under the form on a phone. */
function Perks({ t, stage }: { t: Translate; stage: boolean }) {
  return (
    <>
      <h2 className="text-title">{t("account.perks_title")}</h2>
      <ul className="flex flex-col gap-3">
        {PERKS.map(({ icon: Icon, key }) => (
          <li key={key} className="flex items-start gap-3 text-md">
            <Icon
              className={cn("mt-0.5 size-5 shrink-0", stage ? "text-stage-text-2" : "text-text-2")}
              aria-hidden="true"
              strokeWidth={1.75}
            />
            {t(key)}
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * The way to the other form, under the form in the well: a login's
 * register (and the guest's order lookup), a register's login, the rest
 * back to the login. One quiet full-width pill under the primary one.
 */
function OtherWay({ view, t }: { view: AuthPageView; t: Translate }) {
  const quiet = "gf-btn gf-btn--quiet w-full"
  if (view.mode === "login" || view.mode === "register") {
    const login = view.mode === "login"
    return (
      <div className="flex flex-col gap-3 border-t border-rule pt-6">
        <h2 className="text-md font-extrabold tracking-[-0.01em]">
          {t(login ? "account.no_account" : "account.have_account")}
        </h2>
        <a href={login ? view.links.register : view.links.login} className={quiet}>
          {t(login ? "account.register_link" : "account.login_link")}
        </a>
        {login && (
          <a href="/siparis" className="gf-link self-start text-sm">
            {t("account.guest_order_link")}
          </a>
        )}
      </div>
    )
  }
  return (
    <a href={view.links.login} className="gf-link self-start">
      {t("account.back_to_login")}
    </a>
  )
}

/** A line already in words over the form: a link sent, a password changed, an invite. */
function Notice({ text, error }: { text: string; error: boolean }) {
  const Icon = error ? CircleAlert : CircleCheck
  return (
    <p
      role={error ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-media bg-field p-4 text-md font-semibold",
        error && "text-error"
      )}
    >
      <Icon
        className={cn("mt-0.5 size-5 shrink-0", !error && "text-ok")}
        aria-hidden="true"
        strokeWidth={1.75}
      />
      {text}
    </p>
  )
}

/**
 * Signing in, registering, the e-mail's verification and the password's
 * reset: one panel, the same for each (owner 2026-11-05: the login reads
 * as the register's sibling). Its graphite side holds the page's title
 * and line, and from 1024 px what an account does; its well the form,
 * then the way to the other form as a quiet pill under the primary one.
 * Phone first: one column, the form right under the title, 48 px fields
 * with their examples inside, the button full width, each refusal under
 * its field in words, what an account does last. The order lookup is its
 * own page.
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
  if (view.mode === "lookup") {
    return <LookupPage view={view} t={t} actions={actions} />
  }
  const { mode } = view
  const sent = mode === "verify" && view.notice !== null && view.token === null
  // A reset link without its key cannot set a password: the way is a new link
  const deadLink = mode === "reset" && view.token === null
  const perks = mode === "login" || mode === "register"
  return (
    <Container className="pt-6 lg:pt-12">
      <div className="mx-auto grid max-w-[64rem] overflow-hidden rounded-tile bg-paper-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="gf-stage flex flex-col justify-between gap-10 p-6 sm:p-8 lg:p-10">
          <header className="flex flex-col gap-3">
            {sent && (
              <span className="mb-2 flex size-14 items-center justify-center rounded-pill bg-stage-2">
                <MailCheck className="size-6" aria-hidden="true" strokeWidth={1.75} />
              </span>
            )}
            <h1>{t(`account.${mode}_title`)}</h1>
            <p className="max-w-[40ch] text-md text-stage-text-2 lg:text-lead">
              {t(`account.${mode}_text`)}
            </p>
          </header>
          {perks && (
            <div className="hidden flex-col gap-4 lg:flex">
              <Perks t={t} stage />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-6 p-5 sm:p-8 lg:p-10">
          {view.notice && <Notice text={view.notice} error={deadLink} />}
          {deadLink ? (
            <a href={view.links.forgot} className="gf-btn w-full">
              {t("account.reset_again")}
            </a>
          ) : (
            <AuthForm
              view={view}
              action={actions[mode]}
              words={formWords(t, mode)}
              forgotPath={mode === "login" ? view.links.forgot : undefined}
            />
          )}
          <OtherWay view={view} t={t} />
          {perks && (
            <div className="flex flex-col gap-4 border-t border-rule pt-6 lg:hidden">
              <Perks t={t} stage={false} />
            </div>
          )}
        </div>
      </div>
    </Container>
  )
}
