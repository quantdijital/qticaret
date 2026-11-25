import { z } from "zod"
import { gtinProblem } from "@/lib/gtin"
import { parseMeasureInput, parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"
import { isValidSlug } from "@/lib/slug"
import type { JSONContent } from "@tiptap/react"
import { EMPTY_SUMMARY, SUMMARY_TEXT_MAX, docTextLength } from "@/features/products/summary-doc"
import type { AttributeValue } from "@/features/attributes/types"

/**
 * The new-product form across its steps. Inputs stay text while typing
 * (Turkish amounts, counts); they become numbers when the product is
 * sent. Messages are i18n keys.
 */

const DIGITS = /^\d+$/
const MAX_TEXT = 200

const price = z
  .string()
  .trim()
  .refine((text) => (parseMoneyInput(text) ?? 0) > 0, { message: "products.errors.price" })

const stock = z
  .string()
  .trim()
  .refine((text) => DIGITS.test(text) && Number(text) <= 1_000_000, {
    message: "products.errors.stock",
  })

// Weight and dimensions: optional, published or not (adr/0054); a positive number when given
const measure = z
  .string()
  .trim()
  .refine((text) => text === "" || (parseMeasureInput(text) ?? 0) > 0, {
    message: "products.errors.measure",
  })

// Unit cost, VAT excluded (F11.4), as on the product page: empty means not entered
const cost = z
  .string()
  .trim()
  .refine(
    (text) => {
      if (text === "") {
        return true
      }
      const value = parseMoneyInput(text)
      return value !== null && value >= 0 && value <= 10_000_000
    },
    { message: "products.errors.cost" }
  )

export const variantSchema = z.object({
  key: z.string(),
  title: z.string(),
  options: z.record(z.string(), z.string()),
  price,
  stock,
  cost,
  sku: z.string().trim().max(64, { message: "products.errors.sku" }),
  // The manufacturer part number, kept by the catalog (Google's limit)
  mpn: z.string().trim().max(70, { message: "products.errors.mpn" }),
  // The variant's own parcel; empty takes the product's (adr/0054)
  weight: measure,
  length: measure,
  width: measure,
  height: measure,
  /**
   * The product's pictures (by address) shown when this variant is chosen,
   * picked in its dialog before the product exists; none shows them all.
   */
  image_urls: z.array(z.string()),
  // A barcode is a GTIN whose check digit fits, as on the product page (lib/gtin); none is fine
  ean: z
    .string()
    .trim()
    .superRefine((text, ctx) => {
      const problem = gtinProblem(text)
      if (problem) {
        ctx.addIssue({ code: "custom", message: `products.errors.gtin.${problem}` })
      }
    }),
})

export const optionSchema = z.object({
  title: z.string().trim().min(1, { message: "products.errors.optionTitle" }).max(50),
  values: z
    .array(z.string().trim().min(1).max(50))
    .min(1, { message: "products.errors.optionValues" })
    .max(30),
})

export const wizardSchema = z
  .object({
    // F3.2: digital and service products skip shipping (flag catalog.non_physical)
    kind: z.enum(["physical", "digital", "service"]),
    // adr/0076 §2: a service sold by departure (flag catalog.booking); the shop's default (§12)
    booking_mode: z.enum(["none", "departure"]),
    title: z.string().trim().min(2, { message: "products.errors.title" }).max(MAX_TEXT),
    handle: z
      .string()
      .trim()
      .refine((text) => text === "" || isValidSlug(text), { message: "products.errors.handle" }),
    description: z.string().max(20_000),
    // The short description as written (optional; ADR-0055 Ek 2026-11-06), the server's cap
    summary_doc: z
      .custom<JSONContent>((value) => typeof value === "object" && value !== null)
      .refine((doc) => docTextLength(doc) <= SUMMARY_TEXT_MAX, {
        message: "products.errors.summaryTooLong",
      }),
    category_ids: z.array(z.string()),
    type_id: z.string(),
    // The attribute template (adr/0013) and its product values, written after the product; "" none
    template_id: z.string(),
    attributes: z.record(z.string(), z.custom<AttributeValue>()),
    images: z.array(z.object({ id: z.string(), url: z.string() })).max(20),
    has_options: z.boolean(),
    options: z.array(optionSchema).max(3),
    variants: z
      .array(variantSchema)
      .min(1)
      .max(100, { message: "products.errors.tooManyVariants" }),
    manage_inventory: z.boolean(),
    allow_backorder: z.boolean(),
    weight: measure,
    length: measure,
    width: measure,
    height: measure,
  })
  .superRefine((values, ctx) => {
    if (!values.has_options) {
      return
    }
    if (values.options.length === 0) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "products.errors.optionRequired" })
    }
    // Two options with one name would overwrite each other in every variant
    const titles = values.options.map((option) => option.title.trim().toLocaleLowerCase("tr"))
    titles.forEach((title, index) => {
      if (title && titles.indexOf(title) !== index) {
        ctx.addIssue({
          code: "custom",
          path: ["options", index, "title"],
          message: "products.errors.optionDuplicate",
        })
      }
    })
  })

export type WizardValues = z.infer<typeof wizardSchema>
export type VariantValues = z.infer<typeof variantSchema>

export const DEFAULT_VARIANT_KEY = "default"

/** What a new variant row holds before anything is typed: no price, no stock, no codes. */
export const BLANK_VARIANT = {
  price: "",
  stock: "0",
  cost: "",
  sku: "",
  ean: "",
  mpn: "",
  weight: "",
  length: "",
  width: "",
  height: "",
  image_urls: [] as string[],
} satisfies Omit<VariantValues, "key" | "title" | "options">

export const defaultWizardValues = (): WizardValues => ({
  kind: "physical",
  booking_mode: "none",
  title: "",
  handle: "",
  description: "",
  summary_doc: EMPTY_SUMMARY,
  category_ids: [],
  type_id: "",
  template_id: "",
  attributes: {},
  images: [],
  has_options: false,
  options: [],
  variants: [{ ...BLANK_VARIANT, key: DEFAULT_VARIANT_KEY, title: "", options: {} }],
  manage_inventory: true,
  allow_backorder: false,
  weight: "",
  length: "",
  width: "",
  height: "",
})

/** The fields each step checks before moving on. */
export const STEP_FIELDS = {
  basics: ["title", "handle", "description", "summary_doc"],
  media: ["images"],
  pricing: ["options", "variants"],
  shipping: ["weight", "length", "width", "height"],
  review: [],
} as const satisfies Record<string, readonly (keyof WizardValues)[]>

export type WizardStepKey = keyof typeof STEP_FIELDS
export const WIZARD_STEPS = Object.keys(STEP_FIELDS) as WizardStepKey[]

/**
 * The steps for a kind: a digital or service product has no parcel, so no
 * shipping step. A step whose part the shop hid on the product page
 * (pictures, parcel) is skipped too (`wizardShown`).
 */
export const stepsFor = (
  kind: WizardValues["kind"],
  shown: { media: boolean; shipping: boolean } = { media: true, shipping: true }
): WizardStepKey[] =>
  WIZARD_STEPS.filter(
    (key) =>
      (key !== "shipping" || (kind === "physical" && shown.shipping)) &&
      (key !== "media" || shown.media)
  )

/**
 * Weight and all three dimensions given: carriers price by the product's
 * own parcel. Optional (adr/0054): without them the shop's default parcel.
 */
export const hasMeasures = (values: WizardValues): boolean =>
  [values.weight, values.length, values.width, values.height].every(
    (text) => (parseMeasureInput(text) ?? 0) > 0
  )
