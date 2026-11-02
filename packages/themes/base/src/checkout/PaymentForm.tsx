"use client"

import {
  CreditCard,
  Gift,
  HandCoins,
  Landmark,
  LoaderCircle,
  Lock,
  type LucideIcon,
} from "lucide-react"
import { useState } from "react"
import type { CheckoutActions, ContractView, PaymentKind, PaymentMethodView } from "@qticaret/ui"
import { Button } from "@qticaret/ui/components/button"
import { useChallengeForm } from "../account/useChallengeForm"
import { TextField } from "./fields"

const ICONS: Record<PaymentKind, LucideIcon> = {
  card: CreditCard,
  bank_transfer: Landmark,
  cash_on_delivery: HandCoins,
  credit: Gift,
}

export interface PaymentWords {
  methods: string
  contracts: string
  accept: string
  /** With `{age}` where the limit goes. */
  age: string
  birthDate: string
  marketingTitle: string
  marketingEmail: string
  marketingSms: string
  payCard: string
  placeOrder: string
  working: string
  checking: string
  secure: string
  errors: Record<string, string>
  fallback: string
}

const CHECKBOX = "mt-0.5 size-4.5 shrink-0 accent-foreground"

/**
 * The payment step: the way to pay, the contracts for it (shown in full,
 * then accepted), the age when the cart asks it, the optional marketing
 * consent, and the button. When the backend asks for a proof of work
 * (adr/0044), the browser solves it and the form is sent again, once.
 */
export function PaymentForm({
  methods,
  contracts,
  ageLimit,
  marketingVersion,
  placeOrder,
  words,
}: {
  methods: PaymentMethodView[]
  contracts: Partial<Record<PaymentKind, ContractView[]>>
  ageLimit: number | null
  marketingVersion: string
  placeOrder: CheckoutActions["placeOrder"]
  words: PaymentWords
}) {
  const [method, setMethod] = useState(methods[0]?.id ?? "")
  const { error, checking, pending, onSubmit } = useChallengeForm(placeOrder)
  const kind = methods.find((each) => each.id === method)?.kind ?? "card"
  const shown = contracts[kind] ?? []

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-7">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-semibold">{words.methods}</legend>
        {methods.map((each) => {
          const Icon = ICONS[each.kind]
          return (
            <label
              key={each.id}
              className="flex cursor-pointer items-center gap-4 rounded-2xl border bg-background p-4 transition-colors hover:border-foreground/30 has-[:checked]:border-foreground has-[:checked]:bg-card has-[:checked]:ring-1 has-[:checked]:ring-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
            >
              <input
                type="radio"
                name="provider_id"
                value={each.id}
                required
                checked={method === each.id}
                onChange={() => {
                  setMethod(each.id)
                }}
                className="size-4 accent-foreground"
              />
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex flex-col">
                <span className="font-medium">{each.label}</span>
                {each.detail && (
                  <span className="text-sm text-muted-foreground">{each.detail}</span>
                )}
              </span>
            </label>
          )
        })}
      </fieldset>

      {shown.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold">{words.contracts}</p>
          {shown.map((contract, index) => (
            <details
              key={contract.kind}
              open={index === 0}
              className="group rounded-2xl border bg-background"
            >
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:hidden">
                {contract.title}
              </summary>
              {/* adr/0019: the backend's own rendering of a checked document */}
              <div
                className="max-h-56 overflow-y-auto border-t px-4 py-3 text-xs leading-relaxed text-muted-foreground [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-2 [&_h3]:font-semibold [&_p]:mt-2 [&_table]:w-full [&_td]:border [&_td]:p-1 [&_th]:border [&_th]:p-1"
                dangerouslySetInnerHTML={{ __html: contract.html }}
              />
              <input
                type="hidden"
                name="contracts"
                value={`${contract.kind}:${String(contract.version)}`}
              />
            </details>
          ))}
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" name="accept" required className={CHECKBOX} />
            <span>{words.accept}</span>
          </label>
        </div>
      )}

      {ageLimit !== null && (
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed p-4">
          <TextField
            id="birth_date"
            name="birth_date"
            type="date"
            label={words.birthDate}
            required
            autoComplete="bday"
          />
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" name="age_confirm" required className={CHECKBOX} />
            <span>{words.age.replace("{age}", String(ageLimit))}</span>
          </label>
        </div>
      )}

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 text-sm font-semibold">{words.marketingTitle}</legend>
        <input type="hidden" name="marketing_version" value={marketingVersion} />
        <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
          <input type="checkbox" name="marketing_email" className={CHECKBOX} />
          <span>{words.marketingEmail}</span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
          <input type="checkbox" name="marketing_sms" className={CHECKBOX} />
          <span>{words.marketingSms}</span>
        </label>
      </fieldset>

      <div className="flex flex-col gap-3">
        <p role="alert" className="text-sm font-medium text-sale empty:hidden">
          {error ? (words.errors[error] ?? words.fallback) : null}
        </p>
        <Button
          type="submit"
          size="lg"
          disabled={pending || methods.length === 0}
          className="h-13 rounded-full text-base"
        >
          {pending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Lock aria-hidden="true" />
          )}
          {pending
            ? checking
              ? words.checking
              : words.working
            : kind === "card"
              ? words.payCard
              : words.placeOrder}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{words.secure}</p>
      </div>
    </form>
  )
}
