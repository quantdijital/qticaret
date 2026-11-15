import type { OrderActions, OrderPageView, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { OrderAside } from "./OrderAside"
import { OrderHero } from "./OrderHero"
import { BankTransfer, CashOnDelivery, OrderLines, Parcels } from "./OrderParts"
import { OrderReturns } from "./OrderReturns"
import { Progress } from "./Progress"

const WELL = "flex flex-col gap-4 rounded-tile gf-pane p-5 sm:p-7"

/** Return requests already made, each with its status and what was refused at receipt. */
function Requests({ view, t }: { view: OrderPageView; t: Translate }) {
  if (view.returns.length === 0) {
    return null
  }
  return (
    <section aria-labelledby="iadeler" className={WELL}>
      <h2 id="iadeler" className="text-title">
        {t("order.returns")}
      </h2>
      <ul className="flex flex-col gap-3 text-sm">
        {view.returns.map((request, index) => (
          <li key={String(index)} className="flex flex-col gap-0.5 rounded-media gf-pane-inner p-4">
            <span className="font-semibold">
              {request.kind}, {request.status}
            </span>
            <span className="text-text-2">{request.date}</span>
            {request.code && <span>{t("order.return_code", { code: request.code })}</span>}
            {request.refused?.map((line, at) => (
              <span key={String(at)} className="text-text-2">
                {line}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The cancel, while the backend allows it; else why not, in its words. */
function Cancel({
  view,
  t,
  actions,
}: {
  view: OrderPageView
  t: Translate
  actions: OrderActions
}) {
  if (view.cancellable) {
    return (
      <form action={actions.cancelOrder} className={WELL}>
        <input type="hidden" name="order_id" value={view.orderId} />
        <input type="hidden" name="token" value={view.token ?? ""} />
        <p className="text-md text-text-2">{view.cancelText ?? t("order.cancel_text")}</p>
        <button type="submit" className="gf-btn gf-btn--quiet self-start text-error">
          {t("order.cancel")}
        </button>
      </form>
    )
  }
  return view.cancelNote ? (
    <p className="rounded-tile gf-pane p-5 text-md sm:p-7">{view.cancelNote}</p>
  ) : null
}

/**
 * An order (`/siparis/{id}?token=`): fresh from checkout, the thank-you
 * page. A graphite opening with the order's number and the thing bought;
 * then where it stands step by step and what happens next, the transfer's
 * account while it waits, the parcels with the carrier's tracking page,
 * what was bought; returns and the cancel below; beside it all, the
 * totals and address, how to find the order again and, for a guest, an
 * account offered quietly.
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
    <Container className="flex flex-col gap-3 pt-6 lg:gap-6 lg:pt-10">
      <OrderHero view={view} t={t} />
      {view.notice && (
        <p role="status" className="rounded-media gf-pane p-4 text-md font-semibold">
          {view.notice}
        </p>
      )}
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-6">
        <div className="flex min-w-0 flex-col gap-3 lg:gap-6">
          <BankTransfer view={view} t={t} />
          {view.progress && <Progress steps={view.progress} t={t} />}
          <CashOnDelivery view={view} t={t} />
          <Parcels view={view} t={t} />
          <OrderLines view={view} t={t} />
          <Requests view={view} t={t} />
          <OrderReturns view={view} t={t} action={actions.requestReturn} />
          <Cancel view={view} t={t} actions={actions} />
        </div>
        <OrderAside view={view} t={t} />
      </div>
    </Container>
  )
}
