import { z } from "zod"
import { trAddressShape } from "@/features/tr-address/schema"
import { parseCountInput, parseMoneyInput } from "@/lib/money-input"
import type { DiscountType } from "./api/types"

/**
 * The new-order form (adr/0051 §13): who, what, where, a discount, a note
 * and how long the link opens. Only variants and quantities go to the
 * backend, never a price (rule 5); its limits are the backend's validators'.
 */

const E = "paymentLinks.form.errors"

export const MAX_LINES = 50
export const MAX_QUANTITY = 999
export const MAX_PERCENT = 99
/** A fixed discount in lira at most (the backend's 100 000 000 kuruş). */
const MAX_FIXED_LIRA = 1_000_000
export const MIN_HOURS = 1
export const MAX_HOURS = 168
export const DEFAULT_HOURS = 72

export interface FormLine {
  variant_id: string
  /** As the search showed it, until the preview names it. */
  label: string
  quantity: number
}

const line = z.object({ variant_id: z.string(), label: z.string(), quantity: z.number() })

export const linkFormSchema = z
  .object({
    customerMode: z.enum(["existing", "guest"]),
    customer: z.object({ id: z.string(), label: z.string() }).nullable(),
    guest: z.object({
      first_name: z.string(),
      last_name: z.string(),
      email: z.string(),
      phone: z.string(),
    }),
    lines: z.array(line),
    deliver: z.boolean(),
    recipient_first: z.string(),
    recipient_last: z.string(),
    // TrAddressFields' fields, at the form's top level
    address_1: z.string(),
    address_2: z.string(),
    province: z.string(),
    city: z.string(),
    postal_code: z.string(),
    phone: z.string(),
    shipping_option_id: z.string(),
    discountOn: z.boolean(),
    discountType: z.enum(["percentage", "fixed"]),
    discountValue: z.string(),
    discountReason: z.string(),
    note: z.string(),
    hours: z.string(),
  })
  .superRefine((values, ctx) => {
    const fail = (path: (string | number)[], key: string) => {
      ctx.addIssue({ code: "custom", path, message: `${E}.${key}` })
    }
    const name = (value: string) => value.trim().length > 0 && value.trim().length <= 60
    if (values.customerMode === "existing" && !values.customer) {
      fail(["customer"], "customer")
    }
    if (values.customerMode === "guest") {
      const { guest } = values
      if (!name(guest.first_name)) {
        fail(["guest", "first_name"], "name")
      }
      if (!name(guest.last_name)) {
        fail(["guest", "last_name"], "name")
      }
      if (!z.email().max(100).safeParse(guest.email.trim()).success) {
        fail(["guest", "email"], "email")
      }
      if (guest.phone.trim().length > 20 || !trAddressShape.phone.safeParse(guest.phone).success) {
        fail(["guest", "phone"], "phone")
      }
    }
    if (values.lines.length === 0) {
      fail(["lines"], "lines")
    }
    values.lines.forEach((each, index) => {
      if (!Number.isInteger(each.quantity) || each.quantity < 1 || each.quantity > MAX_QUANTITY) {
        fail(["lines", index, "quantity"], "quantity")
      }
    })
    if (values.deliver) {
      if (!name(values.recipient_first)) {
        fail(["recipient_first"], "name")
      }
      if (!name(values.recipient_last)) {
        fail(["recipient_last"], "name")
      }
      for (const key of ["address_1", "address_2", "province", "city", "postal_code"] as const) {
        const result = trAddressShape[key].safeParse(values[key])
        if (!result.success) {
          ctx.addIssue({ code: "custom", path: [key], message: result.error.issues[0]?.message })
        }
      }
      if (
        values.phone.trim().length > 20 ||
        !trAddressShape.phone.safeParse(values.phone).success
      ) {
        fail(["phone"], "phone")
      }
    }
    if (values.discountOn) {
      if (discountNumber(values.discountType, values.discountValue) === null) {
        fail(["discountValue"], values.discountType === "percentage" ? "percent" : "amount")
      }
      const reason = values.discountReason.trim()
      if (reason.length === 0 || reason.length > 200) {
        fail(["discountReason"], "reason")
      }
    }
    if (values.note.trim().length > 1000) {
      fail(["note"], "note")
    }
    if (hoursOf(values.hours) === null) {
      fail(["hours"], "hours")
    }
  })

export type LinkFormValues = z.infer<typeof linkFormSchema>

export const EMPTY_FORM: LinkFormValues = {
  customerMode: "existing",
  customer: null,
  guest: { first_name: "", last_name: "", email: "", phone: "" },
  lines: [],
  deliver: false,
  recipient_first: "",
  recipient_last: "",
  address_1: "",
  address_2: "",
  province: "",
  city: "",
  postal_code: "",
  phone: "",
  shipping_option_id: "",
  discountOn: false,
  discountType: "percentage",
  discountValue: "",
  discountReason: "",
  note: "",
  hours: String(DEFAULT_HOURS),
}

/** What the backend takes: a whole percent (1–99), or kuruş from the lira typed. */
export function discountNumber(type: DiscountType, text: string): number | null {
  if (type === "percentage") {
    const percent = parseCountInput(text)
    return percent !== null && percent >= 1 && percent <= MAX_PERCENT ? percent : null
  }
  const lira = parseMoneyInput(text)
  return lira !== null && lira > 0 && lira <= MAX_FIXED_LIRA ? Math.round(lira * 100) : null
}

export function hoursOf(text: string): number | null {
  const hours = parseCountInput(text)
  return hours !== null && hours >= MIN_HOURS && hours <= MAX_HOURS ? hours : null
}
