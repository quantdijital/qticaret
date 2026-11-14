import { Gift } from "lucide-react"
import type { ReactNode } from "react"
import type { AddonFieldView, GiftRecipientView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import type { AddonWords, GiftWords } from "./words"

/**
 * The fields a product asks above "add to cart": its add-ons (adr/0052)
 * and a gift card's recipient (adr/0025 Ek 2026-11-03), plain fields of
 * the buy form, so they post without script; prices come in words, the
 * server prices the line. Drawn on a filled well, the theme's fields.
 * The cart draws the same fields to change a line's picks and a gift
 * card's recipient in place (`cart/AddonEditor`, `cart/GiftRecipient`):
 * `prefix` keeps a line's ids apart, `values` starts them as chosen.
 */

const FIELD = "gf-field rounded-box"

const CHOICE =
  "flex min-h-11 cursor-pointer items-center gap-3 rounded-inner bg-field px-3 text-sm transition-colors duration-(--dur-micro) hover:bg-paper-3 has-[:checked]:font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"

/** A form's add-on picks, by add-on id (`addon_<id>` fields; empty is none). */
export function picksOf(form: HTMLFormElement): Record<string, string> {
  return Object.fromEntries(
    [...new FormData(form).entries()].flatMap(([name, value]) =>
      name.startsWith("addon_") && typeof value === "string" ? [[name.slice(6), value]] : []
    )
  )
}

const picked = (field: AddonFieldView, picks: Record<string, string>) =>
  (picks[field.id] ?? "").trim() !== ""

/** What the picks add to one unit, in kuruş: only for the running total shown, never sent. */
export const picksKurus = (fields: readonly AddonFieldView[], picks: Record<string, string>) =>
  fields.reduce((sum, field) => {
    if (!picked(field, picks)) {
      return sum
    }
    if (field.kind === "text") {
      return sum + field.kurus
    }
    return sum + (field.choices.find((choice) => choice.id === picks[field.id])?.kurus ?? 0)
  }, 0)

/** The fewest units the picked add-ons allow on one line; null: no limit of theirs. */
export function picksLimit(fields: readonly AddonFieldView[], picks: Record<string, string>) {
  const limits = fields.flatMap((field) =>
    picked(field, picks) && field.maxQuantity !== null ? [field.maxQuantity] : []
  )
  return limits.length === 0 ? null : Math.min(...limits)
}

interface PickProps {
  field: AddonFieldView
  words: AddonWords
  prefix: string
  value: string
}

function Mark({ field, words }: { field: AddonFieldView; words: AddonWords }) {
  return field.required ? (
    <span className="font-normal text-text-2"> ({words.required})</span>
  ) : null
}

function Warning({ field, words }: { field: AddonFieldView; words: AddonWords }) {
  return field.nonWithdrawable ? (
    <p className="text-xs font-semibold text-deal">{words.nonWithdrawable}</p>
  ) : null
}

function TextPick({ field, words, prefix, value }: PickProps) {
  const id = `${prefix}-${field.id}`
  const hint = [field.help, field.rules].filter(Boolean).join(" ")
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="flex items-baseline justify-between gap-3 text-sm font-semibold"
      >
        <span>
          {field.label}
          <Mark field={field} words={words} />
        </span>
        {field.price && <span className="tabular shrink-0 text-text-2">{field.price}</span>}
      </label>
      <input
        id={id}
        name={`addon_${field.id}`}
        type="text"
        defaultValue={value}
        maxLength={field.maxLength ?? undefined}
        required={field.required}
        autoComplete="off"
        spellCheck={false}
        aria-describedby={hint ? `${id}-ipucu` : undefined}
        className={FIELD}
      />
      {hint && (
        <p id={`${id}-ipucu`} className="text-xs text-text-2">
          {hint}
        </p>
      )}
      <Warning field={field} words={words} />
    </div>
  )
}

function ChoicePick({ field, words, value }: PickProps) {
  const name = `addon_${field.id}`
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">
        {field.label}
        <Mark field={field} words={words} />
      </legend>
      {field.help && <p className="text-xs text-text-2">{field.help}</p>}
      {!field.required && (
        <label className={CHOICE}>
          <input
            type="radio"
            name={name}
            value=""
            defaultChecked={value === ""}
            className="size-4 accent-text"
          />
          <span className="flex-1">{words.none}</span>
        </label>
      )}
      {field.choices.map((choice) => (
        <label key={choice.id} className={CHOICE}>
          <input
            type="radio"
            name={name}
            value={choice.id}
            required={field.required}
            defaultChecked={value === choice.id}
            className="size-4 accent-text"
          />
          <span className="flex-1">{choice.label}</span>
          {choice.price && <span className="tabular text-text-2">{choice.price}</span>}
        </label>
      ))}
      <Warning field={field} words={words} />
    </fieldset>
  )
}

/** The product's add-ons: a typed text with its rules, or one choice of a few. */
export function AddonPicks({
  fields,
  words,
  prefix = "ek",
  values = {},
  className,
}: {
  fields: AddonFieldView[]
  words: AddonWords
  /** Keeps the fields' ids apart when a page has more than one picks form. */
  prefix?: string
  /** Add-on id → the text or the choice's id to start with. */
  values?: Readonly<Record<string, string>>
  className?: string
}) {
  const priced = fields.some(
    (field) => field.price !== null || field.choices.some((choice) => choice.price !== null)
  )
  return (
    <fieldset className={cn("flex flex-col gap-5 rounded-media bg-paper-2 p-4", className)}>
      <legend className="float-left mb-1 w-full text-md font-extrabold tracking-[-0.01em]">
        {words.title}
      </legend>
      {priced && <p className="-mt-3 text-xs text-text-2">{words.perUnit}</p>}
      {fields.map((field) => {
        const Pick = field.kind === "text" ? TextPick : ChoicePick
        return (
          <Pick
            key={field.id}
            field={field}
            words={words}
            prefix={prefix}
            value={values[field.id] ?? ""}
          />
        )
      })}
    </fieldset>
  )
}

/**
 * Who a gift card goes to: the address it is e-mailed to, a name, a
 * message, the sender's name. `values`: the recipient named already.
 */
export function GiftRecipientFields({
  words,
  prefix = "hediye",
  values = null,
  className,
}: {
  words: GiftWords
  /** Keeps the fields' ids apart when a page has more than one gift form. */
  prefix?: string
  values?: GiftRecipientView | null
  className?: string
}) {
  const row = (id: string, label: string, field: ReactNode) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {field}
    </div>
  )
  return (
    <fieldset className={cn("flex flex-col gap-4 rounded-media bg-paper-2 p-4", className)}>
      <legend className="float-left mb-1 flex w-full items-center gap-2 text-md font-extrabold tracking-[-0.01em]">
        <Gift className="size-5" aria-hidden="true" strokeWidth={2} />
        {words.title}
      </legend>
      {row(
        `${prefix}-eposta`,
        words.email,
        <input
          id={`${prefix}-eposta`}
          name="recipient_email"
          type="email"
          required
          maxLength={254}
          autoComplete="off"
          defaultValue={values?.email ?? ""}
          placeholder={words.placeholders.email}
          className={FIELD}
        />
      )}
      {row(
        `${prefix}-ad`,
        words.name,
        <input
          id={`${prefix}-ad`}
          name="recipient_name"
          maxLength={60}
          autoComplete="off"
          defaultValue={values?.name ?? ""}
          placeholder={words.placeholders.name}
          className={FIELD}
        />
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor={`${prefix}-mesaj`} className="text-sm font-semibold">
          {words.message}
        </label>
        <textarea
          id={`${prefix}-mesaj`}
          name="message"
          rows={3}
          maxLength={300}
          defaultValue={values?.message ?? ""}
          placeholder={words.placeholders.message}
          aria-describedby={`${prefix}-mesaj-ipucu`}
          className="gf-field min-h-24 rounded-box"
        />
        <p id={`${prefix}-mesaj-ipucu`} className="text-xs text-text-2">
          {words.messageHint}
        </p>
      </div>
      {row(
        `${prefix}-gonderen`,
        words.sender,
        <input
          id={`${prefix}-gonderen`}
          name="sender_name"
          maxLength={60}
          autoComplete="name"
          defaultValue={values?.sender ?? ""}
          placeholder={words.placeholders.sender}
          className={FIELD}
        />
      )}
    </fieldset>
  )
}
