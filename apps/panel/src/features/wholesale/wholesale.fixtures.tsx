import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import type { ReactNode } from "react"
import { STAFF_KEY } from "@/features/auth/api/staff"
import { featuresQuery } from "@/features/settings/api/features"
import type { LinesPage, WholesaleAccount, WholesaleLine, WholesaleTier } from "./api/types"
import { WHOLESALE_FLAG } from "./api/types"

/** The wholesale screens' test data, as `/admin/wholesale/*` answers it. */

export const account = (more: Partial<WholesaleAccount> = {}): WholesaleAccount => ({
  id: "wsa_1",
  status: "active",
  email: "satinalma@kayabicak.com.tr",
  company_name: "Kaya Bıçak Ltd",
  contact_name: "Ali Kaya",
  customer: { id: "cus_1", email: "satinalma@kayabicak.com.tr" },
  tier: { id: "wst_1", name: "Toptan A" },
  own_prices: false,
  percent: null,
  min_quantity: null,
  sync_pending: false,
  invited_at: null,
  invitation_expires_at: null,
  invitations_sent: null,
  activated_at: "2026-11-10T09:00:00Z",
  deactivated_at: null,
  created_at: "2026-11-10T09:00:00Z",
  ...more,
})

export const pendingAccount = (more: Partial<WholesaleAccount> = {}) =>
  account({
    id: "wsa_2",
    status: "pending",
    email: "siparis@yilmazticaret.com",
    company_name: "Yılmaz Ticaret",
    contact_name: "Ayşe Yılmaz",
    customer: null,
    invited_at: "2026-11-14T09:00:00Z",
    invitation_expires_at: "2027-02-12T09:00:00Z",
    invitations_sent: 2,
    activated_at: null,
    ...more,
  })

export const tier = (more: Partial<WholesaleTier> = {}): WholesaleTier => ({
  id: "wst_1",
  name: "Toptan A",
  percent: 20,
  min_quantity: 10,
  sync_pending: false,
  synced_at: "2026-11-14T09:00:00Z",
  created_at: "2026-11-01T09:00:00Z",
  ...more,
})

export const line = (more: Partial<WholesaleLine> = {}): WholesaleLine => ({
  variant_id: "variant_1",
  variant_title: "20 cm",
  sku: "SEF-20",
  product_id: "prod_1",
  product_title: "Şef bıçağı",
  thumbnail: null,
  net: "800.00",
  gross: "960.00",
  vat_bps: 2000,
  vat_percent: 20,
  source: "rate",
  base: "1200.00",
  retail_now: "1200.00",
  undercut: false,
  ...more,
})

export const linesPage = (lines: WholesaleLine[], more: Partial<LinesPage> = {}): LinesPage => ({
  lines,
  count: lines.length,
  limit: 25,
  offset: 0,
  undercut_count: lines.filter((each) => each.undercut).length,
  rate_zero: { count: 0, variant_ids: [] },
  ...more,
})

const ALL_CAN = { settings: true, customers: true, wholesale: true }

/** A client that already knows the person and the shop's flags (nothing refetches them). */
export function clientWith({
  role = "owner",
  flag = true,
}: { role?: "owner" | "admin" | "operations"; flag?: boolean } = {}): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  const can =
    role === "operations" ? { settings: false, customers: true, wholesale: false } : ALL_CAN
  client.setQueryData(STAFF_KEY, { user_id: "user_1", role, can })
  client.setQueryData(featuresQuery().queryKey, [
    { key: WHOLESALE_FLAG, default: false, owner: "tenant", enabled: flag },
  ])
  return client
}

/** One of several matches (a page's action and its empty state's), or a clear failure. */
export function nth(elements: HTMLElement[], index: number): HTMLElement {
  const element = elements[index]
  if (!element) {
    throw new Error(`no element ${String(index)} of ${String(elements.length)}`)
  }
  return element
}

export function renderWith(client: QueryClient, ui: ReactNode) {
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}
