import type { PopupDetail } from "./api/types"

/** A saved pop-up as `GET /admin/popups/:id` answers it; the backend's defaults unless said. */
export function popupFixture(overrides: Partial<PopupDetail> = {}): PopupDetail {
  return {
    id: "popup_1",
    name: "Kargo duyurusu",
    type: "info",
    is_active: true,
    starts_at: null,
    ends_at: null,
    priority: 0,
    title: "500 TL üzeri kargo bedava",
    body: null,
    image_url: null,
    image_alt: null,
    button_label: null,
    button_href: null,
    promotion_id: null,
    page_scope: "all",
    pages: [],
    device: "all",
    visitor: "any",
    membership: "any",
    trigger: "delay",
    trigger_value: 5,
    frequency: "days",
    frequency_days: 7,
    layout: "modal",
    created_at: "2026-11-20T09:00:00Z",
    updated_at: "2026-11-20T09:00:00Z",
    state: "live",
    promotion: null,
    counts: { impressions: 0, clicks: 0, closes: 0, signups: 0 },
    daily: [],
    ...overrides,
  }
}
