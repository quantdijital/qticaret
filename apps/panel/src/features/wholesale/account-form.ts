import { z } from "zod"
import { percentOf } from "@/features/price-lists/form"
import type {
  CreateAccountBody,
  TierBody,
  UpdateAccountBody,
  WholesaleAccount,
  WholesaleTier,
} from "./api/types"

/**
 * The wholesale forms (ADR-0068 §3, §4), as the server reads them
 * (`account-validators.ts`, `validators.ts`); messages are i18n keys. The
 * server checks everything again, the tax number's check digits too.
 */

const E = "wholesale.form.errors"
const MAX_MINIMUM = 100_000

/** "" (none) or a whole count 1–100.000. */
export function minimumOf(text: string): number | null {
  const value = text.trim().replace(/\./g, "")
  return /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= MAX_MINIMUM
    ? Number(value)
    : null
}

const optionalPercent = z
  .string()
  .trim()
  .refine((text) => text === "" || percentOf(text) !== null, `${E}.percent`)
const optionalMinimum = z
  .string()
  .trim()
  .refine((text) => text === "" || minimumOf(text) !== null, `${E}.minimum`)

interface SourceValues {
  tier_id: string
  own_prices: boolean
  percent: string
}

/** The own list's rate counts only while own prices are on (the field is hidden otherwise). */
const ownRate = (values: SourceValues): number | null =>
  values.own_prices && values.percent.trim() !== "" ? percentOf(values.percent) : null

/** A level and/or own prices (the server's `wholesale.no_price_source`), the rate well formed. */
function checkPriceSource(values: SourceValues, ctx: z.RefinementCtx) {
  if (values.own_prices && values.percent.trim() !== "" && percentOf(values.percent) === null) {
    ctx.addIssue({ code: "custom", path: ["percent"], message: `${E}.percent` })
  }
  if (values.tier_id === "" && !values.own_prices) {
    ctx.addIssue({ code: "custom", path: ["tier_id"], message: `${E}.priceSource` })
  }
}

const isEmail = (value: string) => z.email().safeParse(value).success
const digits = (value: string) => value.replace(/\s+/g, "")

export const accountSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, `${E}.emailRequired`)
      .max(254, `${E}.tooLong`)
      .refine(isEmail, `${E}.email`),
    contact_name: z.string().trim().min(2, `${E}.contact`).max(100, `${E}.tooLong`),
    company_name: z.string().trim().max(200, `${E}.tooLong`),
    tax_office: z.string().trim().max(100, `${E}.tooLong`),
    tax_id: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\d{10,11}$/.test(digits(value)), `${E}.taxId`),
    tier_id: z.string(),
    own_prices: z.boolean(),
    percent: z.string(),
    min_quantity: optionalMinimum,
  })
  .superRefine((values, ctx) => {
    checkPriceSource(values, ctx)
    if ((values.tax_office === "") !== (values.tax_id === "")) {
      const path = values.tax_office === "" ? "tax_office" : "tax_id"
      ctx.addIssue({ code: "custom", path: [path], message: `${E}.taxPair` })
    }
    if (values.tax_id !== "" && values.company_name === "") {
      ctx.addIssue({ code: "custom", path: ["company_name"], message: `${E}.companyForTax` })
    }
  })
export type AccountValues = z.infer<typeof accountSchema>

export const blankAccount: AccountValues = {
  email: "",
  contact_name: "",
  company_name: "",
  tax_office: "",
  tax_id: "",
  tier_id: "",
  own_prices: false,
  percent: "",
  min_quantity: "",
}

const orNull = (text: string) => (text.trim() === "" ? null : text.trim())

/** What a new wholesaler sends. */
export function createBodyOf(values: AccountValues): CreateAccountBody {
  return {
    email: values.email.trim().toLowerCase(),
    contact_name: values.contact_name.trim(),
    company_name: orNull(values.company_name),
    ...(values.tax_id.trim() === ""
      ? {}
      : { tax_office: values.tax_office.trim(), tax_id: digits(values.tax_id) }),
    tier_id: values.tier_id === "" ? null : values.tier_id,
    own_prices: values.own_prices,
    percent: ownRate(values),
    min_quantity: values.min_quantity.trim() === "" ? null : minimumOf(values.min_quantity),
  }
}

/** The edit window: no address and no tax details (the customer's invoice identity holds those). */
export const editSchema = z
  .object({
    // A bound customer may have no name on record: it stays empty until someone types one
    contact_name: z
      .string()
      .trim()
      .max(100, `${E}.tooLong`)
      .refine((text) => text === "" || text.length >= 2, `${E}.contact`),
    company_name: z.string().trim().max(200, `${E}.tooLong`),
    tier_id: z.string(),
    own_prices: z.boolean(),
    percent: z.string(),
    min_quantity: optionalMinimum,
  })
  .superRefine(checkPriceSource)
export type EditValues = z.infer<typeof editSchema>

const percentText = (percent: number | null) =>
  percent === null ? "" : String(percent).replace(".", ",")

export const editValuesOf = (account: WholesaleAccount): EditValues => ({
  contact_name: account.contact_name ?? "",
  company_name: account.company_name ?? "",
  tier_id: account.tier?.id ?? "",
  own_prices: account.own_prices,
  percent: percentText(account.percent),
  min_quantity: account.min_quantity === null ? "" : String(account.min_quantity),
})

/** Only what changed: the server writes names to the customer record once bound. */
export function updateBodyOf(values: EditValues, before: EditValues): UpdateAccountBody {
  const body: UpdateAccountBody = {}
  if (values.contact_name.trim() !== before.contact_name) {
    body.contact_name = orNull(values.contact_name)
  }
  if (values.company_name.trim() !== before.company_name) {
    body.company_name = orNull(values.company_name)
  }
  if (values.tier_id !== before.tier_id) {
    body.tier_id = values.tier_id === "" ? null : values.tier_id
  }
  if (values.own_prices && !before.own_prices) {
    body.own_prices = true
  }
  if (values.own_prices && values.percent.trim() !== before.percent) {
    body.percent = ownRate(values)
  }
  if (values.min_quantity.trim() !== before.min_quantity) {
    body.min_quantity = values.min_quantity.trim() === "" ? null : minimumOf(values.min_quantity)
  }
  return body
}

/** A level's window. */
export const tierSchema = z.object({
  name: z.string().trim().min(1, `${E}.tierName`).max(100, `${E}.tooLong`),
  percent: optionalPercent,
  min_quantity: optionalMinimum,
})
export type TierValues = z.infer<typeof tierSchema>

export const tierValuesOf = (tier: WholesaleTier | null): TierValues => ({
  name: tier?.name ?? "",
  percent: percentText(tier?.percent ?? null),
  min_quantity: tier?.min_quantity ? String(tier.min_quantity) : "",
})

export const tierBodyOf = (values: TierValues): TierBody => ({
  name: values.name.trim(),
  percent: values.percent.trim() === "" ? null : percentOf(values.percent),
  min_quantity: values.min_quantity.trim() === "" ? null : minimumOf(values.min_quantity),
})
