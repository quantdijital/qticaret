import { coreWebVitalsFinding, searchConsoleFinding } from "../insights"

describe("Search Console and Core Web Vitals findings (F10.11)", () => {
  it("lists pages not indexed, pages whose clicks fell by 30%, and pages seen but not clicked", () => {
    const result = searchConsoleFinding({
      pages: [
        { path: "/urun/a", clicks: 10, impressions: 300, ctr: 0.03, prevClicks: 40 },
        { path: "/urun/b", clicks: 30, impressions: 300, ctr: 0.1, prevClicks: 40 },
        // Too few clicks before to call it a drop
        { path: "/urun/c", clicks: 0, impressions: 50, ctr: 0, prevClicks: 10 },
        { path: "/kategori/d", clicks: 3, impressions: 900, ctr: 0.0033, prevClicks: 2 },
      ],
      inspections: [
        {
          path: "/urun/e",
          verdict: "NEUTRAL",
          coverageState: "Discovered - currently not indexed",
        },
        { path: "/urun/a", verdict: "PASS", coverageState: "Submitted and indexed" },
      ],
    })

    expect(result).toMatchObject({ ruleId: "S-GSC-01", severity: "high", count: 3 })
    expect(result?.items).toEqual([
      { reason: "not_indexed", subject: "/urun/e", target: "Discovered - currently not indexed" },
      { reason: "clicks_dropped", subject: "/urun/a", count: 30 },
      { reason: "low_ctr", subject: "/kategori/d", count: 900 },
    ])
  })

  it("finds nothing when Google indexes the pages and they hold their clicks", () => {
    expect(
      searchConsoleFinding({
        pages: [{ path: "/urun/a", clicks: 40, impressions: 300, ctr: 0.13, prevClicks: 40 }],
        inspections: [{ path: "/urun/a", verdict: "PASS", coverageState: null }],
      })
    ).toBeNull()
  })

  it("names each form factor's metric past Google's good line", () => {
    const result = coreWebVitalsFinding([
      { formFactor: "PHONE", lcp: 3200, inp: 180, cls: 0.12 },
      { formFactor: "DESKTOP", lcp: 1800, inp: 120, cls: 0.02 },
    ])

    expect(result?.items).toEqual([
      { reason: "lcp", subject: "PHONE", target: "3200" },
      { reason: "cls", subject: "PHONE", target: "0.12" },
    ])
    expect(
      coreWebVitalsFinding([{ formFactor: "PHONE", lcp: null, inp: null, cls: null }])
    ).toBeNull()
  })
})
