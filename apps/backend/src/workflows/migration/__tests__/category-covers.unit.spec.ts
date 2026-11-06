import { MIGRATION_KINDS } from "../../../lib/migration/types"
import { coverAltText, hostOf, httpsAddress } from "../category-cover-files"
import { emptyCounts, reportSheets } from "../report"
import type { RunCounts } from "../report"

describe("the categories' pictures in a migration (adr/0042 Ek 2026-11-06)", () => {
  it("fetches over HTTPS only, a fake old site's own origin aside", () => {
    const fake = "http://127.0.0.1:4100"
    expect(httpsAddress("http://eski.example.com/wp-content/uploads/a.jpg", undefined)).toBe(
      "https://eski.example.com/wp-content/uploads/a.jpg"
    )
    expect(httpsAddress("https://cdn.example.com/a.jpg?ver=2", fake)).toBe(
      "https://cdn.example.com/a.jpg?ver=2"
    )
    expect(httpsAddress(`${fake}/wp-content/uploads/a.png`, fake)).toBe(
      `${fake}/wp-content/uploads/a.png`
    )
    // Another port on the same machine is no fake origin
    expect(httpsAddress("http://127.0.0.1:9/a.png", fake)).toBe("https://127.0.0.1:9/a.png")
    expect(httpsAddress("ftp://eski.example.com/a.jpg", undefined)).toBe(
      "ftp://eski.example.com/a.jpg"
    )
  })

  it("keeps the alt text on one line within the media library's cap", () => {
    expect(coverAltText("  Şef\n bıçakları ")).toBe("Şef bıçakları")
    expect(coverAltText("   ")).toBeNull()
    expect(coverAltText("a".repeat(400))).toHaveLength(250)
  })

  it("reads the old site's host from the source's id", () => {
    expect(hostOf("wordpress:mylarte.com")).toBe("mylarte.com")
    expect(hostOf("wordpress:127.0.0.1:4100")).toBe("127.0.0.1:4100")
  })

  it("names the pictures in the report's summary, only for a source that gives them", () => {
    const counts = Object.fromEntries(
      [...MIGRATION_KINDS, "consent", "attribute"].map((kind) => [kind, emptyCounts()])
    ) as RunCounts
    const rowsOf = (mode: "check" | "apply") =>
      reportSheets(mode, counts, [], [])[0]?.rows as (string | number | null)[][]
    expect(rowsOf("apply").some((row) => String(row[0]).startsWith("Kategori görseli"))).toBe(false)
    counts.category = {
      ...emptyCounts(),
      covers: 2,
      covers_kept: 1,
      covers_reused: 1,
      covers_uploaded: 1,
      covers_failed: 1,
    }
    const rows = rowsOf("apply")
    const first = rows.findIndex((row) => row[0] === "Kategori görseli eklendi")
    expect(rows.slice(first, first + 5)).toEqual([
      ["Kategori görseli eklendi", 2],
      ["Kendi görseli olduğu için dokunulmayan kategoriler", 1],
      ["Taşınmış bir dosyası yeniden kullanılan görseller", 1],
      ["Eski siteden indirilen görseller", 1],
      ["Alınamayan kategori görselleri (Notlar'da)", 1],
    ])
    expect(rowsOf("check").some((row) => row[0] === "Kategori görseli eklenecek")).toBe(true)
  })
})
