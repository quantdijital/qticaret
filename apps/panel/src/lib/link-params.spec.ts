import { afterEach, describe, expect, it } from "vitest"
import { linkParams } from "./link-params"

describe("linkParams", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/")
  })

  it("reads a link's fragment once and takes it out of the address bar", () => {
    window.history.replaceState({ key: "router" }, "", "/invite#token=abc123")

    expect(linkParams().get("token")).toBe("abc123")
    expect(window.location.hash).toBe("")
    expect(window.history.state).toEqual({ key: "router" })
    // Asked again on the same page (a second render): the same token
    expect(linkParams().get("token")).toBe("abc123")
  })

  it("gives nothing on another page", () => {
    window.history.replaceState(null, "", "/reset-password#token=x&email=a%40b.com")
    expect(linkParams().get("email")).toBe("a@b.com")
    window.history.replaceState(null, "", "/login")
    expect(linkParams().get("token")).toBeNull()
  })
})
