import "server-only"
import { z } from "zod"
import { districtsOf, neighborhoodsOf, provinces } from "./address"

/**
 * The address form as the cart takes it (D7): the selects' plate and ids
 * turned back into the names the backend checks (`province`, `city` =
 * district, `address_2` = neighbourhood) and the neighbourhood's postal
 * code. The backend checks it all again (F1 `tr-address`).
 */
const AddressForm = z.object({
  email: z.email().max(254),
  phone: z
    .string()
    .transform((value) => value.replace(/[\s()-]/g, ""))
    .pipe(z.string().regex(/^(?:\+90|0090|90|0)?[2-58]\d{9}$/)),
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().min(1).max(60),
  province: z.string().regex(/^\d{1,2}$/),
  district: z.string().regex(/^trdst_[0-9A-Za-z]{1,64}$/),
  neighborhood: z.string().regex(/^trnbh_[0-9A-Za-z]{1,64}$/),
  address_1: z.string().trim().min(5).max(200),
})

export interface CartAddress {
  email: string
  first_name: string
  last_name: string
  phone: string
  address_1: string
  address_2: string
  city: string
  province: string
  postal_code: string
}

type Parsed = { ok: true; value: CartAddress } | { ok: false; error: string }

const FIELD_ERRORS: Record<string, string> = {
  email: "checkout.email_invalid",
  phone: "checkout.phone_invalid",
  first_name: "checkout.name_required",
  last_name: "checkout.name_required",
  province: "checkout.location_required",
  district: "checkout.location_required",
  neighborhood: "checkout.location_required",
  address_1: "checkout.street_required",
}

export async function addressFromForm(form: FormData): Promise<Parsed> {
  const parsed = AddressForm.safeParse(Object.fromEntries(form))
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] ?? "")
    return { ok: false, error: FIELD_ERRORS[field] ?? "checkout.address_invalid" }
  }
  const input = parsed.data
  const province = (await provinces()).find(
    (each) => each.code === input.province.replace(/^0/, "")
  )
  const district = province
    ? (await districtsOf(province.code)).find((each) => each.id === input.district)
    : undefined
  const neighborhood = district
    ? (await neighborhoodsOf(district.id)).find((each) => each.id === input.neighborhood)
    : undefined
  if (!province || !district || !neighborhood) {
    return { ok: false, error: "checkout.location_required" }
  }
  return {
    ok: true,
    value: {
      email: input.email,
      first_name: input.first_name,
      last_name: input.last_name,
      phone: input.phone,
      address_1: input.address_1,
      address_2: neighborhood.name,
      city: district.name,
      province: province.name,
      postal_code: neighborhood.postal_code,
    },
  }
}

/** The cart update: the same address for delivery and the invoice (a guest's e-Arşiv reads it). */
export function addressPayload(address: CartAddress) {
  const { email, ...rest } = address
  const shipping = { ...rest, country_code: "tr" }
  return { email, shipping_address: shipping, billing_address: shipping }
}
