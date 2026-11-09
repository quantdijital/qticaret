import { asValue } from "@medusajs/framework/awilix"
import { createMedusaContainer } from "@medusajs/framework/utils"
import { AdminPostReviewReply } from "../../../api/admin/product-reviews/validators"
import { isValidationError } from "../../../lib/errors"
import { PRODUCT_REVIEWS_MODULE } from "../../../modules/product-reviews"
import { replyRefusal, replyToReviewWorkflow } from "../review-reply"

const reviews = { listProductReviews: jest.fn(), setReply: jest.fn() }

const run = (reply: string | null) => {
  const container = createMedusaContainer()
  container.register(PRODUCT_REVIEWS_MODULE, asValue(reviews))
  return replyToReviewWorkflow(container)
    .run({ input: { id: "prev_1", reply, user_id: "user_1" }, throwOnError: true })
    .then(
      ({ result }) => ({ result, error: null }),
      (error: unknown) => ({ result: null, error })
    )
}

const BEFORE = { reply: null, replied_by: null, replied_at: null }

beforeEach(() => {
  reviews.listProductReviews.mockResolvedValue([{ id: "prev_1", status: "approved", reply: null }])
  reviews.setReply.mockResolvedValue(BEFORE)
})
afterEach(() => {
  jest.resetAllMocks()
})

/** The shop's reply under a product review, as a question's shop answer. */
describe("replying to a product review", () => {
  it("writes a reply on an approved review only, and removes one that is there", () => {
    expect(replyRefusal({ status: "approved", reply: null }, "Teşekkürler")).toBeNull()
    expect(replyRefusal({ status: "approved", reply: "Eski" }, "Yeni")).toBeNull()
    expect(replyRefusal({ status: "pending", reply: null }, "Teşekkürler")).toBe(
      "reviews.reply_not_approved"
    )
    expect(replyRefusal({ status: "rejected", reply: null }, "Teşekkürler")).toBe(
      "reviews.reply_not_approved"
    )
    // A review gone back to waiting keeps its reply; the shop may still take it down
    expect(replyRefusal({ status: "pending", reply: "Eski" }, null)).toBeNull()
    expect(replyRefusal({ status: "approved", reply: null }, null)).toBe("reviews.reply_missing")
  })

  it("keeps the reply with who wrote it and when", async () => {
    const { result, error } = await run("Teşekkür ederiz, iyi günlerde kullanın.")

    expect(error).toBeNull()
    expect(reviews.setReply).toHaveBeenCalledWith("prev_1", {
      reply: "Teşekkür ederiz, iyi günlerde kullanın.",
      replied_by: "user_1",
      replied_at: expect.any(Date) as Date,
    })
    expect(result).toEqual({
      id: "prev_1",
      reply: "Teşekkür ederiz, iyi günlerde kullanın.",
      replied_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as string,
    })
  })

  it("removes the reply: text, author and time together", async () => {
    reviews.listProductReviews.mockResolvedValue([
      { id: "prev_1", status: "approved", reply: "Eski" },
    ])

    const { result } = await run(null)

    expect(reviews.setReply).toHaveBeenCalledWith("prev_1", BEFORE)
    expect(result).toEqual({ id: "prev_1", reply: null, replied_at: null })
  })

  it("refuses a reply to a waiting review, and an unknown one, writing nothing", async () => {
    reviews.listProductReviews.mockResolvedValueOnce([
      { id: "prev_1", status: "pending", reply: null },
    ])
    const waiting = await run("Teşekkürler")
    expect(isValidationError(waiting.error)).toBe(true)
    expect(waiting.error).toMatchObject({ safeMessage: "reviews.reply_not_approved" })

    reviews.listProductReviews.mockResolvedValueOnce([])
    const unknown = await run("Teşekkürler")
    expect((unknown.error as Error).message).toBe("reviews.unknown")
    expect(reviews.setReply).not.toHaveBeenCalled()
  })
})

describe("the reply's text", () => {
  const parse = (body: unknown) => AdminPostReviewReply.safeParse({ body })
  const messages = (body: unknown) => {
    const parsed = parse(body)
    return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)
  }

  it("takes plain text with its line breaks, trimmed, control characters dropped", () => {
    expect(parse("  Teşekkürler!\nYine bekleriz.\u0007  ").data).toEqual({
      body: "Teşekkürler!\nYine bekleriz.",
    })
  })

  it("refuses an empty, an over-long and a broken reply by our keys", () => {
    expect(messages("   ")).toEqual(["reviews.reply_required"])
    expect(messages("a".repeat(1000))).toEqual([])
    expect(messages("a".repeat(1001))).toEqual(["reviews.reply_too_long"])
    expect(messages("Yarım \ud800 karakter")).toEqual(["reviews.reply_invalid"])
    expect(AdminPostReviewReply.safeParse({ body: "Tamam", rating: 5 }).success).toBe(false)
  })
})
