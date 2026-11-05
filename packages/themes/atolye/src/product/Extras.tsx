import { Gift } from "lucide-react"
import type { ReactNode } from "react"
import type { AddonFieldView } from "@qticaret/ui"
import type { AddonWords, GiftWords } from "./words"

/**
 * The fields a product asks above "add to cart": its add-ons (adr/0052)
 * and a gift card's recipient (adr/0025 Ek 2026-11-03), plain fields of
 * the buy form, so they post without script; prices come in words, the
 * server prices the line. Drawn on a filled well, the theme's fields.
 */

const FIELD = "gf-field rounded-inner"

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

function TextPick({ field, words }: { field: AddonFieldView; words: AddonWords }) {
  const id = `ek-${field.id}`
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

function ChoicePick({ field, words }: { field: AddonFieldView; words: AddonWords }) {
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
          <input type="radio" name={name} value="" defaultChecked className="size-4 accent-text" />
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
export function AddonPicks({ fields, words }: { fields: AddonFieldView[]; words: AddonWords }) {
  const priced = fields.some(
    (field) => field.price !== null || field.choices.some((choice) => choice.price !== null)
  )
  return (
    <fieldset className="flex flex-col gap-5 rounded-media bg-paper-2 p-4">
      <legend className="float-left mb-1 w-full text-md font-extrabold tracking-[-0.01em]">
        {words.title}
      </legend>
      {priced && <p className="-mt-3 text-xs text-text-2">{words.perUnit}</p>}
      {fields.map((field) =>
        field.kind === "text" ? (
          <TextPick key={field.id} field={field} words={words} />
        ) : (
          <ChoicePick key={field.id} field={field} words={words} />
        )
      )}
    </fieldset>
  )
}

/** Who a gift card goes to: the address it is e-mailed to, a name, a message, the sender's name. */
export function GiftRecipientFields({ words }: { words: GiftWords }) {
  const row = (id: string, label: string, field: ReactNode) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {field}
    </div>
  )
  return (
    <fieldset className="flex flex-col gap-4 rounded-media bg-paper-2 p-4">
      <legend className="float-left mb-1 flex w-full items-center gap-2 text-md font-extrabold tracking-[-0.01em]">
        <Gift className="size-5" aria-hidden="true" strokeWidth={2} />
        {words.title}
      </legend>
      {row(
        "hediye-eposta",
        words.email,
        <input
          id="hediye-eposta"
          name="recipient_email"
          type="email"
          required
          maxLength={254}
          autoComplete="off"
          className={FIELD}
        />
      )}
      {row(
        "hediye-ad",
        words.name,
        <input
          id="hediye-ad"
          name="recipient_name"
          maxLength={60}
          autoComplete="off"
          className={FIELD}
        />
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor="hediye-mesaj" className="text-sm font-semibold">
          {words.message}
        </label>
        <textarea
          id="hediye-mesaj"
          name="message"
          rows={3}
          maxLength={300}
          aria-describedby="hediye-mesaj-ipucu"
          className="gf-field min-h-24 rounded-inner"
        />
        <p id="hediye-mesaj-ipucu" className="text-xs text-text-2">
          {words.messageHint}
        </p>
      </div>
      {row(
        "hediye-gonderen",
        words.sender,
        <input
          id="hediye-gonderen"
          name="sender_name"
          maxLength={60}
          autoComplete="name"
          className={FIELD}
        />
      )}
    </fieldset>
  )
}
