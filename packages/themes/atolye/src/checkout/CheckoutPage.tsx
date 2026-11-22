import { ReceiptText } from "lucide-react"
import type { CheckoutActions, CheckoutPageView, CheckoutStep, Translate } from "@qticaret/ui"
import { promotionWords } from "../cart/code-words"
import { Container } from "../parts/Container"
import { placeholderWords } from "../parts/placeholders"
import { AddressForm } from "./AddressForm"
import { CART_FIX_ERRORS, CHECKOUT_ERRORS, LINK_ERRORS } from "./errors"
import { PaymentForm } from "./PaymentForm"
import { ShippingForm } from "./ShippingForm"
import { Step } from "./Step"
import { FoldedSummary, Summary } from "./Summary"
import { SummaryCode } from "./SummaryCode"
import { TravelersForm } from "./TravelersForm"
import { travelerWords } from "./traveler-words"

const ORDER: CheckoutStep[] = ["address", "shipping", "payment"]

/** Who the invoice goes to, in words, and where to change it (F8): a quiet row in the payment step. */
function Invoice({ invoice }: { invoice: CheckoutPageView["invoice"] }) {
  return (
    <p className="mb-8 flex items-start gap-3 rounded-media gf-pane-inner p-4 text-sm">
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
 * Only the view's steps are drawn (adr/0076 §6): a cart nothing ships for
 * has no shipping step, its address step the invoice's and the contact's.
 * A dated product that asks for its travelers adds their step before the
 * payment (Ek D6b), drawn only with its view and its action.
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
  // The cart's own steps (adr/0076 §6); a view without them (or with none) takes all three, as before
  const steps = view.steps?.length ? view.steps : ORDER
  const stateOf = (step: CheckoutStep) => {
    const here = steps.indexOf(view.step)
    const there = steps.indexOf(step)
    return there < here ? "done" : there === here ? "open" : "ahead"
  }
  const numberOf = (step: CheckoutStep) => steps.indexOf(step) + 1
  // Nothing to ship: the address is the invoice's and the contact's, the payment next
  const ships = steps.includes("shipping")
  const edit = t("checkout.edit")
  const address = view.addressSummary
  const { promotions } = view
  const { applyPromotion, removePromotion, saveTravelers } = actions
  // The summary is drawn twice (folded on a phone, a stage on a desktop): one field each, own ids
  const code = (id: string) =>
    promotions && applyPromotion && removePromotion ? (
      <SummaryCode
        id={id}
        codes={promotions}
        apply={applyPromotion}
        remove={removePromotion}
        words={promotionWords(t)}
      />
    ) : null
  return (
    <Container className="flex flex-col gap-6 pt-6 lg:gap-8 lg:pt-12">
      <h1>{t("checkout.title")}</h1>
      {view.error && (
        <p role="alert" className="rounded-media gf-pane p-4 text-sm font-semibold text-error">
          {view.error}
        </p>
      )}
      <div className="grid items-start gap-(--gap-columns) lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
        <div className="flex min-w-0 flex-col gap-3">
          <FoldedSummary summary={view.summary} t={t} code={code("odeme-kod-katli")} />
          {steps.includes("address") && (
            <Step
              number={numberOf("address")}
              title={t(ships ? "checkout.step_address" : "checkout.step_contact")}
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
                  delivery: t(ships ? "order.delivery" : "checkout.billing_address"),
                  ...(ships ? {} : { deliveryNote: t("checkout.billing_address_note") }),
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
                  submit: t(ships ? "checkout.to_shipping" : "checkout.to_payment"),
                  saving: t("checkout.saving"),
                  errors,
                  fallback: t("checkout.address_invalid"),
                  placeholders: placeholderWords(t),
                }}
              />
            </Step>
          )}
          {ships && (
            <Step
              number={numberOf("shipping")}
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
          )}
          {steps.includes("travelers") && view.travelers && saveTravelers && (
            <Step
              number={numberOf("travelers")}
              title={t("checkout.step_travelers")}
              state={stateOf("travelers")}
              editPath={view.editPaths.travelers ?? view.editPaths.payment}
              editLabel={edit}
              summary={view.travelers.summary}
            >
              <TravelersForm
                step={view.travelers}
                save={saveTravelers}
                words={travelerWords(t, errors)}
              />
            </Step>
          )}
          {steps.includes("payment") && (
            <Step
              number={numberOf("payment")}
              title={t("checkout.step_payment")}
              state={stateOf("payment")}
              editPath={view.editPaths.payment}
              editLabel={edit}
            >
              <Invoice invoice={view.invoice} />
              {view.paymentMethods.length === 0 ? (
                <p className="rounded-media gf-pane-inner p-4 text-sm font-semibold">
                  {t("checkout.no_payment")}
                </p>
              ) : (
                <PaymentForm
                  methods={view.paymentMethods}
                  contracts={view.contracts}
                  ageLimit={view.ageLimit}
                  marketingVersion={view.marketingVersion}
                  total={view.summary.total}
                  placeOrder={actions.placeOrder}
                  hold={view.summary.hold}
                  words={{
                    methods: t("checkout.methods"),
                    total: t("checkout.total"),
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
          )}
        </div>
        <Summary summary={view.summary} t={t} code={code("odeme-kod")} className="hidden lg:flex" />
      </div>
    </Container>
  )
}
