import { Lock, ReceiptText } from "lucide-react"
import type { CheckoutActions, CheckoutPageView, CheckoutStep, Translate } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { placeholderWords } from "../parts/placeholders"
import { AddressForm } from "./AddressForm"
import { CART_FIX_ERRORS, CHECKOUT_ERRORS, LINK_ERRORS } from "./errors"
import { PaymentForm } from "./PaymentForm"
import { ShippingForm } from "./ShippingForm"
import { Step } from "./Step"
import { FoldedSummary, Summary } from "./Summary"

const ORDER: CheckoutStep[] = ["address", "shipping", "payment"]

/** Who the invoice goes to, in words, and where to change it (F8): a quiet row in the payment step. */
function Invoice({ invoice }: { invoice: CheckoutPageView["invoice"] }) {
  return (
    <p className="mb-8 flex items-start gap-3 rounded-media bg-field p-4 text-sm">
      <ReceiptText
        className="mt-0.5 size-5 shrink-0 text-text-2"
        aria-hidden="true"
        strokeWidth={1.75}
      />
      <span>
        {invoice.text}{" "}
        {invoice.link && (
          <a href={invoice.link.path} className="font-semibold underline underline-offset-4">
            {invoice.link.label}
          </a>
        )}
      </span>
    </p>
  )
}

/**
 * The checkout (`/odeme`, D7), one hand on a phone: the basket folded in
 * a graphite bar above, then three steps as tinted wells, each its own
 * form; the open one shows its fields, the ones before it what was given,
 * the ones after only their titles. Guests check out as they are. On a
 * desktop the basket is a graphite stage that stays beside the steps.
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
  const errors = Object.fromEntries(CHECKOUT_ERRORS.map((key) => [key, t(key)]))
  const stateOf = (step: CheckoutStep) => {
    const here = ORDER.indexOf(view.step)
    const there = ORDER.indexOf(step)
    return there < here ? "done" : there === here ? "open" : "ahead"
  }
  const edit = t("checkout.edit")
  const address = view.addressSummary
  return (
    <Container className="flex flex-col gap-6 pt-6 lg:gap-8 lg:pt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="text-section">{t("checkout.title")}</h1>
        <p className="flex items-center gap-2 text-sm text-text-2">
          <Lock className="size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
          {t("checkout.secure_note")}
        </p>
      </div>
      {view.error && (
        <p role="alert" className="rounded-media bg-paper-2 p-4 text-sm font-semibold text-error">
          {view.error}
        </p>
      )}
      <div className="grid items-start gap-(--gap-columns) lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-3">
          <FoldedSummary summary={view.summary} t={t} />
          <Step
            number={1}
            title={t("checkout.step_address")}
            state={stateOf("address")}
            editPath={view.editPaths.address}
            editLabel={edit}
            summary={
              address && (
                <address className="flex flex-col gap-0.5 not-italic">
                  <span className="font-semibold text-text">{address.name}</span>
                  <span className="line-clamp-2 sm:line-clamp-none">
                    {address.lines.filter(Boolean).join(", ")}
                  </span>
                  <span className="max-sm:hidden">{address.phone}</span>
                  <span className="break-all max-sm:hidden">{address.email}</span>
                </address>
              )
            }
          >
            <AddressForm
              step={view.address}
              actions={actions}
              words={{
                contact: t("checkout.contact"),
                delivery: t("order.delivery"),
                email: t("checkout.email"),
                emailHint: t("checkout.email_hint"),
                phone: t("checkout.phone"),
                phoneHint: t("checkout.phone_hint"),
                firstName: t("checkout.first_name"),
                lastName: t("checkout.last_name"),
                province: t("checkout.province"),
                district: t("checkout.district"),
                neighborhood: t("checkout.neighborhood"),
                loading: t("checkout.loading"),
                street: t("checkout.street"),
                streetHint: t("checkout.street_hint"),
                submit: t("checkout.to_shipping"),
                saving: t("checkout.saving"),
                errors,
                fallback: t("checkout.address_invalid"),
                placeholders: placeholderWords(t),
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
                legend: t("checkout.step_shipping"),
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
            <Invoice invoice={view.invoice} />
            {view.paymentMethods.length === 0 ? (
              <p className="rounded-media bg-field p-4 text-sm font-semibold">
                {t("checkout.no_payment")}
              </p>
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
                  read: t("checkout.read"),
                  accept: t("checkout.accept"),
                  age: t("checkout.age"),
                  ageTitle: t("checkout.age_title"),
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
                  fixes: [
                    { errors: CART_FIX_ERRORS, label: t("checkout.fix_in_cart"), path: "/sepet" },
                    { errors: LINK_ERRORS, label: t("not_found.home"), path: "/" },
                  ],
                }}
              />
            )}
          </Step>
        </div>
        <Summary summary={view.summary} t={t} className="hidden lg:flex" />
      </div>
    </Container>
  )
}
