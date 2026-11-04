import { isValidationError } from "../../../lib/errors"
import { setReviewPhotos } from "../photos"
import type { PhotoStore } from "../photos"

interface Row {
  id: string
  review_id: string | null
  file_id: string
  customer_id: string
  product_id: string
  rank?: number
}

/** The service's photo table in memory, filtered as the service filters it. */
function storeOf(rows: Row[]): PhotoStore & { rows: Row[] } {
  return {
    rows,
    listReviewImages: (filters) => {
      const ids = filters["id"] as string[] | undefined
      return Promise.resolve(
        rows.filter(
          (row) =>
            (ids === undefined || ids.includes(row.id)) &&
            (filters["customer_id"] === undefined || row.customer_id === filters["customer_id"]) &&
            (filters["product_id"] === undefined || row.product_id === filters["product_id"]) &&
            (filters["review_id"] === undefined || row.review_id === filters["review_id"])
        )
      )
    },
    updateReviewImages: (data) => {
      for (const change of data) {
        Object.assign(rows.find((row) => row.id === change.id) ?? {}, change)
      }
      return Promise.resolve()
    },
    deleteReviewImages: (ids) => {
      for (const id of ids) {
        rows.splice(
          rows.findIndex((row) => row.id === id),
          1
        )
      }
      return Promise.resolve()
    },
  }
}

const mine = { customer_id: "cus_1", product_id: "prod_1" }
const input = { review_id: "prev_1", ...mine }

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return isValidationError(error) ? error.safeMessage : "other"
  }
  return "none"
}

// adr/0037 §4 Ek 2026-11-04
describe("setReviewPhotos", () => {
  it("puts the author's uploads on the review in order", async () => {
    const store = storeOf([
      { id: "rvph_a", review_id: null, file_id: "fa", ...mine },
      { id: "rvph_b", review_id: null, file_id: "fb", ...mine },
    ])
    const removed = await setReviewPhotos(store, { ...input, photo_ids: ["rvph_b", "rvph_a"] }, {})
    expect(removed).toEqual([])
    expect(store.rows.map((row) => [row.id, row.review_id, row.rank])).toEqual([
      ["rvph_a", "prev_1", 1],
      ["rvph_b", "prev_1", 0],
    ])
  })

  it("drops the photos the list leaves out and hands their files back", async () => {
    const store = storeOf([
      { id: "rvph_old", review_id: "prev_1", file_id: "fold", ...mine },
      { id: "rvph_new", review_id: null, file_id: "fnew", ...mine },
    ])
    const removed = await setReviewPhotos(store, { ...input, photo_ids: ["rvph_new"] }, {})
    expect(removed).toEqual([{ id: "rvph_old", file_id: "fold" }])
    expect(store.rows.map((row) => row.id)).toEqual(["rvph_new"])
  })

  it("refuses another customer's photo, another product's and one on another review", async () => {
    const store = storeOf([
      { id: "rvph_x", review_id: null, file_id: "fx", customer_id: "cus_2", product_id: "prod_1" },
      { id: "rvph_y", review_id: null, file_id: "fy", customer_id: "cus_1", product_id: "prod_2" },
      { id: "rvph_z", review_id: "prev_9", file_id: "fz", ...mine },
    ])
    for (const id of ["rvph_x", "rvph_y", "rvph_z", "rvph_missing"]) {
      expect(await refusal(setReviewPhotos(store, { ...input, photo_ids: [id] }, {}))).toBe(
        "reviews.photo_unknown"
      )
    }
  })

  it("takes three at most", async () => {
    const store = storeOf([])
    expect(
      await refusal(setReviewPhotos(store, { ...input, photo_ids: ["a", "b", "c", "d"] }, {}))
    ).toBe("reviews.photos_too_many")
  })
})
