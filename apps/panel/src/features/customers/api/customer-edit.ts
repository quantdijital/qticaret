import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

// The detail page's own fields, so an answer can stand in for its read
const DETAIL_FIELDS =
  "id,first_name,last_name,email,company_name,has_account,created_at,phone,*addresses"

/** A customer's own details as staff write them (2026-11-06); the server checks the phone. */
export interface CustomerFields {
  first_name: string | null
  last_name: string | null
  /** A guest's only: a member's e-mail is their sign-in, the server refuses a change. */
  email?: string
  phone: string | null
  company_name: string | null
}

/** A Turkish address as Medusa stores it (F1.4): il in `province`, ilçe in `city`, mahalle in `address_2`. */
export interface CustomerAddressFields {
  address_name: string | null
  first_name: string
  last_name: string
  address_1: string
  address_2: string
  province: string
  city: string
  postal_code: string
  phone: string
  country_code: "tr"
}

export interface CustomerNote {
  body: string
  updated_at: string | null
  updated_by: string | null
}

const customerPath = (id: string) => `/admin/customers/${encodeURIComponent(id)}`

interface Saved {
  customer: { id: string }
}

/** "Yeni müşteri": a guest, no account and no invitation; their consent is theirs to give. */
export const createCustomer = (body: CustomerFields & { email: string }) =>
  sdk.client.fetch<Saved>("/admin/customers", { method: "POST", body })

export const customerNoteQuery = (customerId: string) =>
  queryOptions({
    queryKey: ["customers", "note", customerId],
    queryFn: async () =>
      (await sdk.client.fetch<{ note: CustomerNote }>(`${customerPath(customerId)}/note`)).note,
  })

/** The customer's details and the team's note on them, saved from one window. */
export function useSaveCustomer(customerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: { fields?: CustomerFields; note?: string }) => {
      if (input.fields) {
        await sdk.client.fetch<Saved>(customerPath(customerId), {
          method: "POST",
          body: input.fields,
          query: { fields: DETAIL_FIELDS },
        })
      }
      if (input.note !== undefined) {
        await sdk.client.fetch(`${customerPath(customerId)}/note`, {
          method: "POST",
          body: { body: input.note },
        })
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["customers"] }),
  })
}

/** An address added, changed (with `addressId`) or deleted (`remove`). */
export function useSaveCustomerAddress(customerId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      addressId?: string
      fields?: CustomerAddressFields
      remove?: boolean
    }) => {
      const base = `${customerPath(customerId)}/addresses`
      const path = input.addressId ? `${base}/${encodeURIComponent(input.addressId)}` : base
      return input.remove
        ? sdk.client.fetch(path, { method: "DELETE" })
        : sdk.client.fetch<Saved>(path, {
            method: "POST",
            body: input.fields,
            query: { fields: DETAIL_FIELDS },
          })
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["customers", "detail", customerId] }),
  })
}
