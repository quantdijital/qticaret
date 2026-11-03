import { MIGRATION_KINDS } from "../../../lib/migration/types"
import { emptyCounts, reportSheets } from "../report"
import type { RunCounts } from "../report"

const counts = (): RunCounts => {
  const all = Object.fromEntries(
    [...MIGRATION_KINDS, "consent", "attribute"].map((kind) => [kind, emptyCounts()])
  ) as RunCounts
  all.category = { ...emptyCounts(), read: 3, created: 3, seo_own: 1, seo_default: 2 }
  all.post_category = { ...emptyCounts(), read: 1, created: 1, seo_own: 0, seo_default: 1 }
  all.attribute = { ...emptyCounts(), read: 5, created: 2, skipped: 3 }
  return all
}

describe("a migration's report summary (adr/0042 §9, Ek 2026-11-03)", () => {
  it("says where new categories' SEO fields come from, and what came of the attributes", () => {
    const [summary] = reportSheets("check", counts(), [], [])
    const rows = summary?.rows as (string | number | null)[][]
    expect(rows.find((row) => row[0] === "Ürün özellikleri")).toEqual([
      "Ürün özellikleri",
      5,
      2,
      0,
      0,
      3,
      0,
    ])
    const seo = rows.findIndex((row) => row[0] === "Eklenecek kategorilerin SEO alanları")
    expect(rows[seo]).toEqual([
      "Eklenecek kategorilerin SEO alanları",
      "Kaynaktaki başlık ya da açıklamayla",
      "Mağazanın şablonlarıyla (varsayılan)",
    ])
    expect(rows.slice(seo + 1)).toEqual([
      ["Kategoriler", 1, 2],
      ["Blog kategorileri", 0, 1],
    ])
    const applied = reportSheets("apply", counts(), [], [])[0]?.rows as unknown[][]
    expect(applied.some((row) => row[0] === "Eklenen kategorilerin SEO alanları")).toBe(true)
  })
})
