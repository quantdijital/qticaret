import { ArrowRight, Lock, ShoppingBag } from "lucide-react"
import type { CartPageView, ThemeActions, Translate } from "@qticaret/ui"
import { Alert, AlertDescription } from "@qticaret/ui/components/alert"
import { Button } from "@qticaret/ui/components/button"
import { CartLine } from "./cart/CartLine"
import { FreeShippingBar } from "./cart/FreeShippingBar"
import { PromotionForm } from "./cart/PromotionForm"
import { PageContainer } from "./components/Container"

const PROMOTION_ERRORS = ["cart.promotion_invalid", "errors.too_many_requests"]

function EmptyCart({ t }: { t: Translate }) {
  return (
    <PageContainer>
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-16 text-center lg:py-24">
        <span className="flex size-20 items-center justify-center rounded-full border bg-card">
          <ShoppingBag className="size-8 text-muted-foreground" aria-hidden="true" />
        </span>
        <h1 className="text-4xl leading-tight">{t("cart.title")}</h1>
        <p className="text-muted-foreground">{t("cart.empty")}</p>
        <Button asChild size="lg" className="h-12 rounded-full px-7">
          <a href="/">
            {t("cart.continue")}
            <ArrowRight aria-hidden="true" />
          </a>
        </Button>
      </div>
    </PageContainer>
  )
}

/** The cart: its lines, the coupon field, the totals and the way to checkout. */
export function CartPage({
  view,
  t,
  actions,
}: {
  view: CartPageView
  t: Translate
  actions: ThemeActions
}) {
  if (view.lines.length === 0) {
    return <EmptyCart t={t} />
  }
  const count = view.lines.reduce((sum, line) => sum + line.quantity, 0)
  return (
    <PageContainer className="flex flex-col gap-8">
      <header className="flex items-baseline justify-between gap-4 border-b pb-6">
        <h1 className="text-4xl leading-tight lg:text-5xl">{t("cart.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("cart.item_count", { count })}</p>
      </header>
      {view.error && (
        <Alert variant="destructive">
          <AlertDescription>{view.error}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
        <ul className="divide-y self-start">
          {view.lines.map((line) => (
            <CartLine key={line.id} line={line} t={t} actions={actions} />
          ))}
        </ul>
        <aside
          aria-labelledby="sepet-ozeti"
          className="flex h-fit flex-col gap-5 rounded-3xl border bg-card p-6 text-sm lg:sticky lg:top-40 lg:p-7"
        >
          <h2 id="sepet-ozeti" className="text-2xl">
            {t("cart.summary")}
          </h2>
          {view.freeShipping && <FreeShippingBar view={view.freeShipping} />}
          <PromotionForm
            codes={view.promotions}
            apply={actions.applyPromotion}
            remove={actions.removePromotion}
            words={{
              label: t("cart.promotion_label"),
              placeholder: t("cart.promotion_placeholder"),
              apply: t("cart.promotion_apply"),
              applying: t("cart.promotion_applying"),
              remove: t("cart.promotion_remove"),
              applied: t("cart.promotion_applied"),
              errors: Object.fromEntries(PROMOTION_ERRORS.map((key) => [key, t(key)])),
              fallback: t("cart.promotion_invalid"),
            }}
          />
          <dl className="tabular flex flex-col gap-3 border-t pt-5">
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
              <dd className="text-muted-foreground">{t("cart.shipping_at_checkout")}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t pt-4">
              <dt className="font-medium">{t("cart.subtotal")}</dt>
              <dd className="text-xl font-semibold">{view.subtotal}</dd>
            </div>
          </dl>
          <Button asChild size="lg" className="h-13 rounded-full text-base">
            <a href="/odeme">
              {t("cart.checkout")}
              <ArrowRight aria-hidden="true" />
            </a>
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="size-3.5" aria-hidden="true" />
            {t("cart.secure")}
          </p>
          <a href="/" className="text-center font-medium underline-offset-4 hover:underline">
            {t("cart.continue")}
          </a>
        </aside>
      </div>
    </PageContainer>
  )
}
