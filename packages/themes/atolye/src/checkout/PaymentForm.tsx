"use client"

import { CreditCard, Gift, HandCoins, Landmark, Lock, type LucideIcon } from "lucide-react"
import { useState } from "react"
import type { CheckoutActions, ContractView, PaymentKind, PaymentMethodView } from "@qticaret/ui"
import { emitShopEvent } from "@qticaret/ui/lib/shop-events"
import { useChallengeForm } from "../frame/useChallengeForm"
import { ACCEPT_ERRORS, AGE_ERRORS, Consents, type ConsentWords } from "./Consents"
import { ChoiceRow, FieldError } from "./fields"

const ICONS: Record<PaymentKind, LucideIcon> = {
  card: CreditCard,
  bank_transfer: Landmark,
  cash_on_delivery: HandCoins,
  credit: Gift,
}

export interface PaymentWords extends ConsentWords {
  methods: string
  /** "Toplam", over the button where the basket's stage is not in sight. */
  total: string
  payCard: string
  placeOrder: string
  working: string
  checking: string
  secure: string
  errors: Record<string, string>
  fallback: string
  /** Refusals fixed elsewhere: their message links there (the cart; home for a closed link). */
  fixes: { errors: string[]; label: string; path: string }[]
}

/**
 * The payment step: the way to pay as filled rows (card, transfer, cash
 * on delivery when the backend offers it), the contracts for that way,
 * the age when the cart asks it, the optional marketing consent and the
 * button. On a phone the button stays at the screen's foot in the thumb's
 * reach while the contracts scroll by, the total right above it (the
 * basket's bar is far above by then; from 1024 px its stage stands beside). A proof of work the backend asks
 * for is solved here and the form sent again (adr/0044).
 */
export function PaymentForm({
  methods,
  contracts,
  ageLimit,
  marketingVersion,
  total,
  placeOrder,
  words,
}: {
  methods: PaymentMethodView[]
  /** The backend's total in words, as the summary says it. */
  total: string
  contracts: Partial<Record<PaymentKind, ContractView[]>>
  ageLimit: number | null
  marketingVersion: string
  placeOrder: CheckoutActions["placeOrder"]
  words: PaymentWords
}) {
  const [picked, setMethod] = useState(methods[0]?.id ?? "")
  // A code applied from the summary can change the ways offered (nothing left to pay: credit alone)
  const method = methods.some((each) => each.id === picked) ? picked : (methods[0]?.id ?? "")
  const { error, checking, pending, onSubmit } = useChallengeForm(placeOrder)
  const kind = methods.find((each) => each.id === method)?.kind ?? "card"
  const message = error ? (words.errors[error] ?? words.fallback) : null
  const placed = error !== null && (ACCEPT_ERRORS.includes(error) || AGE_ERRORS.includes(error))
  const fix = error ? words.fixes.find((each) => each.errors.includes(error)) : undefined
  return (
    <form
      onSubmit={(event) => {
        // The storefront hears the way chosen; whether it is measured is the cookie answer's
        emitShopEvent({ type: "add_payment_info", payment: kind })
        onSubmit(event)
      }}
      className="flex flex-col gap-8"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-md font-extrabold tracking-[-0.01em]">{words.methods}</legend>
        {methods.map((each) => {
          const Icon = ICONS[each.kind]
          return (
            <ChoiceRow
              key={each.id}
              name="provider_id"
              value={each.id}
              required
              checked={method === each.id}
              onChange={() => {
                setMethod(each.id)
              }}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-paper-2">
                <Icon className="size-5" aria-hidden="true" strokeWidth={1.75} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{each.label}</span>
                {each.detail && <span className="text-sm text-text-2">{each.detail}</span>}
                {each.note && <span className="mt-0.5 text-xs text-text-2">{each.note}</span>}
              </span>
            </ChoiceRow>
          )
        })}
      </fieldset>
      <Consents
        contracts={contracts[kind] ?? []}
        ageLimit={ageLimit}
        marketingVersion={marketingVersion}
        error={error}
        message={message}
        words={words}
      />
      <div className="sticky bottom-0 z-(--z-raised) -mx-5 flex flex-col gap-3 bg-paper-2 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:bg-transparent sm:p-0">
        <div role="alert" className="empty:hidden">
          {placed ? (
            <span className="sr-only">{message}</span>
          ) : (
            message && (
              <>
                <FieldError id="odeme-hata" message={message} />
                {fix && (
                  <a href={fix.path} className="gf-link text-sm">
                    {fix.label}
                  </a>
                )}
              </>
            )
          )}
        </div>
        <p className="flex items-baseline justify-between gap-4 lg:hidden">
          <span className="text-sm font-semibold text-text-2">{words.total}</span>
          <span className="tabular text-lg font-extrabold">{total}</span>
        </p>
        <button
          type="submit"
          disabled={pending || methods.length === 0}
          aria-busy={pending || undefined}
          className="gf-btn w-full"
        >
          <Lock className="size-4.5" aria-hidden="true" strokeWidth={2} />
          {pending
            ? checking
              ? words.checking
              : words.working
            : kind === "card"
              ? words.payCard
              : words.placeOrder}
        </button>
        <p className="mx-auto max-w-[60ch] text-center text-xs text-text-3">{words.secure}</p>
      </div>
    </form>
  )
}
