import { keepPreviousData, queryOptions, useMutation } from "@tanstack/react-query"
import { withReauth } from "@/lib/reauth"
import { sdk } from "@/lib/sdk"

export const CUSTOMER_PAGE_SIZE = 20
export const CUSTOMER_KINDS = ["all", "registered", "guest"] as const
export type CustomerKind = (typeof CUSTOMER_KINDS)[number]

// No phone in the list (docs/04: masked in lists); the detail page, a recorded read, shows it
const LIST_FIELDS = "id,first_name,last_name,email,company_name,has_account,created_at"

export interface CustomerListParams {
  q: string
  kind: CustomerKind
  page: number
}

/** Medusa's customer list: a recorded read of personal data (adr/0011). */
export const customersQuery = ({ q, kind, page }: CustomerListParams) =>
  queryOptions({
    queryKey: ["customers", "list", { q, kind, page }],
    queryFn: () =>
      sdk.admin.customer.list({
        fields: LIST_FIELDS,
        limit: CUSTOMER_PAGE_SIZE,
        offset: page * CUSTOMER_PAGE_SIZE,
        order: "-created_at",
        ...(q ? { q } : {}),
        ...(kind === "all" ? {} : { has_account: kind === "registered" }),
      }),
    placeholderData: keepPreviousData,
  })

export type CustomerListItem = Awaited<
  ReturnType<typeof sdk.admin.customer.list>
>["customers"][number]

/** How many customers each tab holds. */
export const customerCountsQuery = () =>
  queryOptions({
    queryKey: ["customers", "counts"],
    queryFn: async () => {
      const count = async (has_account?: boolean) =>
        (
          await sdk.admin.customer.list({
            fields: "id",
            limit: 1,
            ...(has_account === undefined ? {} : { has_account }),
          })
        ).count
      const [all, registered, guest] = await Promise.all([count(), count(true), count(false)])
      return { all, registered, guest }
    },
  })

export const customerQuery = (id: string) =>
  queryOptions({
    queryKey: ["customers", "detail", id],
    queryFn: async () =>
      (
        await sdk.admin.customer.retrieve(id, {
          fields: `${LIST_FIELDS},phone,addresses.*`,
        })
      ).customer,
  })

export type CustomerDetail = Awaited<ReturnType<typeof sdk.admin.customer.retrieve>>["customer"]

/** The customer's invoice details, masked (adr/0009): the full tax id is never shown here. */
export interface MaskedBillingProfile {
  id: string
  type: "individual" | "corporate"
  legal_name: string
  tax_office: string | null
  tax_id_kind: "tckn" | "vkn"
  tax_id_masked: string
}

export const billingProfileQuery = (customerId: string) =>
  queryOptions({
    queryKey: ["customers", "billing-profile", customerId],
    queryFn: () =>
      sdk.client.fetch<{ billing_profile: MaskedBillingProfile | null }>(
        `/admin/customers/${encodeURIComponent(customerId)}/billing-profile`
      ),
  })

/** The full tax id, for an invoice by hand: owner and admin, proved again, recorded (F12.6). */
export function useRevealTaxId(customerId: string) {
  return useMutation({
    mutationFn: () =>
      withReauth((extra) =>
        sdk.client.fetch<{ tax_id: string; kind: "tckn" | "vkn" }>(
          `/admin/customers/${encodeURIComponent(customerId)}/billing-profile/reveal`,
          { method: "POST", body: {}, ...extra }
        )
      ),
    // The number is not kept once nothing shows it
    gcTime: 0,
  })
}

export type ConsentChannel = "email" | "sms"

export interface ConsentState {
  /** Whether the customer has an address for the channel at all. */
  address: boolean
  consent: {
    status: "granted" | "revoked"
    source: "checkout" | "account" | "panel" | "import" | "iys" | "unsubscribe" | "newsletter"
    changed_at: string
  } | null
}

export type CustomerConsents = Record<ConsentChannel, ConsentState>

/** Whether the customer takes commercial e-mail and SMS (F9.5): a recorded read. */
export const customerConsentsQuery = (customerId: string) =>
  queryOptions({
    queryKey: ["customers", "consents", customerId],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ consents: CustomerConsents }>(
          `/admin/customers/${encodeURIComponent(customerId)}/consents`
        )
      ).consents,
  })

/**
 * Records a consent the customer gave or withdrew outside the storefront;
 * a grant says how the customer gave it (the proof İYS asks for).
 */
export const saveCustomerConsent = async (
  customerId: string,
  body: { channel: ConsentChannel; status: "granted" | "revoked"; evidence?: string }
) =>
  (
    await sdk.client.fetch<{ consents: CustomerConsents }>(
      `/admin/customers/${encodeURIComponent(customerId)}/consents`,
      { method: "POST", body }
    )
  ).consents
