import { CircleCheck, FileText, HandCoins, Landmark } from "lucide-react"
import { ResponsiveImage } from "@qticaret/ui"
import type { OrderActions, OrderPageView, Translate } from "@qticaret/ui"
import { ReturnForm } from "./account/ReturnForm"
import { Breadcrumbs } from "./components/Breadcrumbs"
import { PageContainer } from "./components/Container"

/** What a transfer still needs: the account, the amount and the reference. */
function BankTransfer({ view, t }: { view: OrderPageView; t: Translate }) {
  const bank = view.bankTransfer
  if (!bank) {
    return null
  }
  return (
    <section
      aria-labelledby="havale"
      className="flex flex-col gap-4 rounded-3xl border-2 border-primary/30 bg-primary/5 p-6 sm:p-7"
    >
      <h2 id="havale" className="flex items-center gap-2.5 text-2xl">
        <Landmark className="size-5 text-primary" aria-hidden="true" />
        {t("order.bank_title")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t("order.bank_text", { hours: bank.deadlineHours, id: view.displayId })}
      </p>
      <dl className="tabular grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-0.5 rounded-2xl bg-card p-4">
          <dt className="text-xs text-muted-foreground">{t("order.bank_name")}</dt>
          <dd className="font-medium">{bank.bankName}</dd>
        </div>
        <div className="flex flex-col gap-0.5 rounded-2xl bg-card p-4">
          <dt className="text-xs text-muted-foreground">{t("order.bank_holder")}</dt>
          <dd className="font-medium">{bank.accountHolder}</dd>
        </div>
        <div className="flex flex-col gap-0.5 rounded-2xl bg-card p-4 sm:col-span-2">
          <dt className="text-xs text-muted-foreground">IBAN</dt>
          <dd className="font-mono text-base font-semibold tracking-wide select-all">
            {bank.iban}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5 rounded-2xl bg-card p-4">
          <dt className="text-xs text-muted-foreground">{t("order.bank_amount")}</dt>
          <dd className="text-base font-semibold">{bank.amount}</dd>
        </div>
        <div className="flex flex-col gap-0.5 rounded-2xl bg-card p-4">
          <dt className="text-xs text-muted-foreground">{t("order.bank_reference")}</dt>
          <dd className="text-base font-semibold">#{view.displayId}</dd>
        </div>
      </dl>
    </section>
  )
}

/**
 * An order, opened with its key (adr/0037 §2): fresh from checkout it
 * thanks the shopper first; then what to do for a transfer, the lines,
 * the totals, where it goes and its documents.
 */
export function OrderPage({
  view,
  t,
  actions,
}: {
  view: OrderPageView
  t: Translate
  actions: OrderActions
}) {
  return (
    <PageContainer className="flex flex-col gap-8">
      <Breadcrumbs items={view.breadcrumbs} t={t} />
      <header className="flex flex-col gap-4 border-b pb-8">
        {view.fresh && (
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <CircleCheck className="size-5" aria-hidden="true" />
            {t("order.received")}
          </p>
        )}
        <h1 className="text-4xl leading-tight lg:text-5xl">
          {view.fresh ? t("order.thanks") : t("order.title", { id: view.displayId })}
        </h1>
        <p className="text-muted-foreground">
          {t("order.meta", { id: view.displayId, date: view.placedAt, email: view.email })}
        </p>
        <ul className="flex flex-wrap gap-2 text-xs font-semibold">
          <li className="rounded-full border bg-card px-3 py-1.5">{view.status}</li>
          <li className="rounded-full border bg-card px-3 py-1.5">{view.paymentStatus}</li>
        </ul>
      </header>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-12">
        <div className="flex flex-col gap-6">
          <BankTransfer view={view} t={t} />
          {view.cashOnDelivery && (
            <p className="flex items-start gap-3 rounded-3xl border bg-card p-5 text-sm">
              <HandCoins className="size-5 shrink-0 text-primary" aria-hidden="true" />
              {t("order.cod_text", { amount: view.total })}
            </p>
          )}
          <section aria-labelledby="urunler" className="rounded-3xl border bg-card p-6 sm:p-7">
            <h2 id="urunler" className="mb-2 text-2xl">
              {t("order.lines")}
            </h2>
            <ul className="divide-y">
              {view.lines.map((line, index) => (
                <li key={`${String(index)}:${line.title}`} className="flex items-center gap-4 py-4">
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl border bg-muted/50">
                    {line.image ? (
                      <ResponsiveImage
                        image={line.image}
                        sizes="64px"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="font-heading flex h-full items-center justify-center text-2xl text-foreground/15"
                      >
                        {line.title.charAt(0).toLocaleUpperCase("tr")}
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col text-sm">
                    <span className="font-medium">{line.title}</span>
                    <span className="text-muted-foreground">
                      {[line.detail, t("order.quantity", { count: line.quantity })]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <span className="tabular text-sm font-semibold">{line.total}</span>
                </li>
              ))}
            </ul>
          </section>
          {view.notice && (
            <p role="status" className="rounded-2xl border bg-card p-4 text-sm">
              {view.notice}
            </p>
          )}
          {view.shipments.length > 0 && (
            <section aria-labelledby="kargo" className="rounded-3xl border bg-card p-6 sm:p-7">
              <h2 id="kargo" className="mb-3 text-2xl">
                {t("order.shipments")}
              </h2>
              <ul className="flex flex-col gap-4 text-sm">
                {view.shipments.map((parcel, index) => (
                  <li key={String(index)} className="flex flex-col gap-1">
                    <span className="font-medium">
                      {[parcel.carrier, parcel.status].filter(Boolean).join(" · ")}
                    </span>
                    {parcel.trackingNumber && (
                      <span>
                        {t("order.tracking_number", { number: parcel.trackingNumber })}
                        {parcel.trackingUrl && (
                          <>
                            {" · "}
                            <a
                              href={parcel.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium underline underline-offset-4"
                            >
                              {t("order.track")}
                            </a>
                          </>
                        )}
                      </span>
                    )}
                    <span className="text-muted-foreground">{parcel.items}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {view.returns.length > 0 && (
            <section aria-labelledby="iadeler" className="rounded-3xl border bg-card p-6 sm:p-7">
              <h2 id="iadeler" className="mb-3 text-2xl">
                {t("order.returns")}
              </h2>
              <ul className="flex flex-col gap-2 text-sm">
                {view.returns.map((request, index) => (
                  <li key={String(index)}>
                    {request.kind} · {request.status} · {request.date}
                    {request.code && ` · ${t("order.return_code", { code: request.code })}`}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {view.returnable && (
            <details className="rounded-3xl border bg-card p-6 sm:p-7">
              <summary className="cursor-pointer text-lg font-semibold">
                {t("order.return_title")}
              </summary>
              <div className="mt-4">
                <ReturnForm
                  view={view}
                  action={actions.requestReturn}
                  words={{
                    title: t("order.return_title"),
                    quantity: t("cart.quantity"),
                    reason: t("order.return_reason"),
                    note: t("order.return_note"),
                    kindReturn: t("order.return_kind_return"),
                    kindExchange: t("order.return_kind_exchange"),
                    submit: t("order.return_submit"),
                    sending: t("checkout.saving"),
                    sent: t("order.return_sent"),
                    errors: Object.fromEntries(
                      [
                        "order.return_reason_required",
                        "order.return_items_required",
                        "order.return_failed",
                        "errors.too_many_requests",
                      ].map((key) => [key, t(key)])
                    ),
                    fallback: t("order.return_failed"),
                  }}
                />
              </div>
            </details>
          )}
          {view.cancellable && (
            <form
              action={actions.cancelOrder}
              className="rounded-3xl border bg-card p-6 text-sm sm:p-7"
            >
              <input type="hidden" name="order_id" value={view.orderId} />
              <input type="hidden" name="token" value={view.token ?? ""} />
              <p className="mb-3 text-muted-foreground">{t("order.cancel_text")}</p>
              <button
                type="submit"
                className="h-10 rounded-full border border-sale px-5 font-semibold text-sale hover:bg-sale/5"
              >
                {t("order.cancel")}
              </button>
            </form>
          )}
          {view.documents.length > 0 && (
            <section aria-labelledby="belgeler" className="rounded-3xl border bg-card p-6 sm:p-7">
              <h2 id="belgeler" className="mb-4 text-2xl">
                {t("order.documents")}
              </h2>
              <ul className="flex flex-col gap-2 text-sm">
                {view.documents.map((document) => (
                  <li key={document.path}>
                    <a
                      href={document.path}
                      className="flex items-center gap-2 font-medium underline-offset-4 hover:underline"
                    >
                      <FileText className="size-4" aria-hidden="true" />
                      {document.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside className="flex h-fit flex-col gap-5 rounded-3xl border bg-card p-6 text-sm lg:p-7">
          <h2 className="text-2xl">{t("order.summary")}</h2>
          <dl className="tabular flex flex-col gap-3">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("cart.items")}</dt>
              <dd>{view.items}</dd>
            </div>
            {view.discount && (
              <div className="flex justify-between text-sale">
                <dt>{t("cart.discount")}</dt>
                <dd>−{view.discount}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("cart.shipping")}</dt>
              <dd>{view.shipping}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t pt-4">
              <dt className="font-medium">{t("checkout.total")}</dt>
              <dd className="text-xl font-semibold">{view.total}</dd>
            </div>
          </dl>
          {view.address && (
            <div className="flex flex-col gap-1 border-t pt-5">
              <h3 className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                {t("order.delivery")}
              </h3>
              <address className="flex flex-col gap-0.5 not-italic">
                <span className="font-medium">{view.address.name}</span>
                {view.address.lines.map((line) => (
                  <span key={line} className="text-muted-foreground">
                    {line}
                  </span>
                ))}
                <span className="text-muted-foreground">{view.address.phone}</span>
              </address>
            </div>
          )}
        </aside>
      </div>
    </PageContainer>
  )
}
