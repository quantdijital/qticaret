"use client"

import { useState } from "react"
import type { AccountPageView, FormAction } from "@qticaret/ui"
import { useKeptForm } from "@qticaret/ui/hooks/use-kept-form"

export interface BillingWords {
  individual: string
  corporate: string
  name: string
  company: string
  taxOffice: string
  tckn: string
  vkn: string
  current: string
  save: string
  saving: string
  saved: string
  errors: Record<string, string>
  fallback: string
}

const FIELD = "h-11 rounded-lg border border-input bg-background px-3 text-sm"

/** Who the invoice is for (F8): a person's TCKN, or a company's tax office and VKN. */
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
  const { state, pending, form } = useKeptForm(save)
  return (
    <form {...form} className="flex flex-col gap-3 text-sm">
      {billing?.taxIdMasked && (
        <p className="text-muted-foreground">
          {words.current}: {billing.legalName} · {billing.taxIdMasked}
        </p>
      )}
      <div className="flex gap-4">
        {(["individual", "corporate"] as const).map((each) => (
          <label key={each} className="flex items-center gap-2">
            <input
              type="radio"
              name="type"
              value={each}
              checked={type === each}
              onChange={() => {
                setType(each)
              }}
            />
            {each === "individual" ? words.individual : words.corporate}
          </label>
        ))}
      </div>
      <input
        name="legal_name"
        required
        minLength={2}
        maxLength={200}
        defaultValue={billing?.legalName ?? ""}
        placeholder={type === "individual" ? words.name : words.company}
        aria-label={type === "individual" ? words.name : words.company}
        className={FIELD}
      />
      {type === "corporate" && (
        <input
          name="tax_office"
          required
          maxLength={100}
          defaultValue={billing?.taxOffice ?? ""}
          placeholder={words.taxOffice}
          aria-label={words.taxOffice}
          className={FIELD}
        />
      )}
      <input
        name="tax_id"
        required
        inputMode="numeric"
        maxLength={14}
        placeholder={type === "individual" ? words.tckn : words.vkn}
        aria-label={type === "individual" ? words.tckn : words.vkn}
        className={FIELD}
      />
      <p role="status" className="empty:hidden">
        {state.error ? (
          <span className="text-sale">{words.errors[state.error] ?? words.fallback}</span>
        ) : state.ok ? (
          <span className="text-success">{words.saved}</span>
        ) : null}
      </p>
      <button
        type="submit"
        disabled={pending}
        className="h-10 self-start rounded-button border border-foreground px-5 font-semibold disabled:opacity-50"
      >
        {pending ? words.saving : words.save}
      </button>
    </form>
  )
}
