import { z } from "zod"
import { ADDON_CHARSETS, ADDON_KINDS, ADDON_LIMITS } from "@/features/products/api/addons"
import type {
  AddonCharset,
  AddonInput,
  AddonKind,
  ProductAddon,
} from "@/features/products/api/addons"
import {
  formatMoneyInput,
  parseCountInput,
  parseMoneyInput,
} from "@qticaret/admin-ui/lib/money-input"

/**
 * The add-ons card's values (adr/0052): one flat shape for both kinds, so
 * switching a new add-on's kind keeps what was typed; what is sent drops
 * the other kind's fields. An id is the server's: kept as it came, absent
 * for a new add-on or choice.
 */

const E = "products.addons.errors"
const L = ADDON_LIMITS

export interface ChoiceValue {
  id: string | null
  label: string
  price: number
}

export interface AddonValue {
  id: string | null
  kind: AddonKind
  label: string
  help: string | null
  required: boolean
  max_quantity: number | null
  non_withdrawable: boolean
  /** The text kind's price per unit, lira. */
  price: number
  max_length: number
  charset: AddonCharset
  choices: ChoiceValue[]
}

export function valueOf(addon: ProductAddon): AddonValue {
  const common = {
    id: addon.id,
    kind: addon.kind,
    label: addon.label,
    help: addon.help,
    required: addon.required,
    max_quantity: addon.max_quantity,
    non_withdrawable: addon.non_withdrawable,
  }
  return addon.kind === "text"
    ? {
        ...common,
        price: addon.price,
        max_length: addon.text.max_length,
        charset: addon.text.charset,
        choices: [],
      }
    : {
        ...common,
        price: 0,
        max_length: L.textDefault,
        charset: "letters_digits",
        choices: addon.choices.map((choice) => ({ ...choice })),
      }
}

/**
 * Another product's add-on as a new one of this product: everything but
 * the ids, which the server gives (a cart line names its add-on by id, so
 * two products never share one).
 */
export function copyOf(addon: ProductAddon): AddonValue {
  const value = valueOf(addon)
  return {
    ...value,
    id: null,
    choices: value.choices.map((choice) => ({ ...choice, id: null })),
  }
}

/** What the catalog save takes: ids kept, a new one without. */
export function inputOf(value: AddonValue): AddonInput {
  const common = {
    ...(value.id ? { id: value.id } : {}),
    label: value.label,
    help: value.help,
    required: value.required,
    max_quantity: value.max_quantity,
    non_withdrawable: value.non_withdrawable,
  }
  return value.kind === "text"
    ? {
        ...common,
        kind: "text",
        price: value.price,
        text: { max_length: value.max_length, charset: value.charset },
      }
    : {
        ...common,
        kind: "choice",
        choices: value.choices.map((choice) => ({
          ...(choice.id ? { id: choice.id } : {}),
          label: choice.label,
          price: choice.price,
        })),
      }
}

/** The prices a shopper may pay for it, lowest and highest. */
export function priceRange(value: AddonValue): [number, number] {
  const prices = value.kind === "text" ? [value.price] : value.choices.map((each) => each.price)
  return prices.length === 0 ? [0, 0] : [Math.min(...prices), Math.max(...prices)]
}

/** A paid add-on is never required: the page, feed and JSON-LD price is the base price. */
export const isPaid = (value: AddonValue): boolean => priceRange(value)[1] > 0

// The sheet's form: what is typed, as typed

export interface ChoiceDraft {
  id: string | null
  label: string
  price: string
}

export interface AddonDraft {
  kind: AddonKind
  label: string
  help: string
  price: string
  required: boolean
  max_quantity: string
  non_withdrawable: boolean
  max_length: string
  charset: AddonCharset
  choices: ChoiceDraft[]
}

const money = (amount: number) => (amount === 0 ? "" : formatMoneyInput(amount))

export const emptyChoice = (): ChoiceDraft => ({ id: null, label: "", price: "" })

export function draftOf(value: AddonValue | null): AddonDraft {
  return {
    kind: value?.kind ?? "text",
    label: value?.label ?? "",
    help: value?.help ?? "",
    price: value ? money(value.price) : "",
    required: value?.required ?? false,
    max_quantity: value?.max_quantity === null || !value ? "" : String(value.max_quantity),
    non_withdrawable: value?.non_withdrawable ?? false,
    max_length: String(value?.max_length ?? L.textDefault),
    charset: value?.charset ?? "letters_digits",
    choices:
      value && value.choices.length > 0
        ? value.choices.map((choice) => ({ ...choice, price: money(choice.price) }))
        : [emptyChoice(), emptyChoice()],
  }
}

// Control and invisible characters disguise text in lists and e-mails; the server refuses them
const HIDDEN = /[\p{Cc}\p{Cf}]/u
const clean = (text: string) => !HIDDEN.test(text)

const priceOf = (text: string): number | null => {
  if (text.trim() === "") {
    return 0
  }
  const amount = parseMoneyInput(text)
  return amount !== null && amount >= 0 && amount <= L.price ? amount : null
}

const wholeOf = (text: string, max: number): number | null => {
  const count = parseCountInput(text)
  return count !== null && count >= 1 && count <= max ? count : null
}

const choiceLabel = (text: string) => text.trim() !== "" && text.trim().length <= L.label

export const draftSchema = z
  .object({
    kind: z.enum(ADDON_KINDS),
    label: z
      .string()
      .trim()
      .min(1, `${E}.label`)
      .max(L.label, `${E}.label`)
      .refine(clean, `${E}.label`),
    help: z.string().trim().max(L.help, `${E}.help`).refine(clean, `${E}.help`),
    price: z.string(),
    required: z.boolean(),
    max_quantity: z.string(),
    non_withdrawable: z.boolean(),
    max_length: z.string(),
    charset: z.enum(ADDON_CHARSETS),
    choices: z.array(z.object({ id: z.string().nullable(), label: z.string(), price: z.string() })),
  })
  // Each kind's own fields are checked only for that kind: the other's stay as typed
  .superRefine((draft, ctx) => {
    const issue = (path: (string | number)[], message: string) => {
      ctx.addIssue({ code: "custom", path, message })
    }
    if (draft.kind === "text") {
      if (priceOf(draft.price) === null) {
        issue(["price"], `${E}.price`)
      }
      const limit = draft.max_quantity.trim()
      if (limit !== "" && wholeOf(limit, L.quantityMax) === null) {
        issue(["max_quantity"], `${E}.maxQuantity`)
      }
      if (wholeOf(draft.max_length, L.textMax) === null) {
        issue(["max_length"], `${E}.maxLength`)
      }
    } else {
      if (draft.choices.length < L.choicesMin || draft.choices.length > L.choicesMax) {
        issue(["choices"], `${E}.choices`)
      }
      draft.choices.forEach((choice, index) => {
        if (!choiceLabel(choice.label) || !clean(choice.label)) {
          issue(["choices", index, "label"], `${E}.choiceLabel`)
        }
        if (priceOf(choice.price) === null) {
          issue(["choices", index, "price"], `${E}.price`)
        }
      })
    }
    const paid =
      draft.kind === "text"
        ? (priceOf(draft.price) ?? 0) > 0
        : draft.choices.some((choice) => (priceOf(choice.price) ?? 0) > 0)
    if (draft.required && paid) {
      issue(["required"], `${E}.requiredFree`)
    }
  })

/**
 * The checked draft as the list keeps it. The id stays the original's; a
 * choice add-on's unit limit is not edited here and stays as it was.
 */
export function valueFromDraft(draft: AddonDraft, original: AddonValue | null): AddonValue {
  const help = draft.help.trim()
  const text = draft.kind === "text"
  return {
    id: original?.id ?? null,
    kind: draft.kind,
    label: draft.label.trim(),
    help: help === "" ? null : help,
    required: draft.required,
    max_quantity: text
      ? draft.max_quantity.trim() === ""
        ? null
        : wholeOf(draft.max_quantity, L.quantityMax)
      : (original?.max_quantity ?? null),
    non_withdrawable: draft.non_withdrawable,
    price: text ? (priceOf(draft.price) ?? 0) : 0,
    max_length: text ? (wholeOf(draft.max_length, L.textMax) ?? L.textDefault) : L.textDefault,
    charset: draft.charset,
    choices: text
      ? []
      : draft.choices.map((choice) => ({
          id: choice.id,
          label: choice.label.trim(),
          price: priceOf(choice.price) ?? 0,
        })),
  }
}
