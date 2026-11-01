import { CircleAlert, Clock, LoaderCircle } from "lucide-react"
import type { CheckoutResultPageView, Translate } from "@qticaret/ui"
import { Button } from "@qticaret/ui/components/button"
import { PageContainer } from "./components/Container"

/**
 * After the card provider: still waiting for its notice (the page looks
 * again by itself), waiting too long (the order comes by e-mail), or a
 * refused payment with the way back to checkout.
 */
export function CheckoutResultPage({ view, t }: { view: CheckoutResultPageView; t: Translate }) {
  const Icon =
    view.state === "failed" || view.state === "refund"
      ? CircleAlert
      : view.state === "late"
        ? Clock
        : LoaderCircle
  return (
    <PageContainer>
      <div className="mx-auto flex max-w-lg flex-col items-center gap-5 py-16 text-center lg:py-24">
        <span className="flex size-20 items-center justify-center rounded-full border bg-card">
          <Icon
            className={
              view.state === "pending"
                ? "size-8 animate-spin text-muted-foreground"
                : view.state === "failed"
                  ? "size-8 text-sale"
                  : "size-8 text-muted-foreground"
            }
            aria-hidden="true"
          />
        </span>
        <h1 className="text-3xl leading-tight lg:text-4xl">{t(`checkout.result_${view.state}`)}</h1>
        <p role="status" className="text-muted-foreground">
          {t(`checkout.result_${view.state}_text`)}
        </p>
        {view.state === "pending" && view.retryPath && (
          <a href={view.retryPath} className="text-sm font-medium underline underline-offset-4">
            {t("checkout.result_check_again")}
          </a>
        )}
        {view.state !== "pending" && (
          <Button asChild size="lg" className="h-12 rounded-full px-7">
            <a href={view.backPath}>
              {view.state === "failed" ? t("checkout.result_try_again") : t("not_found.home")}
            </a>
          </Button>
        )}
      </div>
    </PageContainer>
  )
}
