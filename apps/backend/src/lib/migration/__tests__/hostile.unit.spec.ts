import { parseXmlSafely } from "../../security/xml"
import { htmlToText } from "../text"

// What a hostile feed, sitemap or description could send: unclosed, repeated.
// Linear work on these inputs takes milliseconds, quadratic work minutes: the
// budget sits far from both, so a loaded CI runner does not fail it (it took
// 1.85 s against a 1 s budget on 2026-11-24, adr/0081) and a regression still does
const BUDGET_MS = 5_000
const within = (work: () => unknown) => {
  const started = performance.now()
  work()
  expect(performance.now() - started).toBeLessThan(BUDGET_MS)
}

describe("hostile text read in linear time (F14 closing review)", () => {
  it("checks a megabyte of unclosed tags at once", () => {
    within(() => {
      expect(() => parseXmlSafely("<a".repeat(500_000), { maxBytes: 2_000_000 })).toThrow()
    })
  })

  it("cleans a description of unclosed comments and scripts at once, hiding what is left open", () => {
    within(() => htmlToText("<!--".repeat(200_000)))
    within(() => htmlToText("<script>".repeat(100_000)))
    expect(htmlToText("Önce <!-- gizli --> sonra <script>x()</script>son <style>a{}</style>")).toBe(
      "Önce sonra son"
    )
    expect(htmlToText("Görünür <!-- hiç kapanmayan")).toBe("Görünür")
    // A Turkish capital before a tag keeps every index in place
    expect(htmlToText("İSTANBUL <SCRIPT>gizli</SCRIPT>tava")).toBe("İSTANBUL tava")
  })
})
