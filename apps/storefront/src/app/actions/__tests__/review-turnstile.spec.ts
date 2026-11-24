import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "@/lib/store-api/errors"

const store = vi.hoisted(() => ({ storeCall: vi.fn() }))
vi.mock("@/lib/store-api/server", () => store)

const { writeReview } = await import("../product")

const INITIAL = { ok: false, error: null }
const PRODUCT = "prod_01JABCDEFGHJKMNPQ"
const REVIEWS = `/store/products/${PRODUCT}/reviews`

function reviewForm(extra: [string, string | File][] = []) {
  const form = new FormData()
  form.set("product_id", PRODUCT)
  form.set("rating", "5")
  form.set("body", "Çok güzel bir bıçak, keskin geldi.")
  for (const [name, value] of extra) {
    form.append(name, value)
  }
  return form
}

const photo = (name: string) =>
  new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type: "image/jpeg" })

/**
 * A review past the limit (adr/0044 Ek 2026-11-24): the backend asks
 * Turnstile after its photos went up; the send again names those photos
 * instead of uploading them once more.
 */
describe("writeReview behind Turnstile", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("hands the uploaded photos' ids back with the ask, the files to stay home", async () => {
    store.storeCall.mockImplementation((path: string) =>
      path.endsWith("/photos")
        ? Promise.resolve({ photo: { id: `revph_${String(store.storeCall.mock.calls.length)}` } })
        : Promise.reject(
            new StoreApiError(428, "fraud.turnstile_required", null, {
              turnstile: { action: "review" },
            })
          )
    )

    const result = await writeReview(
      INITIAL,
      reviewForm([
        ["photos", photo("a.jpg")],
        ["photos", photo("b.jpg")],
      ])
    )

    expect(result).toEqual({
      ok: false,
      error: null,
      challenge: null,
      turnstile: { action: "review", failed: false },
      resume: { photo_ids: ["revph_1", "revph_2"], photos: [] },
    })
  })

  it("sent again with the ids, uploads nothing and names them", async () => {
    store.storeCall.mockResolvedValue({})

    await expect(
      writeReview(
        INITIAL,
        reviewForm([
          ["photo_ids", "revph_1"],
          ["photo_ids", "revph_2"],
          ["turnstile", "tok"],
        ])
      )
    ).resolves.toEqual({ ok: true, error: null })

    expect(store.storeCall).toHaveBeenCalledTimes(1)
    expect(store.storeCall).toHaveBeenCalledWith(REVIEWS, {
      method: "POST",
      body: {
        rating: 5,
        body: "Çok güzel bir bıçak, keskin geldi.",
        photo_ids: ["revph_1", "revph_2"],
      },
      headers: { "x-turnstile-token": "tok" },
    })
  })

  it("refuses ids that are not of their shape, or too many", async () => {
    await expect(writeReview(INITIAL, reviewForm([["photo_ids", "../x"]]))).resolves.toEqual({
      ok: false,
      error: "product.review_photos_invalid",
    })
    await expect(
      writeReview(
        INITIAL,
        reviewForm(
          ["a", "b", "c", "d"].map((id) => ["photo_ids", `revph_${id}`] as [string, string])
        )
      )
    ).resolves.toMatchObject({ error: "product.review_photos_invalid" })
    expect(store.storeCall).not.toHaveBeenCalled()
  })
})
