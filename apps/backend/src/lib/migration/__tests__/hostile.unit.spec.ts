import { measureGrowth } from "@qticaret/testing"
import { parseXmlSafely } from "../../security/xml"
import { htmlToText } from "../text"

// What a hostile feed, sitemap or description could send: unclosed, repeated.
// Judged by how the time grows with the input (eight times the input takes
// about eight times as long when linear, sixty-four when quadratic), not by a
// wall-clock budget: a loaded CI runner took 1.85 s against 1 s (2026-11-24,
// adr/0081). The largest input is the one the old budget timed.
const linear = (work: (size: number) => () => unknown, size: number) => {
  expect(measureGrowth(work, size, { rounds: 3 })).toMatchObject({ linear: true })
}

describe("hostile text read in linear time (F14 closing review)", () => {
  it("checks a megabyte of unclosed tags at once", () => {
    linear((size) => {
      const text = "<a".repeat(size)
      return () => {
        expect(() => parseXmlSafely(text, { maxBytes: 2_000_000 })).toThrow()
      }
    }, 62_500)
  })

  it("cleans a description of unclosed comments and scripts at once, hiding what is left open", () => {
    linear((size) => {
      const text = "<!--".repeat(size)
      return () => htmlToText(text)
    }, 25_000)
    linear((size) => {
      const text = "<script>".repeat(size)
      return () => htmlToText(text)
    }, 12_500)
    expect(htmlToText("Önce <!-- gizli --> sonra <script>x()</script>son <style>a{}</style>")).toBe(
      "Önce sonra son"
    )
    expect(htmlToText("Görünür <!-- hiç kapanmayan")).toBe("Görünür")
    // A Turkish capital before a tag keeps every index in place
    expect(htmlToText("İSTANBUL <SCRIPT>gizli</SCRIPT>tava")).toBe("İSTANBUL tava")
  })
})
