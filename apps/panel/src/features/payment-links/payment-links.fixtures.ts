import { QueryClient } from "@tanstack/react-query"
import { STAFF_KEY } from "@/features/auth/api/staff"
import type { StaffMe, StaffRole } from "@/features/auth/api/staff"
import { staff as ownerStaff } from "@/features/bulk-messages/bulk-messages.fixtures"
import { featuresQuery } from "@/features/settings/api/features"
import { teamQuery } from "@/features/settings/api/team"
import type { Team } from "@/features/settings/api/team"
import type { LinkPreview, LinkShare, PaymentLink, PaymentLinkSummary } from "./api/types"

/** The payment links' screens' test data, shaped as the backend's views give it. */

export const VARIANT_A = "variant_01JA0000000000000000000AAA"
export const VARIANT_B = "variant_01JB0000000000000000000BBB"

/** What each role may, as the backend's capability probes say (adr/0051 §8). */
export function staffAs(role: StaffRole): StaffMe {
  const owner = ownerStaff("owner")
  const manages = role === "owner" || role === "admin"
  return {
    ...owner,
    role,
    can: {
      ...owner.can,
      settings: manages,
      team: manages,
      paymentLinks: role !== "readonly",
      paymentLinksManage: manages,
    },
  }
}

export const TEAM: Team = {
  staff: [
    {
      id: "user_1",
      email: "sahip@example.com",
      first_name: "Deniz",
      last_name: "Kaya",
      created_at: "2026-10-01T09:00:00Z",
      role: "owner",
      you: true,
      mfa: true,
    },
    {
      id: "user_2",
      email: "ops@example.com",
      first_name: "Ece",
      last_name: "Demir",
      created_at: "2026-10-02T09:00:00Z",
      role: "operations",
      you: false,
      mfa: false,
    },
  ],
  invites: null,
}

/** A client with the person, the shop's flag and, where readable, the team known (nothing refetches). */
export function clientWith({
  role = "owner",
  flag = true,
}: { role?: StaffRole; flag?: boolean } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(STAFF_KEY, staffAs(role))
  client.setQueryData(featuresQuery().queryKey, [
    { key: "orders.payment_links", default: false, owner: "tenant", enabled: flag },
  ])
  // The team is the owner's and admins' to read (`GET /admin/staff`)
  if (role === "owner" || role === "admin") {
    client.setQueryData(teamQuery().queryKey, TEAM)
  }
  return client
}

export const summary = (more: Partial<PaymentLinkSummary> = {}): PaymentLinkSummary => ({
  id: "plink_01",
  number: "PL-1042",
  status: "open",
  customer: { id: null, name: "Ayşe Y.", email: "a***@example.com" },
  items_total: 27_000,
  discount_total: 0,
  total: 27_000,
  discount: null,
  currency_code: "try",
  created_by: "user_2",
  created_at: "2026-11-03T09:00:00Z",
  expires_at: "2026-11-06T09:00:00Z",
  opened_count: 0,
  sent_count: 0,
  order_id: null,
  ...more,
})

export const link = (more: Partial<PaymentLink> = {}): PaymentLink => ({
  ...summary(),
  contact: {
    first_name: "Ayşe",
    last_name: "Yılmaz",
    email: "ayse.yilmaz@example.com",
    phone: "+905321234567",
  },
  address: null,
  lines: [
    {
      variant_id: VARIANT_A,
      product_id: "prod_1",
      quantity: 2,
      title: "Şef bıçağı",
      variant_title: "20 cm",
      thumbnail: null,
      unit_price: 13_500,
      total: 27_000,
    },
  ],
  shipping_option_id: null,
  note: "Instagram'dan yazdı",
  token_ends_at: "2026-11-10T09:00:00Z",
  cart_id: null,
  last_opened_at: null,
  last_sent_at: null,
  paid_at: null,
  canceled_by: null,
  closed_at: null,
  ...more,
})

export const share = (more: Partial<LinkShare> = {}): LinkShare => ({
  url: "https://magaza.example.com/ode/pl_token",
  sms_text:
    "Mağaza: Siparişiniz hazır, toplam ₺270,00. Ödeme bağlantısı (3 gün geçerli): https://magaza.example.com/ode/pl_token",
  whatsapp_url: "https://wa.me/905321234567?text=Ma%C4%9Faza",
  email_sent: false,
  sms_sent: false,
  ...more,
})

export const preview = (more: Partial<LinkPreview> = {}): LinkPreview => ({
  lines: link().lines,
  items_total: 27_000,
  discount: null,
  total: 27_000,
  short_variant_ids: [],
  currency_code: "try",
  ...more,
})

/** An API refusal as the SDK throws it: the status and the backend's sentence. */
export const refused = (status: number, message = "refused") =>
  Object.assign(new Error(message), { status, message })

/** The element around one, by selector (a card around its title); a test fails without it. */
export function around(element: HTMLElement, selector: string): HTMLElement {
  const found = element.closest<HTMLElement>(selector)
  if (!found) {
    throw new Error(`No ${selector} around "${element.textContent}"`)
  }
  return found
}
