import { QueryClient } from "@tanstack/react-query"
import { STAFF_KEY } from "@/features/auth/api/staff"
import type { StaffMe } from "@/features/auth/api/staff"
import { featuresQuery } from "@/features/settings/api/features"
import type {
  AudiencePreview,
  BulkCounts,
  BulkMessage,
  BulkMessageSummary,
  BulkReport,
} from "./api/types"

/** The bulk messages' screens' test data, shaped as the backend's views give it. */

export const noSkips = () => ({
  no_consent: 0,
  suppressed: 0,
  iys_pending: 0,
  recent: 0,
  invalid_recipient: 0,
  over_quota: 0,
})

export const counts = (more: Partial<BulkCounts> = {}): BulkCounts => ({
  audience: 0,
  targeted: 0,
  pending: 0,
  sent: 0,
  failed: 0,
  skipped: noSkips(),
  bounces: 0,
  complaints: 0,
  unsubscribed: 0,
  ...more,
})

export const summary = (more: Partial<BulkMessageSummary> = {}): BulkMessageSummary => ({
  id: "bm_1",
  name: "Kış indirimi",
  channel: "email",
  audience: [{ kind: "all_consented" }],
  status: "draft",
  paused_reason: null,
  scheduled_at: null,
  started_at: null,
  finished_at: null,
  counts: counts(),
  created_at: "2026-11-01T09:00:00Z",
  updated_at: "2026-11-01T09:00:00Z",
  ...more,
})

export const campaign = (more: Partial<BulkMessage> = {}): BulkMessage => ({
  ...summary(),
  subject: "{ad}, kış indirimi başladı",
  preheader: "Seçili ürünlerde %20",
  body: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Merhaba {ad}" }] }],
  },
  sms_text: null,
  utm_campaign: "kis-indirimi-a1b2c3",
  failure_reason: null,
  created_by: "user_1",
  sent_by: null,
  editable: true,
  ...more,
})

export const preview = (more: Partial<AudiencePreview> = {}): AudiencePreview => ({
  channel: "email",
  audience: 1500,
  eligible: 1240,
  excluded: { ...noSkips(), no_consent: 200, iys_pending: 40, recent: 20 },
  quota: { limit: 5000, left: 5000, today: 1240, later: 0 },
  sms: null,
  ...more,
})

export const report = (more: Partial<BulkReport> = {}): BulkReport => ({
  id: "bm_1",
  name: "Kış indirimi",
  channel: "email",
  status: "sent",
  paused_reason: null,
  utm_campaign: "kis-indirimi-a1b2c3",
  started_at: "2026-11-02T09:00:00Z",
  finished_at: "2026-11-02T10:00:00Z",
  counts: counts({
    audience: 1500,
    targeted: 1240,
    sent: 1200,
    failed: 4,
    pending: 36,
    skipped: { ...noSkips(), no_consent: 200, suppressed: 12, over_quota: 36 },
    bounces: 6,
    complaints: 1,
    unsubscribed: 9,
  }),
  traffic: { carts: 48, orders: 12, revenue: 18450.5 },
  ...more,
})

const CAN_ALL = {
  settings: true,
  catalog: true,
  marketing: true,
  orders: true,
  money: true,
  stock: true,
  moderation: true,
  accounts: true,
  keys: true,
  security: true,
  maintenance: true,
  team: true,
  staff: true,
  audit: true,
  taxId: true,
  travelerDocuments: true,
  travelerRequests: true,
  privacy: true,
  invoices: true,
  migration: true,
  fraud: true,
  bulkMessages: true,
  paymentLinks: true,
  paymentLinksManage: true,
  legalTexts: true,
  vatRates: true,
  searchSynonyms: true,
  orderExport: true,
  customers: true,
  abandonedCarts: true,
  resendMessages: true,
  wholesale: true,
}

export const staff = (role: "owner" | "operations"): StaffMe => ({
  user_id: "user_1",
  role,
  can:
    role === "owner"
      ? CAN_ALL
      : {
          ...CAN_ALL,
          settings: false,
          bulkMessages: false,
          paymentLinksManage: false,
          legalTexts: false,
          vatRates: false,
          searchSynonyms: false,
          orderExport: false,
          migration: false,
          team: false,
          wholesale: false,
        },
  mfa: { available: true, required: false, enabled: true, passed: true },
})

/** A client with the person and the shop's flags already known (and kept: nothing refetches them). */
export function clientWith({
  role = "owner",
  flag = true,
}: { role?: "owner" | "operations"; flag?: boolean } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(STAFF_KEY, staff(role))
  client.setQueryData(featuresQuery().queryKey, [
    { key: "marketing.campaigns", default: false, owner: "tenant", enabled: flag },
  ])
  return client
}
