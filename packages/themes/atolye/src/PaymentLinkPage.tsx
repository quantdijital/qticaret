import { ArrowRight, CircleAlert, Clock, Lock } from "lucide-react"
import type { PaymentLinkPageView, Translate } from "@qticaret/ui"
import { Container } from "./parts/Container"
import { LinkLines, LinkTotals } from "./payment-link/LinkLines"

/** A link that opens nothing: one wording whatever the reason (the backend's one 404). */
function Unavailable({ t }: { t: Translate }) {
  return (
    <Container className="pt-8 lg:pt-16">
      <div className="mx-auto flex max-w-2xl flex-col items-start gap-6 rounded-tile gf-pane p-6 sm:p-10">
        <span className="flex size-14 items-center justify-center rounded-pill bg-paper text-text-2">
          <CircleAlert className="size-7" aria-hidden="true" strokeWidth={1.75} />
        </span>
        <h1>{t("payment_link.unavailable_title")}</h1>
        <p className="max-w-[52ch] text-lg text-text-2">{t("payment_link.unavailable_text")}</p>
        <a href="/" className="gf-btn">
          {t("not_found.home")}
          <ArrowRight className="size-5" aria-hidden="true" strokeWidth={1.75} />
        </a>
      </div>
    </Container>
  )
}

/**
 * `/ode/<token>` (adr/0051): the order the shop prepared, its totals in a
 * tinted well and the last moment to pay, then "Ödemeye geç", a plain
 * form whose answer is checkout or this page again with a notice.
 * Without an order: the link opens nothing.
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
    <Container className="pt-8 lg:pt-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-md text-text-2">
            {order.firstName
              ? t("payment_link.greeting", { name: order.firstName })
              : t("payment_link.greeting_plain")}
          </p>
          <h1>{t("payment_link.order", { number: order.number })}</h1>
          <p className="max-w-[56ch] text-md text-text-2 lg:text-lead">{t("payment_link.intro")}</p>
        </header>
        {notice && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-media gf-pane p-4 text-md font-semibold text-error"
          >
            <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" strokeWidth={1.75} />
            {notice}
          </p>
        )}
        <section
          aria-labelledby="odeme-baglantisi-urunler"
          className="flex flex-col gap-5 rounded-tile gf-pane p-4 sm:p-7"
        >
          <h2 id="odeme-baglantisi-urunler">{t("cart.summary")}</h2>
          <LinkLines lines={order.lines} t={t} />
          <LinkTotals order={order} t={t} />
        </section>
        <p className="flex items-center gap-2 text-sm text-text-2">
          <Clock className="size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
          {t("payment_link.expires", { when: order.expires })}
        </p>
        {pay && (
          <form action={action} className="flex flex-col gap-3">
            {pay.fields.map((field) => (
              <input key={field.name} type="hidden" name={field.name} value={field.value} />
            ))}
            {pay.warning && (
              <p role="note" className="rounded-media bg-highlight-soft p-4 text-md font-semibold">
                {pay.warning}
              </p>
            )}
            <button type="submit" className="gf-btn w-full">
              {t("cart.checkout")}
              <ArrowRight className="size-5" aria-hidden="true" strokeWidth={1.75} />
            </button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-text-2">
              <Lock className="size-3.5" aria-hidden="true" strokeWidth={2} />
              {t("cart.secure")}
            </p>
          </form>
        )}
      </div>
    </Container>
  )
}
