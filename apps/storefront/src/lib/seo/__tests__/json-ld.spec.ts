import { describe, expect, it } from "vitest"
import { scriptSafeJson } from "../JsonLd"

describe("scriptSafeJson", () => {
  it("cannot close the script or break a line, and still parses to the same value", () => {
    const value = { name: "</script><script>alert(1)</script> & \u2028" }
    const safe = scriptSafeJson(value)

    expect(safe).not.toMatch(/<|>|&|\u2028/)
    expect(JSON.parse(safe)).toEqual(value)
  })

  it("escapes a video's title deep in a product's @graph (adr/0069 §9)", () => {
    const value = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Product", name: "Bıçak", subjectOf: { "@id": "https://m.example/u#video-1" } },
        {
          "@type": "VideoObject",
          "@id": "https://m.example/u#video-1",
          name: "Yakın çekim </script><img src=x onerror=alert(1)>",
        },
      ],
    }
    const safe = scriptSafeJson(value)

    expect(safe).not.toMatch(/<|>/)
    expect(JSON.parse(safe)).toEqual(value)
  })
})
