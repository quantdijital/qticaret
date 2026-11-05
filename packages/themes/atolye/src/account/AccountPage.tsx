import { ChevronLeft, CircleCheck } from "lucide-react"
import type { AccountActions, AccountPageView, Translate } from "@qticaret/ui"
import { Pager } from "../listing/Pager"
import { Container } from "../parts/Container"
import { Hub, SideNav } from "./AccountNav"
import { Addresses } from "./Addresses"
import { Favorites } from "./Favorites"
import { LatestOrder } from "./LatestOrder"
import { NoOrders, OrderRow } from "./Orders"
import { Profile } from "./Profile"
import { StartAisles } from "./StartAisles"

interface Page {
  view: AccountPageView
  t: Translate
  actions: AccountActions
}

/** A line already in words over the page: welcome, a request received. */
function Notice({ text }: { text: string }) {
  return (
    <p
      role="status"
      className="flex items-start gap-3 rounded-media bg-paper-2 p-4 text-md font-semibold"
    >
      <CircleCheck
        className="mt-0.5 size-5 shrink-0 text-ok"
        aria-hidden="true"
        strokeWidth={1.75}
      />
      {text}
    </p>
  )
}

/**
 * The overview (`/hesap`): the greeting, the latest order on a graphite
 * stage with its steps (none yet: the way to the shop), beside it from
 * 1024 px the sections as rows (on a phone, under it: the account's menu
 * there), then the other recent orders, or the shop's categories.
 */
function Overview({ view, t, actions }: Page) {
  const [latest, ...earlier] = view.orders
  const all = view.nav.find((link) => link.section === "orders")
  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-section">{t("account.hello", { name: view.name })}</h1>
        <p className="text-md break-all text-text-2">{view.email}</p>
      </header>
      {view.notice && <Notice text={view.notice} />}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        {latest ? <LatestOrder order={latest} t={t} /> : <NoOrders t={t} />}
        <Hub view={view} t={t} actions={actions} />
      </div>
      {earlier.length > 0 && (
        <section aria-labelledby="onceki-siparisler" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <h2 id="onceki-siparisler" className="text-title">
              {t("account.earlier_orders")}
            </h2>
            {all && (
              <a href={all.path} className="gf-link text-sm">
                {t("account.all_orders")}
              </a>
            )}
          </div>
          <ul className="flex flex-col gap-3">
            {earlier.map((order) => (
              <OrderRow key={order.path} order={order} t={t} />
            ))}
          </ul>
        </section>
      )}
      {!latest && (
        <StartAisles
          id="hesap-kategoriler"
          title={t("home.shop_categories")}
          categories={view.categories ?? []}
        />
      )}
    </div>
  )
}

/** Every order, ten a page; none yet: the way to the shop and its categories. */
function Orders({ view, t }: Page) {
  if (view.orders.length === 0) {
    return (
      <>
        <NoOrders t={t} />
        <StartAisles
          id="siparis-kategoriler"
          title={t("home.shop_categories")}
          categories={view.categories ?? []}
        />
      </>
    )
  }
  return (
    <>
      <ul className="flex flex-col gap-3">
        {view.orders.map((order) => (
          <OrderRow key={order.path} order={order} t={t} />
        ))}
      </ul>
      {view.pagination && <Pager pagination={view.pagination} t={t} />}
    </>
  )
}

/**
 * The signed-in customer's pages. The overview is the account's hub; a
 * section stands beside the account's menu from 1024 px, and on a phone
 * under a 44 px way back to the overview (the bottom bar's "Hesabım"),
 * its title the page's one heading.
 */
export function AccountPage({ view, t, actions }: Page) {
  if (view.section === "overview") {
    return (
      <Container className="pt-6 lg:pt-10">
        <Overview view={view} t={t} actions={actions} />
      </Container>
    )
  }
  const current = view.nav.find((link) => link.current)
  const home = view.nav.find((link) => link.section === "overview")
  return (
    <Container className="pt-4 lg:pt-10">
      <div className="grid gap-6 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-12">
        <SideNav view={view} t={t} actions={actions} />
        <div className="flex min-w-0 flex-col gap-6 lg:gap-8">
          <header className="flex flex-col gap-1">
            {home && (
              <a
                href={home.path}
                className="inline-flex min-h-11 items-center gap-1 self-start text-sm text-text-2 hover:text-text lg:hidden"
              >
                <ChevronLeft className="size-4" aria-hidden="true" strokeWidth={2} />
                {t("account.title")}
              </a>
            )}
            <h1 className="text-section">{current?.label ?? t("account.title")}</h1>
          </header>
          {view.notice && <Notice text={view.notice} />}
          {view.section === "orders" && <Orders view={view} t={t} actions={actions} />}
          {view.section === "favorites" && <Favorites view={view} t={t} actions={actions} />}
          {view.section === "addresses" && <Addresses view={view} t={t} actions={actions} />}
          {view.section === "profile" && <Profile view={view} t={t} actions={actions} />}
        </div>
      </div>
    </Container>
  )
}
