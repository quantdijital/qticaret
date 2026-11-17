import { SafeFetchError } from "../../../../lib/security/safe-fetch"
import type * as SafeFetch from "../../../../lib/security/safe-fetch"
import type { SafeFetchOptions } from "../../../../lib/security/safe-fetch"
import { fetchYoutubePoster, youtubeFetch } from "../youtube-fetch"

const safeFetch = jest.fn()
// The real policy, its fetch watched: what is asked and with which options (hoisted by jest)
jest.mock("../../../../lib/security/safe-fetch", () => ({
  ...jest.requireActual<typeof SafeFetch>("../../../../lib/security/safe-fetch"),
  safeFetch: (...args: unknown[]): unknown => safeFetch(...args),
}))

const ID = "dQw4w9WgXcQ"
const JPEG = Buffer.from("jpeg")

const answer = (status: number, url: string, body = JPEG) => ({ status, url, body, headers: {} })

beforeEach(() => {
  safeFetch.mockReset()
})

/** A cover is taken from i.ytimg.com alone, never through a redirect (security review S1). */
describe("a YouTube cover's fetch", () => {
  it("follows no redirect and takes the answer from i.ytimg.com", async () => {
    safeFetch.mockImplementation((address: string) => Promise.resolve(answer(200, address)))
    await expect(fetchYoutubePoster(ID)).resolves.toEqual(JPEG)
    const [address, options] = safeFetch.mock.calls[0] as [string, SafeFetchOptions]
    expect(address).toBe(`https://i.ytimg.com/vi/${ID}/maxresdefault.jpg`)
    expect(options.redirect).toBe("error")
    expect(options.maxRedirects).toBeUndefined()
  })

  it("falls back to hqdefault when maxresdefault is a 404", async () => {
    safeFetch.mockImplementation((address: string) =>
      Promise.resolve(answer(address.includes("maxres") ? 404 : 200, address))
    )
    await expect(fetchYoutubePoster(ID)).resolves.toEqual(JPEG)
    expect(safeFetch).toHaveBeenCalledTimes(2)
  })

  it("takes nothing that answered from another host, or from a redirect", async () => {
    safeFetch.mockResolvedValue(answer(200, "https://cdn.evil.example/kapak.jpg"))
    await expect(fetchYoutubePoster(ID)).resolves.toBeNull()

    safeFetch.mockRejectedValue(new SafeFetchError("redirect_not_allowed"))
    await expect(fetchYoutubePoster(ID)).resolves.toBeNull()
  })

  it("never asks a host but i.ytimg.com over HTTPS", async () => {
    for (const address of [
      "https://cdn.evil.example/vi/x/hqdefault.jpg",
      "http://i.ytimg.com/vi/x/hqdefault.jpg",
      "https://i.ytimg.com.evil.example/vi/x/hqdefault.jpg",
    ]) {
      await expect(youtubeFetch.poster(address)).resolves.toBeNull()
    }
    expect(safeFetch).not.toHaveBeenCalled()
  })
})
