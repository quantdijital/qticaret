import { ArrowRight, CircleAlert, Clock, Lock } from "lucide-react"
import type { PaymentLinkOrderView, PaymentLinkPageView, Translate } from "@qticaret/ui"
import { Button } from "@qticaret/ui/components/button"
import { PageContainer } from "./components/Container"
import { LinkLines } from "./payment-link/LinkLines"

/** A link that opens nothing: one wording whatever the reason (the backend's one 404). */
function Unavailable({ t }: { t: Translate }) {
  return (
    <PageContainer>
      <div className="mx-auto flex max-w-lg flex-col items-center gap-5 py-16 text-center lg:py-24">
        <span className="flex size-20 items-center justify-center rounded-full border bg-card">
          <CircleAlert className="size-8 text-muted-foreground" aria-hidden="true" />
        </span>
        <h1 className="text-3xl leading-tight lg:text-4xl">
          {t("payment_link.unavailable_title")}
        </h1>
        <p className="text-muted-foreground">{t("payment_link.unavailable_text")}</p>
        <Button asChild size="lg" className="h-12 rounded-button px-7">
          <a href="/">
            {t("not_found.home")}
            <ArrowRight aria-hidden="true" />
          </a>
        </Button>
      </div>
    </PageContainer>
  )
}

function Totals({ order, t }: { order: PaymentLinkOrderView; t: Translate }) {
  return (
    <dl className="tabular flex flex-col gap-3 border-t pt-5 text-sm">
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">{t("cart.items")}</dt>
        <dd>{order.items}</dd>
      </div>
      {order.discount && (
        <div className="flex justify-between gap-4 text-sale">
          <dt>{t("cart.discount")}</dt>
          <dd>−{order.discount}</dd>
        </div>
      )}
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">{t("cart.shipping")}</dt>
        <dd className="text-right text-muted-foreground">
          {order.shippingPreset
            ? t("payment_link.shipping_preset")
            : t("payment_link.shipping_at_checkout")}
        </dd>
      </div>
      <div className="flex items-baseline justify-between gap-4 border-t pt-4">
        <dt className="font-medium">{t("cart.total")}</dt>
        <dd className="text-xl font-semibold">{order.total}</dd>
      </div>
    </dl>
  )
}

/**
 * `/ode/<token>` (adr/0051): the order the shop prepared, its totals and
 * the last moment to pay, then "Ödemeye geç", a plain form whose answer
 * is checkout or this page again with a notice. Without an order: the
 * link opens nothing.
 */
export function PaymentLinkPage({
  view,
  t,
  action,
}: {
  view: PaymentLinkPageView
  t: Translate
  action: (form: FormData) => Promise<void>
}) {
  const { order, notice, pay } = view
  if (!order) {
    return <Unavailable t={t} />
  }
  return (
    <PageContainer>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-muted-foreground">
            {order.firstName
              ? t("payment_link.greeting", { name: order.firstName })
              : t("payment_link.greeting_plain")}
          </p>
          <h1 className="text-4xl leading-tight">
            {t("payment_link.order", { number: order.number })}
          </h1>
          <p className="text-muted-foreground">{t("payment_link.intro")}</p>
        </header>
        {notice && (
          <p
            role="alert"
            className="rounded-2xl border border-sale/30 bg-sale/5 p-4 text-sm text-sale"
          >
            {notice}
          </p>
        )}
        <section
          aria-labelledby="odeme-baglantisi-urunler"
          className="flex flex-col gap-5 rounded-3xl border bg-card p-5 sm:p-7"
        >
          <h2 id="odeme-baglantisi-urunler" className="text-2xl">
            {t("cart.summary")}
          </h2>
          <LinkLines lines={order.lines} t={t} />
          <Totals order={order} t={t} />
        </section>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          {t("payment_link.expires", { when: order.expires })}
        </p>
        {pay && (
          <form action={action} className="flex flex-col gap-3">
            {pay.fields.map((field) => (
              <input key={field.name} type="hidden" name={field.name} value={field.value} />
            ))}
            {pay.warning && (
              <p role="note" className="rounded-xl border p-3 text-sm">
                {pay.warning}
              </p>
            )}
            <Button type="submit" size="lg" className="h-13 rounded-button text-base">
              {t("cart.checkout")}
              <ArrowRight aria-hidden="true" />
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" aria-hidden="true" />
              {t("cart.secure")}
            </p>
          </form>
        )}
      </div>
    </PageContainer>
  )
}
