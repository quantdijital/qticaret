import { z } from "@medusajs/framework/zod"
import { isCleanText } from "../../security/text"

/**
 * A product's add-ons (adr/0052): what a shopper picks on the product page
 * beside the variant, a typed text or one of a few choices, each with a
 * price per unit in lira, KDV included like the shop's prices. Stored on
 * the product's extension as the panel sends them, with ids the server
 * gives; nothing here is sector-specific.
 */

export const ADDONS_MAX = 5
export const ADDON_LABEL_MAX = 60
export const ADDON_HELP_MAX = 160
export const ADDON_CHOICES_MIN = 2
export const ADDON_CHOICES_MAX = 10
export const ADDON_TEXT_MAX = 200
export const ADDON_TEXT_DEFAULT = 50
export const ADDON_QUANTITY_MAX = 99
/** Ten thousand lira at most per unit; adr/0052 §2. */
export const ADDON_PRICE_MAX = 10_000

/**
 * What a typed text may hold: letters (Turkish ones too), digits and
 * spaces; `text` adds `. , ' - &`. Never a link (`lib/text/link-like`).
 */
export const ADDON_CHARSETS = ["letters_digits", "text"] as const
export type AddonCharset = (typeof ADDON_CHARSETS)[number]

// Invisible and direction-changing characters disguise text in lists and e-mails
const FORMAT_CHARACTER = /\p{Cf}/u

// Limits as refinements: Medusa's validator words size errors itself, a
// refinement's message (an i18n key) reaches the panel as it is
const ID = /^[a-z0-9_-]{1,32}$/iu
const addonId = z.string().refine((id) => ID.test(id), { message: "addons.id_invalid" })

const isPlain = (text: string, min: number, max: number): boolean =>
  text.length >= min && text.length <= max && isCleanText(text) && !FORMAT_CHARACTER.test(text)

const plain = (max: number) =>
  z
    .string()
    .trim()
    .refine((text) => isPlain(text, 1, max), { message: "addons.label_invalid" })

const help = z
  .string()
  .trim()
  .refine((text) => isPlain(text, 0, ADDON_HELP_MAX), { message: "addons.help_invalid" })
  .transform((text) => (text === "" ? null : text))

const whole = (min: number, max: number, message: string) =>
  z.number().refine((value) => Number.isInteger(value) && value >= min && value <= max, {
    message,
  })

// Lira to the kuruş, within the limit
const price = z
  .number()
  .refine(
    (value) =>
      Number.isFinite(value) &&
      value >= 0 &&
      value <= ADDON_PRICE_MAX &&
      Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
    { message: "addons.price_invalid" }
  )

const maxQuantity = whole(1, ADDON_QUANTITY_MAX, "addons.max_quantity_invalid").nullable()

const textRules = z
  .object({
    max_length: whole(1, ADDON_TEXT_MAX, "addons.text_rules_invalid"),
    charset: z.enum(ADDON_CHARSETS),
  })
  .strict()

const common = {
  label: plain(ADDON_LABEL_MAX),
  help: help.nullable().optional(),
  required: z.boolean().optional(),
  max_quantity: maxQuantity.optional(),
  // Made to the buyer's wish: outside the right of withdrawal (MSY md. 15/1-b)
  non_withdrawable: z.boolean().optional(),
}

const choiceInput = z
  .object({ id: addonId.optional(), label: plain(ADDON_LABEL_MAX), price })
  .strict()

const addonInput = z.discriminatedUnion("kind", [
  z
    .object({
      id: addonId.optional(),
      kind: z.literal("text"),
      ...common,
      price,
      text: textRules.partial().optional(),
    })
    .strict(),
  z
    .object({
      id: addonId.optional(),
      kind: z.literal("choice"),
      ...common,
      choices: z
        .array(choiceInput)
        .refine(
          (choices) => choices.length >= ADDON_CHOICES_MIN && choices.length <= ADDON_CHOICES_MAX,
          { message: "addons.choices_invalid" }
        ),
    })
    .strict(),
])

export type AddonInput = z.infer<typeof addonInput>

const duplicated = (ids: (string | undefined)[]): boolean => {
  const given = ids.filter((id): id is string => id !== undefined)
  return new Set(given).size !== given.length
}

/** Whether a shopper is charged for it: a paid add-on is never required (adr/0052 §2). */
export const isPaid = (
  addon: { kind: "text"; price: number } | { kind: "choice"; choices: { price: number }[] }
): boolean =>
  addon.kind === "text" ? addon.price > 0 : addon.choices.some((choice) => choice.price > 0)

/**
 * The add-ons a product's save sends: five at most, ids unique, a paid
 * one never required. Null or an empty list clears them.
 */
export const AddonsInput = z.array(addonInput).superRefine((addons, ctx) => {
  if (addons.length > ADDONS_MAX) {
    ctx.addIssue({ code: "custom", message: "addons.too_many" })
  }
  if (duplicated(addons.map((addon) => addon.id))) {
    ctx.addIssue({ code: "custom", message: "addons.id_duplicate" })
  }
  addons.forEach((addon, index) => {
    if (addon.required === true && isPaid(addon)) {
      ctx.addIssue({
        code: "custom",
        message: "addons.required_must_be_free",
        path: [index, "required"],
      })
    }
    if (addon.kind === "choice" && duplicated(addon.choices.map((choice) => choice.id))) {
      ctx.addIssue({ code: "custom", message: "addons.id_duplicate", path: [index, "choices"] })
    }
  })
})

export interface StoredChoice {
  id: string
  label: string
  price: number
}

/** An add-on as the product keeps it and the storefront reads it. */
export type StoredAddon = {
  id: string
  label: string
  help: string | null
  required: boolean
  max_quantity: number | null
  non_withdrawable: boolean
} & (
  | {
      kind: "text"
      price: number
      text: { max_length: number; charset: AddonCharset }
    }
  | { kind: "choice"; choices: StoredChoice[] }
)

const storedAddon: z.ZodType<StoredAddon> = z.union([
  z.object({
    id: addonId,
    kind: z.literal("text"),
    label: z.string(),
    help: z.string().nullable(),
    required: z.boolean(),
    max_quantity: z.number().int().nullable(),
    non_withdrawable: z.boolean(),
    price: z.number(),
    text: textRules,
  }),
  z.object({
    id: addonId,
    kind: z.literal("choice"),
    label: z.string(),
    help: z.string().nullable(),
    required: z.boolean(),
    max_quantity: z.number().int().nullable(),
    non_withdrawable: z.boolean(),
    choices: z.array(z.object({ id: addonId, label: z.string(), price: z.number() })),
  }),
])

const storedAddons = z.object({ items: z.array(storedAddon).max(ADDONS_MAX) })

/**
 * The product extension's `addons` column: the list under `items` (a JSON
 * column holds an object, and an update writes `items` over whole).
 */
// A type, not an interface: the column's JSON type takes it only with an implicit index signature
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type StoredAddons = { items: StoredAddon[] }

/** A product's add-ons as stored; anything that does not read as them is none. */
export function storedAddonsOf(value: unknown): StoredAddon[] {
  const parsed = storedAddons.safeParse(value)
  return parsed.success ? parsed.data.items : []
}

/**
 * The add-ons a save sends, as the product keeps them: an id given is
 * kept (cart lines name add-ons by it), a new one gets one from `newId`.
 */
export function toStoredAddons(
  addons: readonly AddonInput[],
  newId: (prefix: "ad" | "ch") => string
): StoredAddon[] {
  return addons.map((addon) => {
    const base = {
      id: addon.id ?? newId("ad"),
      label: addon.label,
      help: addon.help ?? null,
      required: addon.required ?? false,
      max_quantity: addon.max_quantity ?? null,
      non_withdrawable: addon.non_withdrawable ?? false,
    }
    return addon.kind === "text"
      ? {
          ...base,
          kind: "text" as const,
          price: addon.price,
          text: {
            max_length: addon.text?.max_length ?? ADDON_TEXT_DEFAULT,
            charset: addon.text?.charset ?? "letters_digits",
          },
        }
      : {
          ...base,
          kind: "choice" as const,
          choices: addon.choices.map((choice) => ({
            id: choice.id ?? newId("ch"),
            label: choice.label,
            price: choice.price,
          })),
        }
  })
}
