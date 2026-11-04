import { ArrowLeft, Lock } from "lucide-react"
import type { PaymentFramePageView, Translate } from "@qticaret/ui"
import { PaymentFrame } from "@qticaret/ui/components/payment-frame"
import { FoldedSummary, OrderSummary } from "./checkout/OrderSummary"
import { PageContainer } from "./components/Container"

/**
 * The card provider's hosted form, framed on the shop (PayTR iFrame,
 * adr/0026): the card never touches our pages. The frame takes its page's
 * height (PayTR's iframe-resizer messages), so a phone scrolls the page,
 * not a box inside it. The provider sends the shopper on to our result
 * page when it is done.
 */
export function PaymentFramePage({ view, t }: { view: PaymentFramePageView; t: Translate }) {
  return (
    <PageContainer className="flex flex-col gap-8">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b pb-6">
        <h1 className="text-4xl leading-tight lg:text-5xl">{t("checkout.card_title")}</h1>
        <a
          href={view.backPath}
          className="flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("checkout.back_to_checkout")}
        </a>
      </header>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-12">
        <FoldedSummary summary={view.summary} t={t} />
        <section className="flex flex-col gap-4 self-start rounded-3xl border bg-card p-3 sm:p-5">
          <p className="flex items-center gap-2 px-2 pt-1 text-sm text-muted-foreground">
            <Lock className="size-4" aria-hidden="true" />
            {t("checkout.card_note")}
          </p>
          <PaymentFrame
            src={view.frameUrl}
            title={t("checkout.card_frame")}
            className="rounded-2xl bg-white"
          />
        </section>
        <OrderSummary summary={view.summary} t={t} className="hidden lg:flex" />
      </div>
    </PageContainer>
  )
}
