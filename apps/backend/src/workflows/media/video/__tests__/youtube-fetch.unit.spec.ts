import { isRetryableError, isValidationError } from "../../../../lib/errors"
import { SafeFetchError } from "../../../../lib/security/safe-fetch"
import { checkYoutubeVideo, fetchYoutubePoster, youtubeFetch } from "../youtube-fetch"

const ID = "dQw4w9WgXcQ"
const real = { ...youtubeFetch }

afterEach(() => {
  Object.assign(youtubeFetch, real)
})

const answer = (status: number, body: unknown = "") => ({
  status,
  body: Buffer.from(typeof body === "string" ? body : JSON.stringify(body)),
})

const outcome = async () => {
  try {
    return await checkYoutubeVideo(ID)
  } catch (error) {
    if (isValidationError(error)) {
      return `invalid:${error.safeMessage}`
    }
    return isRetryableError(error) ? `retry:${error.safeMessage}` : "other"
  }
}

/** What YouTube's oEmbed answer means for a link (adr/0069 §8); no real network here. */
describe("checking a YouTube video", () => {
  it("takes an embeddable video, with its title when it has one", async () => {
    youtubeFetch.oembed = () => Promise.resolve(answer(200, { title: " Bileme ", type: "video" }))
    await expect(outcome()).resolves.toEqual({ title: "Bileme" })
    youtubeFetch.oembed = () => Promise.resolve(answer(200, { type: "video" }))
    await expect(outcome()).resolves.toEqual({ title: null })
  })

  it.each([400, 401, 403, 404])("reads %i as not embeddable or not public", async (status) => {
    youtubeFetch.oembed = () => Promise.resolve(answer(status, "Unauthorized"))
    await expect(outcome()).resolves.toBe("invalid:video.youtube_unavailable")
  })

  it("asks to try again when YouTube is out of reach or answers oddly", async () => {
    youtubeFetch.oembed = () => Promise.reject(new SafeFetchError("timeout"))
    await expect(outcome()).resolves.toBe("retry:video.youtube_unreachable")
    youtubeFetch.oembed = () => Promise.resolve(answer(500))
    await expect(outcome()).resolves.toBe("retry:video.youtube_unreachable")
    youtubeFetch.oembed = () => Promise.resolve(answer(200, "<html>not json</html>"))
    await expect(outcome()).resolves.toBe("retry:video.youtube_unreachable")
    youtubeFetch.oembed = () => Promise.resolve(answer(200, { title: 42 }))
    await expect(outcome()).resolves.toBe("retry:video.youtube_unreachable")
  })

  it("takes the largest cover there is, and none is no failure", async () => {
    const asked: string[] = []
    youtubeFetch.poster = (address) => {
      asked.push(address)
      return Promise.resolve(address.includes("maxres") ? null : Buffer.from("jpeg"))
    }
    await expect(fetchYoutubePoster(ID)).resolves.toEqual(Buffer.from("jpeg"))
    expect(asked).toEqual([
      `https://i.ytimg.com/vi/${ID}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`,
    ])
    youtubeFetch.poster = () => Promise.reject(new SafeFetchError("dns_failed"))
    await expect(fetchYoutubePoster(ID)).resolves.toBeNull()
  })

  it("goes through the SSRF rules: the real fetch refuses a private address", async () => {
    await expect(real.poster("https://127.0.0.1/vi/x/hqdefault.jpg")).rejects.toMatchObject({
      reason: "address_not_allowed",
    })
  })
})
