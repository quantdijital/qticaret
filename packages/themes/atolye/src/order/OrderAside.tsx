import { FileText, UserRoundPlus } from "lucide-react"
import type { OrderPageView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

const WELL = "flex flex-col gap-5 rounded-tile bg-paper-2 p-5 sm:p-7"

function Totals({ view, t }: { view: OrderPageView; t: Translate }) {
  const row = "flex items-baseline justify-between gap-4"
  return (
    <dl className="flex flex-col gap-3 text-md">
      <div className={row}>
        <dt className="text-text-2">{t("cart.items")}</dt>
        <dd className="tabular font-semibold">{view.items}</dd>
      </div>
      {view.discount && (
        <div className={cn(row, "text-deal")}>
          <dt>{t("cart.discount")}</dt>
          <dd className="tabular font-semibold">−{view.discount}</dd>
        </div>
      )}
      <div className={row}>
        <dt className="text-text-2">{t("cart.shipping")}</dt>
        <dd className="tabular font-semibold">{view.shipping}</dd>
      </div>
      <div className={cn(row, "mt-2 border-t border-rule pt-4")}>
        <dt className="font-semibold">{t("checkout.total")}</dt>
        <dd className="tabular text-title font-extrabold">{view.total}</dd>
      </div>
    </dl>
  )
}

/**
 * Beside the order: what it cost and where it goes; how to find it again
 * (a guest: the e-mail's link, or "Siparişimi bul"; a customer: the
 * account); for a guest, the account offered quietly; the order's
 * documents (the contracts kept, the invoice).
 */
export function OrderAside({ view, t }: { view: OrderPageView; t: Translate }) {
  return (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-44">
      <section aria-labelledby="odeme-ozeti" className={WELL}>
        <h2 id="odeme-ozeti" className="text-title">
          {t("order.summary")}
        </h2>
        <Totals view={view} t={t} />
        {view.address && (
          <div className="flex flex-col gap-1 rounded-media bg-field p-4 text-sm">
            <h3 className="text-sm font-semibold tracking-normal text-text-2">
              {t("order.delivery")}
            </h3>
            <address className="flex flex-col gap-0.5 not-italic">
              <span className="font-semibold">{view.address.name}</span>
              {view.address.lines.filter(Boolean).map((line) => (
                <span key={line}>{line}</span>
              ))}
              <span>{view.address.phone}</span>
            </address>
          </div>
        )}
      </section>
      <section aria-labelledby="siparis-takip" className={WELL}>
        <h2 id="siparis-takip" className="text-title">
          {t("order.track_title")}
        </h2>
        <p className="text-md text-text-2">
          {t(view.guest ? "order.track_guest" : "order.track_account")}
        </p>
        <a href={view.guest ? "/siparis" : "/hesap/siparisler"} className="gf-link self-start">
          {t(view.guest ? "menu.system.order_lookup" : "account.orders")}
        </a>
      </section>
      {view.guest && (
        <section
          aria-labelledby="hesap-teklifi"
          className="flex flex-col gap-4 rounded-tile bg-signal-soft p-5 sm:p-7"
        >
          <h2 id="hesap-teklifi" className="flex items-center gap-3 text-title">
            <UserRoundPlus className="size-6 shrink-0" aria-hidden="true" strokeWidth={1.75} />
            {t("order.account_title")}
          </h2>
          <p className="text-md">{t("order.account_text")}</p>
          <a href="/hesap/kayit" className="gf-btn gf-btn--quiet self-start">
            {t("order.account_create")}
          </a>
        </section>
      )}
      {view.documents.length > 0 && (
        <section aria-labelledby="belgeler" className={WELL}>
          <h2 id="belgeler" className="text-title">
            {t("order.documents")}
          </h2>
          <ul className="flex flex-col">
            {view.documents.map((document) => (
              <li key={document.path}>
                <a href={document.path} className="gf-link text-md">
                  <FileText className="size-4.5 shrink-0" aria-hidden="true" strokeWidth={1.75} />
                  {document.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}
