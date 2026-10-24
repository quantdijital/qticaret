import { SafeFetchError } from "../errors"
import { nextHop } from "../redirect-policy"
import type { Hop } from "../redirect-policy"

const A = new URL("https://a.example/start")
const A_HTTP = new URL("http://a.example/start")
const B = new URL("https://b.example/landing")

const reasonOf = (run: () => unknown): string | null => {
  try {
    run()
  } catch (error) {
    return error instanceof SafeFetchError ? error.reason : "other"
  }
  return null
}

describe("nextHop", () => {
  const get: Hop = {
    method: "GET",
    headers: {
      Authorization: "Bearer s",
      "Proxy-Authorization": "Basic p",
      cookie: "sid=1",
      "X-Signature": "sig",
      "User-Agent": "qt",
      "Accept-Language": "tr",
    },
  }

  it("keeps every header within the origin", () => {
    expect(nextHop(302, get, A, new URL("https://a.example/next"), "same-origin")).toEqual(get)
  })

  it("keeps only harmless headers across origins, whatever their case", () => {
    expect(nextHop(302, get, A, B, "follow").headers).toEqual({
      "User-Agent": "qt",
      "Accept-Language": "tr",
    })
  })

  it("refuses an https to http downgrade, even within the host", () => {
    expect(reasonOf(() => nextHop(302, get, A, A_HTTP, "follow"))).toBe("redirect_not_allowed")
  })

  it("allows an http to https upgrade", () => {
    expect(reasonOf(() => nextHop(301, get, A_HTTP, A, "follow"))).toBeNull()
  })

  it("refuses a body that would follow a 307 to another origin", () => {
    const post: Hop = { method: "POST", headers: {}, body: "payload" }

    expect(reasonOf(() => nextHop(307, post, A, B, "follow"))).toBe("redirect_not_allowed")
    expect(nextHop(303, post, A, B, "follow")).toEqual({ method: "GET", headers: {} })
  })

  it("drops the body headers when the request becomes a GET", () => {
    const post: Hop = {
      method: "POST",
      headers: { "Content-Type": "text/plain", "Content-Encoding": "gzip", "X-Trace": "t" },
      body: "x",
    }

    expect(nextHop(302, post, A, new URL("https://a.example/n"), "same-origin")).toEqual({
      method: "GET",
      headers: { "X-Trace": "t" },
    })
  })

  it("keeps HEAD on a 303", () => {
    expect(nextHop(303, { method: "HEAD", headers: {} }, A, A, "same-origin").method).toBe("HEAD")
  })

  it.each([
    ["same-origin", B],
    ["error", new URL("https://a.example/next")],
  ] as const)("refuses in %s mode", (mode, to) => {
    expect(reasonOf(() => nextHop(302, get, A, to, mode))).toBe("redirect_not_allowed")
  })
})
