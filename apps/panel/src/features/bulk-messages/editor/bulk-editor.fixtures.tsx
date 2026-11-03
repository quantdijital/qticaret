import { QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import type { Mock } from "vitest"
import type { AudiencePreview, BulkMessage } from "@/features/bulk-messages/api/types"
import { campaign, clientWith, preview } from "@/features/bulk-messages/bulk-messages.fixtures"
import { BulkEditor } from "./bulk-editor"

/** What the editor's specs share: the shop's settings, the server and the editor. */

const MARKETING = {
  abandoned_cart_enabled: false,
  abandoned_cart_delay_minutes: 60,
  feed_exclusions: { google: [], meta: [], cimri: [], akakce: [] },
  feed_same_day_cutoff_hour: null,
  campaign_frequency_cap: true,
  campaign_sms_start_hour: 9,
  campaign_sms_end_hour: 20,
  sms_opt_out_text: "Ret için RET yazıp 4609'a gönderin",
}

/** The text the preview route renders, the staff member's name in it. */
export const SMS_SHOWN = "Selin, kış indirimi başladı. Bıçakçı. Ret için RET yazıp 4609'a gönderin"

/** An answer as the browser's fetch gives it (a save goes past the SDK). */
export const json = (status: number, body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  )

export interface EditorMocks {
  /** `sdk.client.fetch`. */
  fetch: Mock
  /** The browser's `fetch`, which a save goes through. */
  save: Mock
}

export interface Served {
  stored?: BulkMessage
  audience?: AudiencePreview
  /** The backend's parts for the stored text, at its longest. */
  smsParts?: number
}

function serve(
  mocks: EditorMocks,
  { stored = campaign(), audience = preview(), smsParts = 2 }: Served
) {
  mocks.save.mockImplementation((_url: string, init: { body: string }) =>
    json(200, { campaign: { ...stored, ...(JSON.parse(init.body) as Partial<BulkMessage>) } })
  )
  mocks.fetch.mockImplementation((url: string, init?: { query?: { channel?: string } }) => {
    switch (url) {
      case "/admin/customer-segments":
        return Promise.resolve({
          segments: [
            {
              id: "cseg_1",
              name: "Sadık müşteriler",
              rules: {},
              customer_group_id: "cusgroup_seg",
              member_count: 120,
              refreshed_at: null,
            },
          ],
        })
      case "/admin/customer-groups":
        return Promise.resolve({
          customer_groups: [
            { id: "cusgroup_1", name: "Toptancılar", metadata: null, customers: [{ id: "c1" }] },
            {
              id: "cusgroup_seg",
              name: "Sadık müşteriler",
              metadata: { managed_by: "segment" },
              customers: [],
            },
          ],
        })
      case "/admin/shop-tokens":
        return Promise.resolve({
          tokens: [
            { name: "mağaza_adı", value: "Bıçakçı" },
            { name: "telefon", value: "0532 000 00 00" },
          ],
        })
      case "/admin/platform-settings/marketing":
        return Promise.resolve({ section: "marketing", values: MARKETING, version: 1 })
      case "/admin/bulk-messages/bm_1/audience-preview":
        return Promise.resolve(audience)
      case "/admin/bulk-messages/bm_1/preview":
        return Promise.resolve(
          init?.query?.channel === "sms"
            ? { text: SMS_SHOWN, parts: smsParts }
            : { subject: "Selin, kış indirimi başladı", preheader: "", html: "<p>Merhaba</p>" }
        )
      default:
        return Promise.reject(new Error(`unexpected ${url}`))
    }
  })
}

/** The editor for a stored campaign, the server answering for it. */
export function renderEditor(mocks: EditorMocks, served: Served = {}) {
  serve(mocks, served)
  return render(
    <QueryClientProvider client={clientWith()}>
      <BulkEditor campaign={served.stored ?? campaign()} />
    </QueryClientProvider>
  )
}

/** The saves made, their bodies read back. */
export const savesOf = (save: Mock) =>
  (save.mock.calls as [string, { method: string; body: string }][])
    .filter(([url]) => url === "/admin/bulk-messages/bm_1")
    .map(([, init]) => ({ method: init.method, body: JSON.parse(init.body) as unknown }))
