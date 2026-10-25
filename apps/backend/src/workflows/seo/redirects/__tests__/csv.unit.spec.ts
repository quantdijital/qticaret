import { loopingLines, readRedirectCsv, writeRedirectCsv } from "../csv"
import { slugSimilarity } from "../suggest"

describe("redirect files", () => {
  it("reads only source and target, with defaults for the rest", () => {
    expect(readRedirectCsv("Source,Target\n/eski,/yeni\n")).toEqual({
      rows: [
        {
          line: 2,
          rule: {
            source: "/eski",
            target: "/yeni",
            status: 301,
            match: "exact",
            query_policy: "keep",
            query_keep: [],
          },
        },
      ],
      problems: [],
    })
  })

  it("reports a bad status, kind or policy by line and refuses a file without sources", () => {
    const read = readRedirectCsv(
      "source;status;match;query_policy\n/a;308;;\n/b;;regex;\n/c;;;tut\n"
    )
    expect(read).toMatchObject({
      rows: [],
      problems: [
        { line: 2, key: "seo.redirect_status_invalid" },
        { line: 3, key: "seo.redirect_match_invalid" },
        { line: 4, key: "seo.redirect_query_invalid" },
      ],
    })
    expect(readRedirectCsv("from,to\n/a,/b")).toEqual({ fileProblem: "seo.redirect_csv_header" })
  })

  it("writes what it reads back", () => {
    const rules = [
      {
        id: "redir_1",
        source: "/eski/:slug",
        match: "pattern" as const,
        target: "/urun/:slug",
        status: 301 as const,
        query_policy: "keep_list" as const,
        query_keep: ["utm_source", "utm_medium"],
      },
      {
        id: "redir_2",
        source: "/kapandi",
        match: "exact" as const,
        target: null,
        status: 410 as const,
        query_policy: "keep" as const,
        query_keep: null,
      },
    ]
    const read = readRedirectCsv(writeRedirectCsv(rules))
    expect("rows" in read ? read.rows.map(({ rule }) => rule) : read).toEqual([
      {
        source: "/eski/:slug",
        match: "pattern",
        target: "/urun/:slug",
        status: 301,
        query_policy: "keep_list",
        query_keep: ["utm_source", "utm_medium"],
      },
      {
        source: "/kapandi",
        match: "exact",
        target: "",
        status: 410,
        query_policy: "keep",
        query_keep: [],
      },
    ])
  })
})

describe("slugSimilarity", () => {
  it("is 1 for the same slug and falls with the difference", () => {
    expect(slugSimilarity("sef-bicagi", "sef-bicagi")).toBe(1)
    expect(slugSimilarity("sef-bicagi", "sef-bicagi-20-cm")).toBeGreaterThan(0.7)
    expect(slugSimilarity("sef-bicagi", "keten-gomlek")).toBeLessThan(0.2)
  })
})

describe("loopingLines", () => {
  const row = (line: number, source: string, target: string | null) => ({
    line,
    fields: { source, match: "exact" as const, target },
  })

  it("finds rows a file sends round in a circle, and only those", () => {
    expect(
      loopingLines([
        row(2, "/a", "/b"),
        row(3, "/b", "/a?ref=x"),
        row(4, "/c", "/a"),
        row(5, "/d", null),
      ])
    ).toEqual([2, 3])
  })
})
