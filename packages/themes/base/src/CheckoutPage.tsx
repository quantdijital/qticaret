import { Lock } from "lucide-react"
import type { CheckoutActions, CheckoutPageView, CheckoutStep, Translate } from "@qticaret/ui"
import { AddressForm } from "./checkout/AddressForm"
import { FoldedSummary, OrderSummary } from "./checkout/OrderSummary"
import { PaymentForm } from "./checkout/PaymentForm"
import { ShippingForm } from "./checkout/ShippingForm"
import { Step } from "./checkout/Step"
import { PageContainer } from "./components/Container"

const ORDER: CheckoutStep[] = ["address", "shipping", "payment"]

/** The messages a checkout step can show, by key. */
const ERRORS = [
  "checkout.address_invalid",
  "checkout.email_invalid",
  "checkout.phone_invalid",
  "checkout.name_required",
  "checkout.location_required",
  "checkout.street_required",
  "checkout.shipping_required",
  "checkout.shipping_failed",
  "checkout.payment_required",
  "checkout.accept_required",
  "checkout.age_required",
  "checkout.provider_down",
  "checkout.cod_unavailable",
  "checkout.failed",
  "messaging.email_domain_refuses",
  "legal.version_changed",
  "legal.consent_missing",
  "age.under_limit",
  "age.birth_date_invalid",
  "age.declaration_missing",
  "fraud.checkout_refused",
  "fraud.velocity",
  "cart.shipping_changed",
  "cart.shipping_method_required",
  "cart.address_required",
  "cart.phone_required",
  "cart.email_required",
  "payments.cart_changed",
  "promotions.one_code",
  "errors.too_many_requests",
]

/**
 * The checkout (D7): three steps on one page beside the basket. The step
 * being filled is open, the ones before it show what was given and a link
 * to change it, the ones after wait. Each step is its own form.
 */
export function CheckoutPage({
  view,
  t,
  actions,
}: {
  view: CheckoutPageView
  t: Translate
  actions: CheckoutActions
}) {
  const errors = Object.fromEntries(ERRORS.map((key) => [key, t(key)]))
  const stateOf = (step: CheckoutStep) => {
    const here = ORDER.indexOf(view.step)
    const there = ORDER.indexOf(step)
    return there < here ? "done" : there === here ? "open" : "ahead"
  }
  const edit = t("checkout.edit")
  return (
    <PageContainer className="flex flex-col gap-8">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b pb-6">
        <h1 className="text-4xl leading-tight lg:text-5xl">{t("checkout.title")}</h1>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Lock className="size-4" aria-hidden="true" />
          {t("checkout.secure_note")}
        </p>
      </header>
      {view.error && (
        <p
          role="alert"
          className="rounded-2xl border border-sale/30 bg-sale/5 p-4 text-sm text-sale"
        >
          {view.error}
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-12">
        <div className="flex flex-col gap-4">
          <FoldedSummary summary={view.summary} t={t} />
          <Step
            number={1}
            title={t("checkout.step_address")}
            state={stateOf("address")}
            editPath={view.editPaths.address}
            editLabel={edit}
            summary={
              view.addressSummary && (
                <address className="flex flex-col gap-0.5 not-italic">
                  <span className="font-medium text-foreground">{view.addressSummary.name}</span>
                  {view.addressSummary.lines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                  <span>
                    {view.addressSummary.phone} · {view.addressSummary.email}
                  </span>
                </address>
              )
            }
          >
            <AddressForm
              step={view.address}
              actions={actions}
              words={{
                email: t("checkout.email"),
                emailHint: t("checkout.email_hint"),
                phone: t("checkout.phone"),
                phoneHint: t("checkout.phone_hint"),
                firstName: t("checkout.first_name"),
                lastName: t("checkout.last_name"),
                province: t("checkout.province"),
                district: t("checkout.district"),
                neighborhood: t("checkout.neighborhood"),
                choose: t("checkout.choose"),
                street: t("checkout.street"),
                streetHint: t("checkout.street_hint"),
                submit: t("checkout.to_shipping"),
                saving: t("checkout.saving"),
                errors,
                fallback: t("checkout.address_invalid"),
              }}
            />
          </Step>
          <Step
            number={2}
            title={t("checkout.step_shipping")}
            state={stateOf("shipping")}
            editPath={view.editPaths.shipping}
            editLabel={edit}
            summary={view.shippingSummary}
          >
            <ShippingForm
              options={view.shippingOptions}
              selected={view.shippingSelected}
              choose={actions.chooseShipping}
              words={{
                none: t("checkout.no_shipping"),
                submit: t("checkout.to_payment"),
                saving: t("checkout.saving"),
                errors,
                fallback: t("checkout.shipping_failed"),
              }}
            />
          </Step>
          <Step
            number={3}
            title={t("checkout.step_payment")}
            state={stateOf("payment")}
            editPath={view.editPaths.payment}
            editLabel={edit}
          >
            {view.paymentMethods.length === 0 ? (
              <p className="rounded-2xl bg-muted p-4 text-sm">{t("checkout.no_payment")}</p>
            ) : (
              <PaymentForm
                methods={view.paymentMethods}
                contracts={view.contracts}
                ageLimit={view.ageLimit}
                marketingVersion={view.marketingVersion}
                placeOrder={actions.placeOrder}
                words={{
                  methods: t("checkout.methods"),
                  contracts: t("checkout.contracts"),
                  accept: t("checkout.accept"),
                  age: t("checkout.age"),
                  birthDate: t("checkout.birth_date"),
                  marketingTitle: t("checkout.marketing_title"),
                  marketingEmail: t("checkout.marketing_email"),
                  marketingSms: t("checkout.marketing_sms"),
                  payCard: t("checkout.pay_with_card"),
                  placeOrder: t("checkout.place_order"),
                  working: t("checkout.working"),
                  checking: t("checkout.checking"),
                  secure: t("checkout.secure_payment"),
                  errors,
                  fallback: t("checkout.failed"),
                }}
              />
            )}
          </Step>
        </div>
        <OrderSummary summary={view.summary} t={t} className="hidden lg:flex" />
      </div>
    </PageContainer>
  )
}
