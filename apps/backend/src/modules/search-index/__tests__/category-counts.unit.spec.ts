import { categoryCountsOf, categoryCountsStatement } from "../sql/category-counts"

const placeholders = (sql: string) => sql.split("?").length - 1

describe("the category counts statement (adr/0049 Ek 2026-11-14 §10 karar 7b)", () => {
  const subtrees = [
    { id: "pcat_ust", ids: ["pcat_ust", "pcat_alt"] },
    { id: "pcat_alt", ids: ["pcat_alt"] },
  ]

  it("counts every category in one statement, the subtrees bound, never written in", () => {
    const { sql, params } = categoryCountsStatement(subtrees, ["sc_1"])

    expect(sql).not.toContain("pcat_")
    expect(sql).not.toContain("sc_1")
    expect(sql).toContain("d.published")
    expect(sql).toContain("GROUP BY s.id")
    expect(placeholders(sql)).toBe(params.length)
    expect(params).toEqual([JSON.stringify(subtrees), JSON.stringify(["sc_1"])])
  })

  it("counts in any channel when none is given", () => {
    const { sql, params } = categoryCountsStatement(subtrees, null)

    expect(sql).not.toContain("sales_channel_ids")
    expect(params).toEqual([JSON.stringify(subtrees)])
  })

  it("reads the rows by category id, a count the driver gave as text a number", () => {
    expect(
      categoryCountsOf([
        { id: "pcat_ust", count: "7" },
        { id: "pcat_alt", count: 0 },
      ])
    ).toEqual({ pcat_ust: 7, pcat_alt: 0 })
  })
})
