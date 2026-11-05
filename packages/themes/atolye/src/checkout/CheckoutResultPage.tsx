import { CircleAlert, Clock, LoaderCircle, type LucideIcon } from "lucide-react"
import type { CheckoutResultPageView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"

const ICONS: Record<CheckoutResultPageView["state"], LucideIcon> = {
  pending: LoaderCircle,
  failed: CircleAlert,
  late: Clock,
  refund: CircleAlert,
}

/**
 * After the card provider: still waiting for its word (the page asks
 * again by itself), waiting too long (the order comes by e-mail), paid
 * but not ordered (refunded), or refused, with the way back to the
 * payment step and the cart kept. One tinted well, its words and one way on.
 */
export function CheckoutResultPage({ view, t }: { view: CheckoutResultPageView; t: Translate }) {
  const Icon = ICONS[view.state]
  return (
    <Container className="pt-8 lg:pt-16">
      <div className="mx-auto flex max-w-2xl flex-col items-start gap-6 rounded-tile bg-paper-2 p-6 sm:p-10">
        <span
          className={cn(
            "flex size-14 items-center justify-center rounded-pill bg-paper",
            view.state === "failed" || view.state === "refund" ? "text-error" : "text-text-2"
          )}
        >
          <Icon
            className={cn("size-7", view.state === "pending" && "animate-spin")}
            aria-hidden="true"
            strokeWidth={1.75}
          />
        </span>
        <h1 className="text-section">{t(`checkout.result_${view.state}`)}</h1>
        <p role="status" className="max-w-[52ch] text-lg text-text-2">
          {t(`checkout.result_${view.state}_text`)}
        </p>
        {view.state === "pending" && view.retryPath && (
          <a href={view.retryPath} className="gf-link">
            {t("checkout.result_check_again")}
          </a>
        )}
        {view.state !== "pending" && (
          <a href={view.backPath} className="gf-btn">
            {view.state === "failed" ? t("checkout.result_try_again") : t("not_found.home")}
          </a>
        )}
      </div>
    </Container>
  )
}
