"use client"

import { ReceiptText } from "lucide-react"
import { useActionState, useState } from "react"
import type { AccountPageView, ActionResult, FormAction } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { TextField } from "../checkout/fields"
import { SaveRow, type SaveWords } from "./ProfileForms"

export interface BillingWords extends SaveWords {
  type: string
  individual: string
  corporate: string
  name: string
  company: string
  taxOffice: string
  tckn: string
  vkn: string
  current: string
}

const FIELD_ERRORS = ["billing_profile.tax_id_invalid", "billing_profile.tax_office_required"]

/**
 * Who the invoice is for (F8): a person (name, T.C. kimlik no) or a
 * company (title, tax office, VKN), chosen with two pill radios. The
 * saved one shows above, its number masked by the backend; the number is
 * typed again to change it. A refusal is said under its field.
 */
export function BillingForm({
  billing,
  save,
  words,
}: {
  billing: AccountPageView["billing"]
  save: FormAction
  words: BillingWords
}) {
  const [type, setType] = useState(billing?.type ?? "individual")
  const [state, submit, pending] = useActionState(save, { ok: false, error: null } as ActionResult)
  const fieldError = (key: string) => (state.error === key ? (words.errors[key] ?? null) : null)
  const person = type === "individual"
  return (
    <form action={submit} className="flex flex-col gap-5">
      {billing?.taxIdMasked && (
        <p className="flex items-start gap-3 rounded-media bg-field p-4 text-sm">
          <ReceiptText
            className="mt-0.5 size-5 shrink-0 text-text-2"
            aria-hidden="true"
            strokeWidth={1.75}
          />
          <span>
            <span className="font-semibold">{words.current}:</span> {billing.legalName},{" "}
            <span className="tabular">{billing.taxIdMasked}</span>
          </span>
        </p>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-semibold">{words.type}</legend>
        <div className="flex flex-wrap gap-2">
          {(["individual", "corporate"] as const).map((each) => (
            <label
              key={each}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center rounded-pill px-5 text-sm font-semibold transition-colors duration-(--dur-micro) active:translate-y-px has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                type === each ? "bg-text text-paper" : "bg-field hover:bg-paper-3"
              )}
            >
              <input
                type="radio"
                name="type"
                value={each}
                checked={type === each}
                onChange={() => {
                  setType(each)
                }}
                className="sr-only"
              />
              {each === "individual" ? words.individual : words.corporate}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
        <TextField
          id="legal_name"
          name="legal_name"
          label={person ? words.name : words.company}
          required
          minLength={2}
          maxLength={200}
          autoComplete={person ? "name" : "organization"}
          defaultValue={billing?.legalName ?? ""}
          className={person ? "sm:col-span-2" : undefined}
        />
        {!person && (
          <TextField
            id="tax_office"
            name="tax_office"
            label={words.taxOffice}
            error={fieldError("billing_profile.tax_office_required")}
            required
            maxLength={100}
            defaultValue={billing?.taxOffice ?? ""}
          />
        )}
        <TextField
          id="tax_id"
          name="tax_id"
          label={person ? words.tckn : words.vkn}
          error={fieldError("billing_profile.tax_id_invalid")}
          required
          inputMode="numeric"
          autoComplete="off"
          maxLength={14}
          className="sm:col-span-2"
        />
      </div>
      <SaveRow pending={pending} state={state} words={words} fieldErrors={FIELD_ERRORS} />
    </form>
  )
}
