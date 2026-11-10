import { formatMoneyInput } from "@qticaret/admin-ui/lib/money-input"
import type { LinkInput, PaymentLink, PreviewInput } from "./api/types"
import { DEFAULT_HOURS, EMPTY_FORM, MAX_QUANTITY, discountNumber, hoursOf } from "./form"
import type { FormLine, LinkFormValues } from "./form"

/** The form's values as the backend takes them, and a link back into the form. */

type PreviewFields = Pick<
  LinkFormValues,
  | "customerMode"
  | "customer"
  | "lines"
  | "deliver"
  | "shipping_option_id"
  | "discountOn"
  | "discountType"
  | "discountValue"
  | "discountReason"
>

const linesOf = (lines: readonly FormLine[]) =>
  lines.map(({ variant_id, quantity }) => ({ variant_id, quantity }))

const trimmed = (value: string) => {
  const text = value.trim()
  return text ? text : undefined
}

/** The discount when it can go: the role may give one, and its value and reason are whole. */
function discountOf(values: PreviewFields, canDiscount: boolean) {
  if (!canDiscount || !values.discountOn) {
    return undefined
  }
  const value = discountNumber(values.discountType, values.discountValue)
  const reason = values.discountReason.trim()
  return value !== null && reason && reason.length <= 200
    ? { type: values.discountType, value, reason }
    : undefined
}

/**
 * What the summary asks the backend: the lines with a whole quantity, the
 * customer for their group's prices, and the discount once it is whole.
 * Null while there is nothing to price.
 */
export function previewOf(values: PreviewFields, canDiscount: boolean): PreviewInput | null {
  const lines = linesOf(
    values.lines.filter(
      (each) =>
        Number.isInteger(each.quantity) && each.quantity >= 1 && each.quantity <= MAX_QUANTITY
    )
  )
  if (lines.length === 0) {
    return null
  }
  const discount = discountOf(values, canDiscount)
  return {
    ...(values.customerMode === "existing" && values.customer
      ? { customer_id: values.customer.id }
      : {}),
    lines,
    ...(discount ? { discount } : {}),
    ...(values.deliver && values.shipping_option_id
      ? { shipping_option_id: values.shipping_option_id }
      : {}),
  }
}

/** The request for a valid form: a customer or a guest, never a price. */
export function requestOf(values: LinkFormValues, canDiscount: boolean): LinkInput {
  const discount = discountOf(values, canDiscount)
  const guestPhone = trimmed(values.guest.phone)
  const note = trimmed(values.note)
  const address = values.deliver
    ? {
        first_name: values.recipient_first.trim(),
        last_name: values.recipient_last.trim(),
        address_1: values.address_1.trim(),
        city: values.city,
        province: values.province,
        ...(trimmed(values.phone) ? { phone: values.phone.trim() } : {}),
        ...(trimmed(values.address_2) ? { address_2: values.address_2.trim() } : {}),
        ...(trimmed(values.postal_code) ? { postal_code: values.postal_code.trim() } : {}),
      }
    : null
  return {
    ...(values.customerMode === "existing" && values.customer
      ? { customer_id: values.customer.id }
      : {
          guest: {
            first_name: values.guest.first_name.trim(),
            last_name: values.guest.last_name.trim(),
            email: values.guest.email.trim(),
            ...(guestPhone ? { phone: guestPhone } : {}),
          },
        }),
    lines: linesOf(values.lines),
    ...(discount ? { discount } : {}),
    ...(address ? { address } : {}),
    ...(address && values.shipping_option_id
      ? { shipping_option_id: values.shipping_option_id }
      : {}),
    ...(note ? { note } : {}),
    expires_in_hours: hoursOf(values.hours) ?? DEFAULT_HOURS,
  }
}

export const lineLabel = (line: { title: string; variant_title: string | null }) =>
  [line.title, line.variant_title].filter(Boolean).join(" · ")

/**
 * "Yeniden oluştur": the same customer, lines, address, discount and note,
 * as a new form; no price comes along (the preview prices it today).
 */
export function valuesFromLink(link: PaymentLink, canDiscount: boolean): LinkFormValues {
  const contact = link.contact
  const customerLabel = contact
    ? [`${contact.first_name} ${contact.last_name}`.trim(), contact.email]
        .filter(Boolean)
        .join(" · ")
    : (link.customer.name ?? link.customer.id ?? "")
  const discount = canDiscount ? link.discount : null
  return {
    ...EMPTY_FORM,
    ...(link.customer.id
      ? { customerMode: "existing", customer: { id: link.customer.id, label: customerLabel } }
      : {
          customerMode: "guest",
          guest: {
            first_name: contact?.first_name ?? "",
            last_name: contact?.last_name ?? "",
            email: contact?.email ?? "",
            phone: contact?.phone ?? "",
          },
        }),
    lines: link.lines.map((each) => ({
      variant_id: each.variant_id,
      label: lineLabel(each),
      quantity: each.quantity,
    })),
    ...(link.address
      ? {
          deliver: true,
          recipient_first: link.address.first_name,
          recipient_last: link.address.last_name,
          address_1: link.address.address_1,
          address_2: link.address.address_2 ?? "",
          province: link.address.province,
          city: link.address.city,
          postal_code: link.address.postal_code ?? "",
          phone: link.address.phone ?? "",
          shipping_option_id: link.shipping_option_id ?? "",
        }
      : {}),
    ...(discount
      ? {
          discountOn: true,
          discountType: discount.type,
          discountValue:
            discount.type === "percentage"
              ? String(discount.value)
              : formatMoneyInput(discount.value / 100),
          discountReason: discount.reason,
        }
      : {}),
    note: link.note ?? "",
  }
}
