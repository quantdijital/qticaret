import { ArrowRight, LogOut, Package } from "lucide-react"
import type { AccountActions, AccountPageView, AccountOrderView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { AddressesSection } from "./account/AddressesSection"
import { BillingForm } from "./account/BillingForm"
import { PasswordCard } from "./account/PasswordCard"
import { ConsentForm, ProfileForm } from "./account/ProfileForms"
import { PageContainer } from "./components/Container"
import { Pages } from "./components/Pages"

function OrderRow({ order, t }: { order: AccountOrderView; t: Translate }) {
  return (
    <li>
      <a
        href={order.path}
        className="group flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border bg-card p-5 transition-colors hover:border-foreground/30"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Package className="size-5" aria-hidden="true" />
        </span>
        <span className="flex min-w-40 flex-1 flex-col">
          <span className="font-semibold">{t("order.title", { id: order.displayId })}</span>
          <span className="text-sm text-muted-foreground">
            {order.placedAt} · {t("order.quantity", { count: order.itemCount })}
          </span>
        </span>
        <span className="flex flex-wrap gap-1.5 text-xs font-semibold">
          <span className="rounded-full border px-2.5 py-1">{order.status}</span>
          <span className="rounded-full border px-2.5 py-1">{order.paymentStatus}</span>
        </span>
        <span className="tabular font-semibold">{order.total}</span>
        <ArrowRight
          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </a>
    </li>
  )
}

/**
 * The signed-in customer's pages: a side menu (a row on phones) and the
 * section: the latest orders, every order a page at a time, or the
 * customer's details and consents.
 */
export function AccountPage({
  view,
  t,
  actions,
}: {
  view: AccountPageView
  t: Translate
  actions: AccountActions
}) {
  const words = {
    firstName: t("checkout.first_name"),
    lastName: t("checkout.last_name"),
    phone: t("checkout.phone"),
    save: t("account.save"),
    saving: t("checkout.saving"),
    saved: t("account.saved"),
    marketingTitle: t("checkout.marketing_title"),
    marketingEmail: t("checkout.marketing_email"),
    marketingSms: t("checkout.marketing_sms"),
    errors: Object.fromEntries(
      [
        "checkout.phone_invalid",
        "checkout.name_required",
        "account.save_failed",
        "messaging.no_address",
        "errors.too_many_requests",
      ].map((key) => [key, t(key)])
    ),
    fallback: t("account.save_failed"),
  }
  return (
    <PageContainer className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 border-b pb-6">
        <p className="text-sm font-medium text-muted-foreground">{view.email}</p>
        <h1 className="text-4xl leading-tight lg:text-5xl">
          {t("account.hello", { name: view.name })}
        </h1>
      </header>
      {view.notice && (
        <p
          role="status"
          className="rounded-2xl border border-success/30 bg-success/5 p-4 text-sm text-success"
        >
          {view.notice}
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
        <nav aria-label={t("account.menu")} className="flex flex-col gap-4">
          <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
            {view.nav.map((link) => (
              <li key={link.path}>
                <a
                  href={link.path}
                  aria-current={link.current ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors lg:rounded-xl",
                    link.current ? "bg-foreground text-background" : "hover:bg-foreground/5"
                  )}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <form action={actions.logout} className="hidden lg:block">
            <button
              type="submit"
              className="flex h-10 items-center gap-2 px-4 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {t("account.logout")}
            </button>
          </form>
        </nav>

        <div className="flex min-w-0 flex-col gap-6">
          {(view.section === "overview" || view.section === "orders") && (
            <section aria-labelledby="siparislerim" className="flex flex-col gap-4">
              <div className="flex items-end justify-between gap-4">
                <h2 id="siparislerim" className="text-2xl">
                  {view.section === "overview" ? t("account.latest_orders") : t("account.orders")}
                </h2>
                {view.section === "overview" && view.orders.length > 0 && (
                  <a
                    href={view.nav[1]?.path ?? "/hesap/siparisler"}
                    className="text-sm font-medium underline underline-offset-4"
                  >
                    {t("account.all_orders")}
                  </a>
                )}
              </div>
              {view.orders.length === 0 ? (
                <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
                  {t("account.no_orders")}
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {view.orders.map((order) => (
                    <OrderRow key={order.path} order={order} t={t} />
                  ))}
                </ul>
              )}
              {view.pagination && <Pages pagination={view.pagination} t={t} />}
            </section>
          )}
          {view.section === "addresses" && <AddressesSection view={view} actions={actions} t={t} />}
          {view.section === "favorites" && (
            <section aria-labelledby="favoriler" className="flex flex-col gap-4">
              <h2 id="favoriler" className="text-2xl">
                {t("account.favorites")}
              </h2>
              {view.favorites.length === 0 ? (
                <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
                  {t("account.no_favorites")}
                </p>
              ) : (
                <ul className="flex flex-col divide-y rounded-2xl border bg-card">
                  {view.favorites.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-4 p-4 text-sm"
                    >
                      <a
                        href={item.path}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {item.title}
                      </a>
                      <form action={actions.removeFavorite}>
                        <input type="hidden" name="id" value={item.id} />
                        <button type="submit" className="text-muted-foreground underline">
                          {t("cart.remove")}
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {view.section === "profile" && (
            <>
              <PasswordCard t={t} />
              <section
                aria-labelledby="fatura"
                className="flex flex-col gap-5 rounded-3xl border bg-card p-6 sm:p-7"
              >
                <h2 id="fatura" className="text-2xl">
                  {t("account.billing")}
                </h2>
                <BillingForm
                  billing={view.billing}
                  save={actions.saveBilling}
                  words={{
                    individual: t("account.billing_individual"),
                    corporate: t("account.billing_corporate"),
                    name: t("account.billing_name"),
                    company: t("account.billing_company"),
                    taxOffice: t("account.billing_tax_office"),
                    tckn: t("account.billing_tckn"),
                    vkn: t("account.billing_vkn"),
                    current: t("account.billing_current"),
                    save: t("account.save"),
                    saving: t("checkout.saving"),
                    saved: t("account.saved"),
                    errors: Object.fromEntries(
                      [
                        "billing_profile.tax_id_invalid",
                        "billing_profile.tax_office_required",
                        "account.save_failed",
                      ].map((key) => [key, t(key)])
                    ),
                    fallback: t("account.save_failed"),
                  }}
                />
              </section>
              <section
                aria-labelledby="bilgilerim"
                className="flex flex-col gap-5 rounded-3xl border bg-card p-6 sm:p-7"
              >
                <h2 id="bilgilerim" className="text-2xl">
                  {t("account.details")}
                </h2>
                <ProfileForm profile={view.profile} save={actions.saveProfile} words={words} />
              </section>
              <section
                aria-labelledby="kvkk"
                className="flex flex-col gap-4 rounded-3xl border bg-card p-6 text-sm sm:p-7"
              >
                <h2 id="kvkk" className="text-2xl">
                  {t("account.privacy")}
                </h2>
                <p className="text-muted-foreground">{t("account.privacy_text")}</p>
                {view.privacyRequests.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {view.privacyRequests.map((request, index) => (
                      <li key={String(index)}>
                        {request.kind} · {request.status} · {request.received} ·{" "}
                        {t("account.privacy_due", { date: request.due })}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2">
                  <form action={actions.requestPrivacy}>
                    <input type="hidden" name="kind" value="export" />
                    <button type="submit" className="h-10 rounded-full border px-4 font-semibold">
                      {t("account.privacy_export")}
                    </button>
                  </form>
                  <form action={actions.requestPrivacy}>
                    <input type="hidden" name="kind" value="erasure" />
                    <button
                      type="submit"
                      className="h-10 rounded-full border border-sale px-4 font-semibold text-sale"
                    >
                      {t("account.privacy_erasure")}
                    </button>
                  </form>
                </div>
              </section>
              <section
                aria-labelledby="izinler"
                className="flex flex-col gap-5 rounded-3xl border bg-card p-6 sm:p-7"
              >
                <h2 id="izinler" className="text-2xl">
                  {t("account.consents")}
                </h2>
                <ConsentForm profile={view.profile} save={actions.saveConsents} words={words} />
              </section>
            </>
          )}
          <form action={actions.logout} className="lg:hidden">
            <button
              type="submit"
              className="flex h-10 items-center gap-2 text-sm font-medium text-muted-foreground"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {t("account.logout")}
            </button>
          </form>
        </div>
      </div>
    </PageContainer>
  )
}
