import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StorePopup } from "@qticaret/types/popups"

const state = vi.hoisted(() => ({
  on: true,
  popups: [] as unknown[],
  fail: false,
  posted: [] as { path: string; body: unknown }[],
}))
vi.mock("@/lib/env", () => ({
  storefrontEnv: () => ({
    MEDUSA_BACKEND_URL: "http://backend.test",
    STOREFRONT_ORIGIN: "http://shop.test",
  }),
}))
vi.mock("@/lib/store-api/requests", () => ({
  storefrontSettings: () => Promise.resolve({ features: { popups: state.on } }),
}))
vi.mock("@/lib/store-api/server", () => ({
  storePublicGet: () =>
    state.fail ? Promise.reject(new Error("down")) : Promise.resolve({ popups: state.popups }),
  storePublicPost: (path: string, body: unknown) => {
    state.posted.push({ path, body })
    return state.fail ? Promise.reject(new Error("429")) : Promise.resolve()
  },
}))

const list = await import("../route")
const events = await import("../[id]/events/route")

const stored: StorePopup = {
  id: "popup_01JABC",
  type: "campaign",
  title: "Kış indirimi",
  body: "Tüm bıçaklarda.",
  image: {
    url: "https://cdn.test/kis.jpg",
    alt: null,
    width: 960,
    height: 540,
    derivatives: null,
  },
  button: null,
  submit_label: null,
  promotion: { code: "KIS25", automatic: false },
  targeting: { pages: ["home"], device: "all", visitor: "new", membership: "any" },
  trigger: { kind: "scroll", value: 40 },
  frequency: { kind: "days", days: 7 },
  layout: "corner",
  design: "coupon",
  priority: 5,
  ends_at: "2026-12-01T00:00:00.000Z",
}

const post = (id: string, body: string, headers: Record<string, string> = {}) =>
  events.POST(
    new Request(`http://shop.test/api/popups/${id}/events`, { method: "POST", body, headers }),
    { params: Promise.resolve({ id }) }
  )

beforeEach(() => {
  state.on = true
  state.popups = []
  state.fail = false
  state.posted = []
})

describe("GET /api/popups", () => {
  it("answers the backend's live pop-ups as the theme draws them, kept a minute on the way", async () => {
    state.popups = [stored]
    const answer = await list.GET()
    expect(answer.headers.get("cache-control")).toBe(
      "public, max-age=60, stale-while-revalidate=300"
    )
    expect(answer.headers.get("x-robots-tag")).toBe("noindex")
    const { popups } = (await answer.json()) as { popups: unknown[] }
    expect(popups).toEqual([
      {
        id: "popup_01JABC",
        type: "campaign",
        title: "Kış indirimi",
        body: "Tüm bıçaklarda.",
        image: {
          src: "https://cdn.test/kis.jpg",
          alt: "",
          width: 960,
          height: 540,
          sources: { avif: null, webp: null },
        },
        button: null,
        submitLabel: null,
        promotion: { code: "KIS25", automatic: false },
        targeting: stored.targeting,
        trigger: stored.trigger,
        frequency: stored.frequency,
        layout: "corner",
        design: "coupon",
        priority: 5,
        endsAt: "2026-12-01T00:00:00.000Z",
      },
    ])
  })

  it("draws a design it does not know, or none, as classic", async () => {
    state.popups = [
      { ...stored, design: "fullscreen" as never },
      { ...stored, id: "popup_02", design: undefined as never },
    ]
    const { popups } = (await (await list.GET()).json()) as { popups: { design: string }[] }
    expect(popups.map((each) => each.design)).toEqual(["classic", "classic"])
  })

  it("answers none with the shop's pop-ups off, without asking the backend", async () => {
    state.on = false
    state.popups = [stored]
    expect(await (await list.GET()).json()).toEqual({ popups: [] })
  })

  it("answers none on a failure, kept by nobody", async () => {
    state.fail = true
    const answer = await list.GET()
    expect(await answer.json()).toEqual({ popups: [] })
    expect(answer.headers.get("cache-control")).toBe("no-store")
  })
})

describe("POST /api/popups/:id/events", () => {
  it("passes a counter from the shop's own page on to the backend", async () => {
    const answer = await post("popup_01JABC", '{"type":"click"}', { origin: "http://shop.test" })
    expect(answer.status).toBe(204)
    expect(state.posted).toEqual([
      { path: "/store/popups/popup_01JABC/events", body: { type: "click" } },
    ])
  })

  it("takes a same-origin request without an Origin header", async () => {
    await post("popup_01JABC", '{"type":"impression"}', { "sec-fetch-site": "same-origin" })
    expect(state.posted).toHaveLength(1)
  })

  it("answers the same 204 and sends nothing for another site, an odd id or body", async () => {
    const refused = [
      post("popup_01JABC", '{"type":"click"}', { origin: "https://evil.test" }),
      post("popup_01JABC", '{"type":"click"}', { "sec-fetch-site": "cross-site" }),
      post("popup_01JABC", '{"type":"click"}'),
      post("prod_01JABC", '{"type":"click"}', { origin: "http://shop.test" }),
      post("popup_..%2F", '{"type":"click"}', { origin: "http://shop.test" }),
      post("popup_01JABC", '{"type":"purchase"}', { origin: "http://shop.test" }),
      post("popup_01JABC", "bozuk", { origin: "http://shop.test" }),
      post("popup_01JABC", `{"type":"click","x":"${"a".repeat(300)}"}`, {
        origin: "http://shop.test",
      }),
    ]
    for (const answer of await Promise.all(refused)) {
      expect(answer.status).toBe(204)
    }
    expect(state.posted).toEqual([])
  })

  it("answers 204 when the backend refuses (the flag off, the limit)", async () => {
    state.fail = true
    const answer = await post("popup_01JABC", '{"type":"close"}', { origin: "http://shop.test" })
    expect(answer.status).toBe(204)
  })
})
