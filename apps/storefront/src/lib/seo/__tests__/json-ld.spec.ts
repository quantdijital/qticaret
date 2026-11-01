import { describe, expect, it } from "vitest"
import { scriptSafeJson } from "../JsonLd"

describe("scriptSafeJson", () => {
  it("cannot close the script or break a line, and still parses to the same value", () => {
    const value = { name: "</script><script>alert(1)</script> & \u2028" }
    const safe = scriptSafeJson(value)

    expect(safe).not.toMatch(/<|>|&|\u2028/)
    expect(JSON.parse(safe)).toEqual(value)
  })
})
