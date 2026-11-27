import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeGoogle } from "@qticaret/testing"
import type { FakeBusinessReview, FakeGoogle } from "@qticaret/testing"
import { GOOGLE_REVIEWS_MODULE } from "../../src/modules/google-reviews"
import { PRODUCT_REVIEWS_MODULE } from "../../src/modules/product-reviews"
import type ProductReviewsModuleService from "../../src/modules/product-reviews/service"
import type GoogleReviewsModuleService from "../../src/modules/google-reviews/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { purgeStaleGoogleReviewsWorkflow } from "../../src/workflows/google/reviews-sync"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

interface Status {
  configured: boolean
  connected: boolean
  granted: boolean
  location: { account: string; location: string; title: string; address: string | null } | null
  rating: number | null
  count: number | null
  synced_at: string | null
  error: string | null
}

interface StoreAnswer {
  google_reviews: {
    title: string
    rating: number | null
    count: number
    maps_url: string | null
    write_url: string | null
    reviews: {
      id: string
      author: string | null
      photo_url: string | null
      rating: number
      comment: string | null
      created_at: string
      reply: { comment: string; created_at: string | null } | null
      url: string | null
    }[]
  } | null
}

type StoreGoogleReview = NonNullable<StoreAnswer["google_reviews"]>["reviews"][number]

interface MixedAnswer {
  reviews: { id: string; created_at: string }[]
  google_reviews?: StoreGoogleReview[]
  count: number
}

// The fake place's CID (`?cid=12673514229871092736`) in hex, as Maps' review links carry it
const REVIEW_LINK =
  /^https:\/\/www\.google\.com\/maps\/reviews\/data=!4m6!14m5!1m4!2m3!1sCi9DQUlRQUNv[\w-]+!2m1!1s0x0:0xafe15e0b7f532400\?hl=tr$/

const ENV = ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_BASE_URL"] as const
const BASE = [
  "https://www.googleapis.com/auth/content",
  "https://www.googleapis.com/auth/webmasters",
]

/** adr/0058: the shop's Google reviews from its Business Profile, on the storefront. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const base = () => (api as { defaults: { baseURL?: string } }).defaults.baseURL ?? ""
    let google: FakeGoogle
    let admin: { headers: Record<string, string> }
    let storefront: Storefront
    let original: Map<string, FakeBusinessReview[]>
    let places: FakeGoogle["business"]["locations"]

    /** Through Google's consent screen and back, in the staff member's browser. */
    const connect = async (path: string, scopes?: string[]) => {
      const { data } = await http.post<{ url: string }>(path, {}, { headers: admin.headers })
      const back = new URL(await google.consent(data.url, "allow", scopes))
      const answer = await fetch(`${base()}${back.pathname}${back.search}`, {
        redirect: "manual",
        headers: admin.headers,
      })
      return answer.headers.get("location") ?? ""
    }
    const status = async () =>
      (
        await http.get<{ google_reviews: Status }>("/admin/google/reviews", {
          headers: admin.headers,
        })
      ).data.google_reviews
    const storeReviews = async (limit = 6) =>
      (
        await http.get<StoreAnswer>(`/store/google-reviews?limit=${String(limit)}`, {
          headers: storefront.headers,
        })
      ).data.google_reviews
    const sync = async () =>
      (
        await http.post<{
          sync: { added: number; updated: number; removed: number; error: string | null }
        }>("/admin/google/reviews/sync", {}, { headers: admin.headers })
      ).data.sync
    const reviewsOf = () => [...google.business.reviews.values()][0] ?? []

    beforeAll(async () => {
      google = await startFakeGoogle({ business: { title: "Bıçak Atölyesi", city: "Denizli" } })
      original = new Map([...google.business.reviews].map(([key, list]) => [key, [...list]]))
      places = new Map([...google.business.locations].map(([key, list]) => [key, [...list]]))
      Object.assign(process.env, {
        GOOGLE_OAUTH_CLIENT_ID: google.client.clientId,
        GOOGLE_OAUTH_CLIENT_SECRET: google.client.clientSecret,
        GOOGLE_BASE_URL: google.url,
      })
    })

    afterAll(async () => {
      for (const name of ENV) {
        Reflect.deleteProperty(process.env, name)
      }
      await google.close()
    })

    beforeEach(async () => {
      const container = getContainer()
      admin = await createAdminUser(http, container)
      storefront = await createStorefront(container)
      google.business.approved = true
      google.business.reviews = new Map([...original].map(([key, list]) => [key, [...list]]))
      google.business.locations = new Map(
        [...places].map(([key, list]) => [key, [...list]] as const)
      )
    })

    it("connects for the reviews, picks the only location and shows Google's own figures", async () => {
      const before = await storeReviews()
      const back = await connect("/admin/google/reviews/connect")
      const after = await status()
      const shown = await storeReviews(20)
      const raw = await http.get("/admin/google/reviews", { headers: admin.headers })

      expect(before).toBeNull()
      expect(back).toBe("/reviews/google?google=connected")
      expect(after).toMatchObject({
        configured: true,
        connected: true,
        granted: true,
        location: {
          title: "Bıçak Atölyesi",
          address: expect.stringContaining("Denizli") as unknown,
        },
        // Google's average and count, not worked out here
        rating: 4.6,
        count: 16,
        error: null,
      })
      expect(after.synced_at).not.toBeNull()
      expect(shown).toMatchObject({
        title: "Bıçak Atölyesi",
        rating: 4.6,
        count: 16,
        maps_url: expect.stringMatching(/^https:\/\/maps\.google\.com\//) as unknown,
        write_url: expect.stringMatching(
          /^https:\/\/search\.google\.com\/local\/writereview/
        ) as unknown,
      })
      expect(shown?.reviews).toHaveLength(16)
      // Newest first; the owner's reply under it; an anonymous reviewer has no name
      expect(shown?.reviews[0]).toMatchObject({
        author: "Mehmet Kaya",
        rating: 5,
        reply: { comment: expect.stringContaining("teşekkür ederiz") as unknown },
        photo_url: expect.stringContaining(`${google.url}/a/`) as unknown,
      })
      expect(shown?.reviews.some((each) => each.author === null && each.photo_url === null)).toBe(
        true
      )
      expect(shown?.reviews.some((each) => each.comment === null)).toBe(true)
      // Each one links to itself on Google Maps (adr/0058 Ek 2026-11-27)
      for (const each of shown?.reviews ?? []) {
        expect(each.url).toMatch(REVIEW_LINK)
      }
      expect(new Set(shown?.reviews.map((each) => each.url)).size).toBe(16)
      expect(JSON.stringify(raw.data)).not.toContain("1//")
    })

    it("asks a shop connected before the reviews to connect again, then lists its locations", async () => {
      await connect("/admin/google/connect", [...BASE, "openid", "email"])
      const without = await status()
      const refused = await settle(
        http.get<{ message?: string }>("/admin/google/reviews/locations", {
          headers: admin.headers,
        })
      )
      const back = await connect("/admin/google/reviews/connect")
      const listed = await http.get<{ locations: { location: string; title: string }[] }>(
        "/admin/google/reviews/locations",
        { headers: admin.headers }
      )

      expect(without).toMatchObject({ connected: true, granted: false, location: null })
      expect(refused.status).toBe(400)
      expect(refused.data.message).toBe("google.reviews_scope")
      expect(back).toBe("/reviews/google?google=connected")
      expect(listed.data.locations).toEqual([
        expect.objectContaining({
          location: expect.stringMatching(/^locations\//) as unknown,
          title: "Bıçak Atölyesi",
        }),
      ])
    })

    it("keeps up with Google: new, changed and removed reviews; the shop's hidden one stays hidden", async () => {
      await connect("/admin/google/reviews/connect")
      const listed = await http.get<{ reviews: { id: string; author: string | null }[] }>(
        "/admin/google/reviews/items",
        { headers: admin.headers }
      )
      const okan = listed.data.reviews.find((each) => each.author === "Okan Koç")
      await http.post(
        `/admin/google/reviews/items/${okan?.id ?? ""}`,
        { hidden: true, reason: "personal_data" },
        { headers: admin.headers }
      )
      // Google's newest review edited, the second one removed there, a new one written
      const [newest, , ...rest] = reviewsOf()
      if (!newest) {
        throw new Error("the fake Google has no review")
      }
      const reviews = [
        {
          ...newest,
          comment: "Kılıf da bıçak da harika; ikinci siparişimi verdim.",
          updateTime: new Date().toISOString(),
        },
        ...rest,
      ]
      google.business.reviews.set([...google.business.reviews.keys()][0] ?? "", reviews)
      reviews.unshift({
        reviewId: "AbFvOqYeniYorum1",
        reviewer: { displayName: "Can Doğan", isAnonymous: false },
        starRating: "FIVE",
        comment: "Hızlı kargo, özenli paket.",
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
      })
      const counts = await sync()
      const shown = await storeReviews(20)
      const all = await http.get<{
        reviews: { author: string | null; hidden: boolean }[]
        count: number
      }>("/admin/google/reviews/items", { headers: admin.headers })

      expect(counts).toMatchObject({ added: 1, updated: 1, removed: 1, error: null })
      expect(shown?.reviews[0]).toMatchObject({ author: "Can Doğan" })
      expect(shown?.reviews.find((each) => each.author === "Mehmet Kaya")?.comment).toContain(
        "ikinci siparişimi"
      )
      expect(shown?.reviews.some((each) => each.author === "Okan Koç")).toBe(false)
      expect(shown?.count).toBe(16)
      expect(all.data.count).toBe(16)
      expect(all.data.reviews.find((each) => each.author === "Okan Koç")?.hidden).toBe(true)
    })

    it("keeps what it has when Google refuses, says why, and forgets it past Google's 30 days", async () => {
      await connect("/admin/google/reviews/connect")
      google.business.approved = false
      const refused = await sync()
      const kept = await storeReviews()
      const after = await status()
      await purgeStaleGoogleReviewsWorkflow(getContainer()).run({
        input: { now: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString() },
      })
      const stored = await getContainer()
        .resolve<GoogleReviewsModuleService>(GOOGLE_REVIEWS_MODULE)
        .newest({ limit: 50 })

      expect(refused.error).toBe("http_429")
      expect(kept?.reviews.length).toBeGreaterThan(0)
      expect(after).toMatchObject({ error: "http_429", count: 16 })
      expect(stored.count).toBe(0)
    })

    it("forgets the reviews when the location changes, the reviews are removed or Google goes", async () => {
      await connect("/admin/google/reviews/connect")
      const account = [...google.business.locations.keys()][0] ?? ""
      google.business.locations.get(account)?.push({
        name: "locations/9988776655443322110",
        title: "Bıçak Atölyesi İzmir",
        storefrontAddress: {
          addressLines: ["Kordon Boyu No:4"],
          locality: "Konak",
          administrativeArea: "İzmir",
          postalCode: "35250",
          regionCode: "TR",
        },
        metadata: {
          placeId: "ChIJx",
          mapsUri: "https://maps.google.com/maps?cid=1",
          newReviewUri: "",
        },
      })
      google.business.reviews.set("locations/9988776655443322110", [])
      const wrong = await settle(
        http.post<{ message?: string }>(
          "/admin/google/reviews/location",
          { account, location: "locations/1234" },
          { headers: admin.headers }
        )
      )
      const moved = await http.post<{ google_reviews: Status }>(
        "/admin/google/reviews/location",
        { account, location: "locations/9988776655443322110" },
        { headers: admin.headers }
      )
      const afterMove = await storeReviews()
      const home = [...original.keys()][0] ?? ""
      await http.post(
        "/admin/google/reviews/location",
        { account, location: home },
        { headers: admin.headers }
      )
      const back = await storeReviews()
      await http.delete("/admin/google/reviews", { headers: admin.headers })
      const removed = await storeReviews()
      const stillConnected = await status()
      await http.post(
        "/admin/google/reviews/location",
        { account, location: home },
        { headers: admin.headers }
      )
      await http.delete("/admin/google", { headers: admin.headers })
      const gone = await storeReviews()

      expect(wrong.status).toBe(400)
      expect(wrong.data.message).toBe("google.location_invalid")
      expect(moved.data.google_reviews).toMatchObject({
        location: { title: "Bıçak Atölyesi İzmir" },
        count: 0,
      })
      expect(afterMove).toBeNull()
      expect(back?.reviews.length).toBeGreaterThan(0)
      expect(removed).toBeNull()
      expect(stillConnected).toMatchObject({ connected: true, location: null })
      expect(gone).toBeNull()
    })

    it("mixes Google's reviews among the shop's by date on the reviews page, the star filter the shop's alone", async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      const shop = await stockShop(container)
      const handle = `bicak-mix-${String(Date.now())}`
      const { productId } = await stockedProduct(container, shop, handle, 5, 250)
      storefront = await createStorefront(container)
      await connect("/admin/google/reviews/connect")
      const day = 24 * 60 * 60 * 1000
      // Newer than every Google review, then between them (theirs go back over a year)
      const [newest, middle] = await container
        .resolve<ProductReviewsModuleService>(PRODUCT_REVIEWS_MODULE)
        .addMigratedReviews(
          [new Date(), new Date(Date.now() - 100 * day)].map((created_at, index) => ({
            source_ref: `google-mix:${handle}:${String(index)}`,
            product_id: productId,
            customer_id: null,
            rating: 5,
            title: null,
            body: "Elime ulaştı, anlatıldığı gibi.",
            author_name: "A. Y.",
            has_link: false,
            published: true,
            created_at,
          }))
        )
      const page = async (query: string) =>
        (await http.get<MixedAnswer>(`/store/reviews?${query}`, { headers: storefront.headers }))
          .data

      const all = await page("google=1&limit=50")
      const first = await page("google=1&limit=1")
      const second = await page("google=1&offset=1&limit=3")
      const filtered = await page("google=1&rating=5&limit=50")
      const plain = await page("limit=50")

      // Both sources, one count; Google's figures stay apart (`/store/google-reviews`)
      expect(all.count).toBe(18)
      expect(all.reviews.map((each) => each.id)).toEqual([newest, middle])
      expect(all.google_reviews).toHaveLength(16)
      expect(all.google_reviews?.[0]?.url).toMatch(REVIEW_LINK)
      const dates = all.google_reviews?.map((each) => each.created_at) ?? []
      expect([...dates].sort().reverse()).toEqual(dates)
      // The newest is the shop's; the next three Google's, the shop's older one further down
      expect(first.reviews.map((each) => each.id)).toEqual([newest])
      expect(first.google_reviews).toEqual([])
      expect(second.reviews).toEqual([])
      expect(second.google_reviews?.map((each) => each.id)).toEqual(
        all.google_reviews?.slice(0, 3).map((each) => each.id)
      )
      // The stars and the plain list are the shop's alone
      expect(filtered.google_reviews).toBeUndefined()
      expect(filtered.count).toBe(2)
      expect(plain.google_reviews).toBeUndefined()
      expect(plain.count).toBe(2)
    })

    it("never puts Google reviews in the structured data: Product and OnlineStore carry ours only", async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      const shop = await stockShop(container)
      const handle = `bicak-${String(Date.now())}`
      await stockedProduct(container, shop, handle, 5, 250)
      storefront = await createStorefront(container)
      await container
        .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
        .saveSection("seo", { canonical_host: "magaza.example.com" }, null)
      await connect("/admin/google/reviews/connect")
      const page = await http.get<{ seo?: { jsonLd: Record<string, unknown>[] } }>(
        `/store/seo/resolve?path=${encodeURIComponent(`/urun/${handle}`)}`,
        { headers: storefront.headers }
      )
      const site = await http.get<{ jsonLd: Record<string, unknown>[] }>("/store/seo/site", {
        headers: storefront.headers,
      })
      const blocks = JSON.stringify([...(page.data.seo?.jsonLd ?? []), ...site.data.jsonLd])

      expect((await storeReviews())?.count).toBe(16)
      expect(page.data.seo?.jsonLd.some((block) => block["@type"] === "Product")).toBe(true)
      expect(blocks).not.toContain("aggregateRating")
      expect(blocks).not.toContain('"review"')
      expect(blocks).not.toContain("Mehmet Kaya")
    })
  },
})
