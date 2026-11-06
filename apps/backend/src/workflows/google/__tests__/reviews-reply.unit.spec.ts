import { ProviderError, isValidationError } from "../../../lib/errors"
import { businessReplyApi } from "../../../lib/google/business-reply"
import { logger } from "../../../lib/logging"
import { businessProfileToken, googleReviewsOf } from "../reviews"
import { replyGoogleReviewWorkflow } from "../reviews-reply"

jest.mock("../reviews", () => ({
  businessProfileToken: jest.fn(),
  googleReviewsOf: jest.fn(),
}))
jest.mock("../../../lib/google/business-reply", () => ({
  businessReplyApi: jest.fn(),
}))

const TARGET = { account: "accounts/1", location: "locations/2", review_id: "AbFvOqk1" }
const BEFORE = {
  reply: "Teşekkür ederiz.",
  replied_at: new Date("2026-10-31T12:00:00Z"),
  reply_state: "approved" as const,
}

const api = { updateReply: jest.fn(), deleteReply: jest.fn() }
const reviews = { replyTarget: jest.fn(), setReply: jest.fn() }

const run = (comment: string | null) =>
  replyGoogleReviewWorkflow()
    .run({ input: { id: "grev_1", comment, user_id: "user_1" }, throwOnError: true })
    .then(
      ({ result }) => ({ result, error: null }),
      (error: unknown) => ({ result: null, error })
    )

beforeEach(() => {
  jest.mocked(businessProfileToken).mockResolvedValue("erisim")
  jest.mocked(googleReviewsOf).mockReturnValue(reviews as never)
  jest.mocked(businessReplyApi).mockReturnValue(api)
  reviews.replyTarget.mockResolvedValue({ id: "grev_1", ...TARGET, ...BEFORE })
  reviews.setReply.mockResolvedValue(BEFORE)
  api.updateReply.mockResolvedValue({
    comment: "Yeni yanıt",
    updated_at: new Date("2026-11-06T10:00:00Z"),
    state: "approved",
  })
  api.deleteReply.mockResolvedValue(undefined)
  jest.spyOn(logger, "warn").mockImplementation(() => undefined)
  jest.spyOn(logger, "error").mockImplementation(() => undefined)
})
afterEach(() => {
  jest.resetAllMocks()
  jest.restoreAllMocks()
})

/** adr/0058 Ek 2026-11-06: the shop's reply written at Google, then kept as Google answered. */
describe("replying to a Google review", () => {
  it("writes the reply at Google, then keeps it as Google answered it", async () => {
    const { result, error } = await run("Yeni yanıt")

    expect(error).toBeNull()
    expect(api.updateReply).toHaveBeenCalledWith("erisim", TARGET, "Yeni yanıt")
    expect(reviews.setReply).toHaveBeenCalledWith("grev_1", {
      reply: "Yeni yanıt",
      replied_at: new Date("2026-11-06T10:00:00Z"),
      reply_state: "approved",
    })
    expect(result).toEqual({
      id: "grev_1",
      reply: "Yeni yanıt",
      replied_at: "2026-11-06T10:00:00.000Z",
      reply_state: "approved",
    })
  })

  it("removes the reply at Google, then here", async () => {
    const { error } = await run(null)

    expect(error).toBeNull()
    expect(api.deleteReply).toHaveBeenCalledWith("erisim", TARGET)
    expect(reviews.setReply).toHaveBeenCalledWith("grev_1", {
      reply: null,
      replied_at: null,
      reply_state: null,
    })
  })

  it("puts Google's previous reply back when keeping the new one fails", async () => {
    reviews.setReply.mockRejectedValueOnce(new Error("db down"))

    const { error } = await run("Yeni yanıt")

    expect(error).not.toBeNull()
    expect(api.updateReply.mock.calls).toEqual([
      ["erisim", TARGET, "Yeni yanıt"],
      // The undo: what Google had before
      ["erisim", TARGET, "Teşekkür ederiz."],
    ])
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "google_reviews.reply_restored", had: true })
    )
  })

  it("removes the new reply at Google when there was none and keeping it fails", async () => {
    reviews.replyTarget.mockResolvedValueOnce({
      id: "grev_1",
      ...TARGET,
      reply: null,
      replied_at: null,
      reply_state: null,
    })
    reviews.setReply.mockRejectedValueOnce(new Error("db down"))

    await run("İlk yanıt")

    expect(api.updateReply).toHaveBeenCalledTimes(1)
    expect(api.deleteReply).toHaveBeenCalledWith("erisim", TARGET)
  })

  it("writes the removed reply back at Google when forgetting it here fails", async () => {
    reviews.setReply.mockRejectedValueOnce(new Error("db down"))

    await run(null)

    expect(api.deleteReply).toHaveBeenCalledTimes(1)
    expect(api.updateReply).toHaveBeenCalledWith("erisim", TARGET, "Teşekkür ederiz.")
  })

  it("keeps nothing and undoes nothing when Google refuses, in the shop's words", async () => {
    const refusals = [
      ["PERMISSION_DENIED", "google.reply_forbidden"],
      ["FAILED_PRECONDITION", "google.reply_unverified"],
      ["INVALID_ARGUMENT", "google.reply_refused"],
      ["NOT_FOUND", "google.review_not_found"],
      ["http_429", "google.reply_unavailable"],
    ] as const
    for (const [code, key] of refusals) {
      api.updateReply.mockRejectedValueOnce(
        new ProviderError({ provider: "google", providerCode: code, retryable: false })
      )
      const { error } = await run("Yeni yanıt")
      expect(isValidationError(error) ? error.safeMessage : error).toBe(key)
    }
    expect(reviews.setReply).not.toHaveBeenCalled()
    expect(api.updateReply).toHaveBeenCalledTimes(refusals.length)
    expect(api.deleteReply).not.toHaveBeenCalled()
    // The project not approved yet (0 a minute) is the platform's to look at
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "google_reviews.reply_failed", code: "http_429" })
    )
  })

  it("refuses a review no longer kept and removing a reply there is none of", async () => {
    reviews.replyTarget.mockResolvedValueOnce(null)
    const gone = await run("Yeni yanıt")
    reviews.replyTarget.mockResolvedValueOnce({
      id: "grev_1",
      ...TARGET,
      reply: null,
      replied_at: null,
      reply_state: null,
    })
    const none = await run(null)

    expect(isValidationError(gone.error) && gone.error.safeMessage).toBe("google.review_not_found")
    expect(isValidationError(none.error) && none.error.safeMessage).toBe("google.reply_missing")
    expect(api.updateReply).not.toHaveBeenCalled()
    expect(api.deleteReply).not.toHaveBeenCalled()
  })
})
