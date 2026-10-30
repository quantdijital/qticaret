import { parseXmlSafely } from "../../security/xml"
import { htmlToText } from "../text"

// What a hostile feed, sitemap or description could send: unclosed, repeated
const within = (ms: number, work: () => unknown) => {
  const started = performance.now()
  work()
  expect(performance.now() - started).toBeLessThan(ms)
}

describe("hostile text read in linear time (F14 closing review)", () => {
  it("checks a megabyte of unclosed tags at once", () => {
    within(1_000, () => {
      expect(() => parseXmlSafely("<a".repeat(500_000), { maxBytes: 2_000_000 })).toThrow()
    })
  })

  it("cleans a description of unclosed comments and scripts at once, hiding what is left open", () => {
    within(1_000, () => htmlToText("<!--".repeat(50_000)))
    within(1_000, () => htmlToText("<script>".repeat(25_000)))
    expect(htmlToText("Önce <!-- gizli --> sonra <script>x()</script>son <style>a{}</style>")).toBe(
      "Önce sonra son"
    )
    expect(htmlToText("Görünür <!-- hiç kapanmayan")).toBe("Görünür")
    // A Turkish capital before a tag keeps every index in place
    expect(htmlToText("İSTANBUL <SCRIPT>gizli</SCRIPT>tava")).toBe("İSTANBUL tava")
  })
})
