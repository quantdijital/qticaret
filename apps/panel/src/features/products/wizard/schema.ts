import { z } from "zod"
import { gtinProblem } from "@/lib/gtin"
import { parseMeasureInput, parseMoneyInput } from "@/lib/money-input"
import { isValidSlug } from "@/lib/slug"
import { SUMMARY_LIMITS } from "@/features/products/summary-lines"

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

export const variantSchema = z.object({
  key: z.string(),
  title: z.string(),
  options: z.record(z.string(), z.string()),
  price,
  stock,
  sku: z.string().trim().max(64, { message: "products.errors.sku" }),
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
    title: z.string().trim().min(2, { message: "products.errors.title" }).max(MAX_TEXT),
    handle: z
      .string()
      .trim()
      .refine((text) => text === "" || isValidSlug(text), { message: "products.errors.handle" }),
    description: z.string().max(20_000),
    // The short description's rows as typed (optional); the editor keeps them within bounds
    summary: z.array(z.string().max(SUMMARY_LIMITS.length)).max(SUMMARY_LIMITS.lines),
    category_ids: z.array(z.string()),
    type_id: z.string(),
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

export const defaultWizardValues = (): WizardValues => ({
  kind: "physical",
  title: "",
  handle: "",
  description: "",
  summary: [],
  category_ids: [],
  type_id: "",
  images: [],
  has_options: false,
  options: [],
  variants: [
    { key: DEFAULT_VARIANT_KEY, title: "", options: {}, price: "", stock: "0", sku: "", ean: "" },
  ],
  manage_inventory: true,
  allow_backorder: false,
  weight: "",
  length: "",
  width: "",
  height: "",
})

/** The fields each step checks before moving on. */
export const STEP_FIELDS = {
  basics: ["title", "handle", "description", "summary"],
  media: ["images"],
  pricing: ["options", "variants"],
  shipping: ["weight", "length", "width", "height"],
  review: [],
} as const satisfies Record<string, readonly (keyof WizardValues)[]>

export type WizardStepKey = keyof typeof STEP_FIELDS
export const WIZARD_STEPS = Object.keys(STEP_FIELDS) as WizardStepKey[]

/** The steps for a kind: a digital or service product has no parcel, so no shipping step. */
export const stepsFor = (kind: WizardValues["kind"]): WizardStepKey[] =>
  kind === "physical" ? WIZARD_STEPS : WIZARD_STEPS.filter((key) => key !== "shipping")

/**
 * Weight and all three dimensions given: carriers price by the product's
 * own parcel. Optional (adr/0054): without them the shop's default parcel.
 */
export const hasMeasures = (values: WizardValues): boolean =>
  [values.weight, values.length, values.width, values.height].every(
    (text) => (parseMeasureInput(text) ?? 0) > 0
  )
