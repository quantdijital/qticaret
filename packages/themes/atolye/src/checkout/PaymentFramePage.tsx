import { ArrowLeft, Lock } from "lucide-react"
import type { PaymentFramePageView, Translate } from "@qticaret/ui"
import { PaymentFrame } from "@qticaret/ui/components/payment-frame"
import { Container } from "../parts/Container"
import { FoldedSummary, Summary } from "./Summary"

/**
 * The card provider's hosted form, framed on the shop (PayTR iFrame,
 * adr/0026): the card never touches our pages. The frame takes its page's
 * height (PayTR's resizer messages), so a phone scrolls the page, never a
 * box inside it; it sits on a light field, the provider's own colours.
 * The way back to the payment step stays above it.
 */
export function PaymentFramePage({ view, t }: { view: PaymentFramePageView; t: Translate }) {
  return (
    <Container className="flex flex-col gap-6 pt-6 lg:gap-8 lg:pt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-section">{t("checkout.card_title")}</h1>
        <a href={view.backPath} className="gf-link text-sm">
          <ArrowLeft className="size-4" aria-hidden="true" strokeWidth={2} />
          {t("checkout.back_to_checkout")}
        </a>
      </div>
      <div className="grid items-start gap-(--gap-columns) lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-3">
          <FoldedSummary summary={view.summary} t={t} />
          <section
            aria-labelledby="kart-formu"
            className="flex flex-col gap-4 rounded-tile bg-paper-2 p-2 sm:p-4"
          >
            <h2
              id="kart-formu"
              className="flex items-center gap-2 px-3 pt-2 text-sm font-semibold tracking-normal text-text-2"
            >
              <Lock className="size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
              {t("checkout.card_note")}
            </h2>
            <PaymentFrame
              src={view.frameUrl}
              title={t("checkout.card_frame")}
              className="rounded-media bg-chip"
            />
          </section>
        </div>
        <Summary summary={view.summary} t={t} className="hidden lg:flex" />
      </div>
    </Container>
  )
}
