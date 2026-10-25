import { keepPreviousData, queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

export const CUSTOMER_PAGE_SIZE = 20
export const CUSTOMER_KINDS = ["all", "registered", "guest"] as const
export type CustomerKind = (typeof CUSTOMER_KINDS)[number]

const LIST_FIELDS = "id,first_name,last_name,email,phone,company_name,has_account,created_at"

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
          fields: `${LIST_FIELDS},addresses.*`,
        })
      ).customer,
  })

export type CustomerDetail = Awaited<ReturnType<typeof sdk.admin.customer.retrieve>>["customer"]

// What the order page's stage rule needs, and what a row shows
const ORDER_FIELDS = [
  "id",
  "display_id",
  "status",
  "created_at",
  "currency_code",
  "total",
  "items.id",
  "items.quantity",
  "items.detail.fulfilled_quantity",
  "fulfillments.id",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.canceled_at",
  "payment_collections.status",
  "payment_collections.payments.id",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
].join(",")

export const CUSTOMER_ORDERS_SHOWN = 10

export const customerOrdersQuery = (customerId: string) =>
  queryOptions({
    queryKey: ["customers", "orders", customerId],
    queryFn: () =>
      sdk.admin.order.list({
        customer_id: customerId,
        fields: ORDER_FIELDS,
        limit: CUSTOMER_ORDERS_SHOWN,
        order: "-created_at",
      }),
  })

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
        `/admin/customers/${customerId}/billing-profile`
      ),
  })
