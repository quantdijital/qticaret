import type { AddonFieldView } from "@qticaret/ui"

export interface AddonWords {
  title: string
  /** Under the title while any pick costs: prices are per unit. */
  perUnit: string
  required: string
  /** An optional choice's "none" (its unpicked state). */
  none: string
  /** Under an add-on made to the buyer's wish (adr/0052 §8). */
  nonWithdrawable: string
}

const INPUT =
  "h-12 w-full rounded-xl border border-input bg-background px-3.5 text-[15px] outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/30 focus-visible:border-foreground"

const CHOICE =
  "flex cursor-pointer items-center gap-3 rounded-xl border bg-background px-3.5 py-2.5 text-sm transition-colors hover:border-foreground/30 has-[:checked]:border-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"

function Required({ field, words }: { field: AddonFieldView; words: AddonWords }) {
  return field.required ? (
    <span className="font-normal text-muted-foreground"> ({words.required})</span>
  ) : null
}

function Warning({ field, words }: { field: AddonFieldView; words: AddonWords }) {
  return field.nonWithdrawable ? (
    <p className="text-xs font-medium text-sale">{words.nonWithdrawable}</p>
  ) : null
}

function TextAddon({
  id,
  field,
  value,
  words,
}: {
  id: string
  field: AddonFieldView
  value: string
  words: AddonWords
}) {
  const inputId = `${id}-${field.id}`
  const hint = [field.help, field.rules].filter(Boolean).join(" ")
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="flex items-baseline justify-between gap-3 text-sm font-medium"
      >
        <span>
          {field.label}
          <Required field={field} words={words} />
        </span>
        {field.price && (
          <span className="tabular shrink-0 text-muted-foreground">{field.price}</span>
        )}
      </label>
      <input
        id={inputId}
        name={`addon_${field.id}`}
        type="text"
        defaultValue={value}
        maxLength={field.maxLength ?? undefined}
        required={field.required}
        autoComplete="off"
        spellCheck={false}
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        className={INPUT}
      />
      {hint && (
        <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      <Warning field={field} words={words} />
    </div>
  )
}

function ChoiceAddon({
  id,
  field,
  value,
  words,
}: {
  id: string
  field: AddonFieldView
  value: string
  words: AddonWords
}) {
  const name = `addon_${field.id}`
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">
        {field.label}
        <Required field={field} words={words} />
      </legend>
      {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
      {!field.required && (
        <label className={CHOICE}>
          <input
            type="radio"
            id={`${id}-${field.id}-none`}
            name={name}
            value=""
            defaultChecked={value === ""}
            className="size-4 accent-foreground"
          />
          <span className="flex-1">{words.none}</span>
        </label>
      )}
      {field.choices.map((choice) => (
        <label key={choice.id} className={CHOICE}>
          <input
            type="radio"
            id={`${id}-${field.id}-${choice.id}`}
            name={name}
            value={choice.id}
            required={field.required}
            defaultChecked={value === choice.id}
            className="size-4 accent-foreground"
          />
          <span className="flex-1">{choice.label}</span>
          {choice.price && <span className="tabular text-muted-foreground">{choice.price}</span>}
        </label>
      ))}
      <Warning field={field} words={words} />
    </fieldset>
  )
}

/**
 * A product's add-ons as plain fields of the form around them (adr/0052):
 * a typed text with its rules, or one choice of a few; each named
 * `addon_<id>`, so the form posts without script. Prices come in words;
 * the server prices the line. Used on the product page and in the cart.
 */
export function AddonFields({
  id,
  fields,
  values = {},
  words,
}: {
  /** Keeps the fields' ids apart when a page has more than one picks form. */
  id: string
  fields: AddonFieldView[]
  /** Add-on id → the text or the choice's id to start with. */
  values?: Record<string, string>
  words: AddonWords
}) {
  const priced = fields.some(
    (field) => field.price !== null || field.choices.some((choice) => choice.price !== null)
  )
  return (
    <fieldset className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
      <legend className="px-1 text-sm font-medium">{words.title}</legend>
      {priced && <p className="-mt-2 text-xs text-muted-foreground">{words.perUnit}</p>}
      {fields.map((field) =>
        field.kind === "text" ? (
          <TextAddon
            key={field.id}
            id={id}
            field={field}
            value={values[field.id] ?? ""}
            words={words}
          />
        ) : (
          <ChoiceAddon
            key={field.id}
            id={id}
            field={field}
            value={values[field.id] ?? ""}
            words={words}
          />
        )
      )}
    </fieldset>
  )
}
