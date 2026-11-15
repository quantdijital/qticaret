import { Download, KeyRound, Trash2 } from "lucide-react"
import type { ReactNode } from "react"
import type { AccountActions, AccountPageView, Translate } from "@qticaret/ui"
import { placeholderWords } from "../parts/placeholders"
import { BillingForm } from "./BillingForm"
import { ConsentForm, ProfileForm, type SaveWords } from "./ProfileForms"

/**
 * One part of the details page as a tinted well: from 1024 px its title
 * and what it is for on the left, the form on the right; one column on a
 * phone. Each has an anchor the overview can link to.
 */
function Part({
  id,
  title,
  text,
  children,
}: {
  id: string
  title: string
  text: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-baslik`}
      className="grid scroll-mt-40 gap-5 rounded-tile gf-pane p-5 sm:p-7 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10"
    >
      <div className="flex flex-col gap-2">
        <h2 id={`${id}-baslik`} className="text-title">
          {title}
        </h2>
        <p className="max-w-[44ch] text-md text-text-2">{text}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  )
}

const saveWords = (t: Translate, keys: string[]): SaveWords => ({
  save: t("account.save"),
  saving: t("checkout.saving"),
  saved: t("account.saved"),
  errors: Object.fromEntries(
    [...keys, "account.save_failed", "errors.too_many_requests"].map((key) => [key, t(key)])
  ),
  fallback: t("account.save_failed"),
})

/** The customer's KVKK requests so far, each its kind, state and dates. */
function Requests({ view, t }: { view: AccountPageView; t: Translate }) {
  if (view.privacyRequests.length === 0) {
    return null
  }
  return (
    <ul className="flex flex-col gap-2">
      {view.privacyRequests.map((request, index) => (
        <li
          key={`${request.kind}:${request.received}:${String(index)}`}
          className="flex flex-col gap-1 rounded-media gf-pane-inner p-4 text-sm"
        >
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-md font-extrabold">{request.kind}</span>
            <span className="rounded-pill bg-paper-2 px-2.5 py-1 text-xs font-semibold">
              {request.status}
            </span>
          </span>
          <span className="text-text-2">
            {t("account.privacy_received", { date: request.received })}
          </span>
          <span className="text-text-2">
            {t("account.privacy_due_line", { date: request.due })}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The details page: the name and phone, the password (changed through a
 * link by e-mail), who the invoice is for, the marketing consents, and
 * the KVKK requests (a copy of the data at once; the erasure asked once
 * more in place before it is sent).
 */
export function Profile({
  view,
  t,
  actions,
}: {
  view: AccountPageView
  t: Translate
  actions: AccountActions
}) {
  return (
    <>
      <Part id="kisisel" title={t("account.personal")} text={t("account.personal_text")}>
        <ProfileForm
          profile={view.profile}
          save={actions.saveProfile}
          words={{
            ...saveWords(t, ["checkout.phone_invalid", "checkout.name_required"]),
            firstName: t("checkout.first_name"),
            lastName: t("checkout.last_name"),
            phone: t("checkout.phone"),
            phoneHint: t("checkout.phone_hint"),
            placeholders: placeholderWords(t),
          }}
        />
      </Part>
      <Part id="sifre" title={t("account.password")} text={t("account.password_text")}>
        <a href="/hesap/sifre-sifirla" className="gf-btn gf-btn--quiet self-start">
          <KeyRound className="size-4.5" aria-hidden="true" strokeWidth={2} />
          {t("account.password_link")}
        </a>
      </Part>
      <Part id="fatura" title={t("account.billing")} text={t("account.billing_text")}>
        <BillingForm
          billing={view.billing}
          save={actions.saveBilling}
          words={{
            ...saveWords(t, [
              "billing_profile.tax_id_invalid",
              "billing_profile.tax_office_required",
            ]),
            type: t("account.billing_type"),
            individual: t("account.billing_individual"),
            corporate: t("account.billing_corporate"),
            name: t("account.billing_name"),
            company: t("account.billing_company"),
            taxOffice: t("account.billing_tax_office"),
            tckn: t("account.billing_tckn"),
            vkn: t("account.billing_vkn"),
            current: t("account.billing_current"),
            placeholders: placeholderWords(t),
          }}
        />
      </Part>
      <Part id="izinler" title={t("account.consents")} text={t("account.consents_text")}>
        <ConsentForm
          profile={view.profile}
          save={actions.saveConsents}
          words={{
            ...saveWords(t, ["messaging.no_address"]),
            email: t("checkout.marketing_email"),
            sms: t("checkout.marketing_sms"),
          }}
        />
      </Part>
      <Part id="kvkk" title={t("account.privacy")} text={t("account.privacy_text")}>
        <Requests view={view} t={t} />
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
          <form action={actions.requestPrivacy}>
            <input type="hidden" name="kind" value="export" />
            <button type="submit" className="gf-btn gf-btn--quiet w-full sm:w-auto">
              <Download className="size-4.5" aria-hidden="true" strokeWidth={2} />
              {t("account.privacy_export")}
            </button>
          </form>
          <details className="group">
            <summary className="gf-btn gf-btn--quiet w-full text-error sm:w-auto">
              <Trash2 className="size-4.5 group-open:hidden" aria-hidden="true" strokeWidth={2} />
              <span className="group-open:hidden">{t("account.privacy_erasure")}</span>
              <span className="hidden group-open:inline">{t("account.cancel")}</span>
            </summary>
            <form
              action={actions.requestPrivacy}
              className="mt-3 flex flex-col gap-3 rounded-media gf-pane-inner p-4"
            >
              <input type="hidden" name="kind" value="erasure" />
              <p className="text-sm">{t("account.erasure_confirm")}</p>
              <button
                type="submit"
                className="gf-btn gf-btn--quiet gf-btn--small self-start border-error text-error"
              >
                {t("account.erasure_yes")}
              </button>
            </form>
          </details>
        </div>
      </Part>
    </>
  )
}
