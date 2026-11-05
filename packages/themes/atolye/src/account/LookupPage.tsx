import { CircleCheck, ExternalLink } from "lucide-react"
import type { AuthActions, AuthPageView, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { placeholderWords } from "../parts/placeholders"
import { LookupForm } from "./LookupForm"

const LOOKUP_ERRORS = [
  "account.lookup_failed",
  "checkout.email_invalid",
  "fraud.refused",
  "fraud.velocity",
  "errors.too_many_requests",
  "errors.challenge_failed",
]

/**
 * Order tracking without an account (`/siparis`): the order number and
 * the e-mail in a tinted well, the order's link sent there (it opens the
 * order with its steps and the carrier's tracking page); beside it a
 * graphite stage with the shop's carriers' own tracking pages, for a
 * shopper who holds a tracking number. Signing in leads to every order.
 */
export function LookupPage({
  view,
  t,
  actions,
}: {
  view: AuthPageView
  t: Translate
  actions: AuthActions
}) {
  const carriers = view.carriers ?? []
  return (
    <Container className="pt-8 lg:pt-12">
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-6">
        <section
          aria-labelledby="siparis-bul"
          className="flex flex-col gap-6 rounded-tile bg-paper-2 p-5 sm:p-8 lg:p-10"
        >
          <h1 id="siparis-bul" className="text-section">
            {t("account.lookup_title")}
          </h1>
          <p className="max-w-[56ch] text-lg text-text-2">{t("account.lookup_text")}</p>
          {view.notice && (
            <p
              role="status"
              className="flex items-start gap-3 rounded-media bg-field p-4 text-md font-semibold"
            >
              <CircleCheck
                className="mt-0.5 size-5 shrink-0 text-ok"
                aria-hidden="true"
                strokeWidth={1.75}
              />
              {view.notice}
            </p>
          )}
          <div className="max-w-xl">
            <LookupForm
              action={actions.lookup}
              words={{
                orderNumber: t("account.order_number"),
                orderHint: t("account.lookup_order_hint"),
                email: t("checkout.email"),
                submit: t("account.lookup_submit"),
                working: t("account.working"),
                checking: t("checkout.checking"),
                errors: Object.fromEntries(LOOKUP_ERRORS.map((key) => [key, t(key)])),
                fallback: t("account.lookup_failed"),
                placeholders: placeholderWords(t),
              }}
            />
          </div>
          <p className="text-md text-text-2">
            {t("account.have_account")}{" "}
            <a
              href={view.links.login}
              className="font-semibold text-text underline underline-offset-4"
            >
              {t("account.login_link")}
            </a>
          </p>
        </section>
        {carriers.length > 0 && (
          <aside
            aria-labelledby="kargo-takip"
            className="gf-stage flex flex-col gap-5 rounded-tile p-5 sm:p-8"
          >
            <h2 id="kargo-takip" className="text-title">
              {t("account.lookup_track_title")}
            </h2>
            <p className="text-md text-stage-text-2">{t("account.lookup_track_text")}</p>
            <ul className="flex flex-col gap-2">
              {carriers.map((carrier) => (
                <li key={carrier.path}>
                  <a
                    href={carrier.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="gf-btn gf-btn--quiet w-full justify-between"
                  >
                    {carrier.label}
                    <ExternalLink className="size-4.5" aria-hidden="true" strokeWidth={2} />
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </Container>
  )
}
