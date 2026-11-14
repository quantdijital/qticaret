import { ChevronDown, ShieldCheck } from "lucide-react"
import type { ContractView } from "@qticaret/ui"
import { CheckField, FieldError, TextField } from "./fields"

export interface ConsentWords {
  contracts: string
  /** "Oku", beside a closed contract's title. */
  read: string
  accept: string
  /** With `{age}` where the limit goes. */
  age: string
  ageTitle: string
  birthDate: string
  marketingTitle: string
  marketingEmail: string
  marketingSms: string
}

/** Which refusal belongs to which part: the consents, the age declaration. */
export const ACCEPT_ERRORS = [
  "checkout.accept_required",
  "legal.consent_missing",
  "legal.version_changed",
]
export const AGE_ERRORS = [
  "checkout.age_required",
  "age.under_limit",
  "age.birth_date_invalid",
  "age.declaration_missing",
]

/**
 * What the shopper reads and accepts before paying: each contract for the
 * way chosen (the backend's own rendering) a row that opens in place, its
 * text in a box that scrolls and takes the focus; one box to accept them; the age
 * declaration when the cart asks it (a birth date and its box, adr/0041);
 * the optional marketing consent last, unticked.
 */
export function Consents({
  contracts,
  ageLimit,
  marketingVersion,
  error,
  message,
  words,
}: {
  contracts: readonly ContractView[]
  ageLimit: number | null
  marketingVersion: string
  error: string | null
  message: string | null
  words: ConsentWords
}) {
  const acceptError = error && ACCEPT_ERRORS.includes(error) ? message : null
  const ageError = error && AGE_ERRORS.includes(error) ? message : null
  return (
    <>
      {contracts.length > 0 && (
        <fieldset className="flex flex-col gap-3" aria-describedby="sozlesme-hata">
          <legend className="mb-3 text-md font-extrabold tracking-[-0.01em]">
            {words.contracts}
          </legend>
          {contracts.map((contract) => (
            <details key={contract.kind} className="group rounded-media bg-field">
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 text-sm font-semibold">
                {contract.title}
                <span className="ml-auto text-xs font-semibold text-text-2 group-open:hidden">
                  {words.read}
                </span>
                <ChevronDown
                  className="size-4.5 shrink-0 text-text-2 transition-transform duration-(--dur-short) group-open:rotate-180"
                  aria-hidden="true"
                  strokeWidth={2}
                />
              </summary>
              {/* adr/0019: the backend's own rendering of a checked document; it scrolls
                  with nothing in it to focus, so the box takes the focus (WCAG 2.1.1) */}
              <div
                role="region"
                aria-label={contract.title}
                tabIndex={0}
                className="gf-contract mx-4 mb-4 max-h-56 overflow-y-auto rounded-inner bg-paper-2 px-4 py-3 text-xs leading-relaxed text-text-2"
                dangerouslySetInnerHTML={{ __html: contract.html }}
              />
              <input
                type="hidden"
                name="contracts"
                value={`${contract.kind}:${String(contract.version)}`}
              />
            </details>
          ))}
          <CheckField name="accept" required aria-invalid={acceptError ? true : undefined}>
            {words.accept}
          </CheckField>
          <FieldError id="sozlesme-hata" message={acceptError} />
        </fieldset>
      )}
      {ageLimit !== null && (
        <fieldset
          className="flex flex-col gap-3 rounded-media bg-highlight-soft p-4 sm:p-5"
          aria-describedby="yas-hata"
        >
          <legend className="sr-only">{words.ageTitle}</legend>
          <p aria-hidden="true" className="flex items-center gap-2 text-md font-extrabold">
            <ShieldCheck className="size-5 shrink-0" aria-hidden="true" strokeWidth={1.75} />
            {words.ageTitle}
          </p>
          <TextField
            id="birth_date"
            name="birth_date"
            type="date"
            label={words.birthDate}
            required
            autoComplete="bday"
            className="sm:max-w-72"
          />
          <CheckField name="age_confirm" required aria-invalid={ageError ? true : undefined}>
            {words.age.replace("{age}", String(ageLimit))}
          </CheckField>
          <FieldError id="yas-hata" message={ageError} />
        </fieldset>
      )}
      <fieldset className="flex flex-col">
        <legend className="mb-1 text-sm font-semibold text-text-2">{words.marketingTitle}</legend>
        <input type="hidden" name="marketing_version" value={marketingVersion} />
        <CheckField name="marketing_email" className="text-text-2">
          {words.marketingEmail}
        </CheckField>
        <CheckField name="marketing_sms" className="text-text-2">
          {words.marketingSms}
        </CheckField>
      </fieldset>
    </>
  )
}
