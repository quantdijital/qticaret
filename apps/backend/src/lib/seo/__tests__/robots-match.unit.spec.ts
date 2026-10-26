import { hasOwnGroup, isCrawlable, parseRobots } from "../robots-match"

describe("robots.txt as a crawler reads it (RFC 9309)", () => {
  it("lets everything in without rules, and with an empty Disallow", () => {
    expect(isCrawlable(parseRobots(""), "*", "/urun/kupa")).toBe(true)
    expect(isCrawlable(parseRobots("User-agent: *\nDisallow:\n"), "*", "/")).toBe(true)
  })

  it("lets the longest matching rule win, Allow on a tie", () => {
    const groups = parseRobots("User-agent: *\nDisallow: /\nAllow: /urun/\n")
    expect(isCrawlable(groups, "*", "/urun/kupa")).toBe(true)
    expect(isCrawlable(groups, "*", "/")).toBe(false)
    expect(isCrawlable(groups, "*", "/kategori/mutfak")).toBe(false)
    const tie = parseRobots("User-agent: *\nDisallow: /urun\nAllow: /urun\n")
    expect(isCrawlable(tie, "*", "/urun/kupa")).toBe(true)
  })

  it("reads * as any run of characters and a final $ as the end", () => {
    const groups = parseRobots("User-agent: *\nDisallow: /u*a\nDisallow: /sepet$\n")
    expect(isCrawlable(groups, "*", "/urun/kupa")).toBe(false)
    expect(isCrawlable(groups, "*", "/sepet")).toBe(false)
    expect(isCrawlable(groups, "*", "/sepet/ozet")).toBe(true)
    // A dot is a dot, not any character
    expect(isCrawlable(parseRobots("User-agent: *\nDisallow: /a.b\n"), "*", "/axb")).toBe(true)
  })

  it("makes a crawler with groups of its own ignore the * ones", () => {
    const groups = parseRobots(
      "User-agent: *\nDisallow: /sepet\n\nUser-agent: Googlebot/2.1\nUser-agent: Bingbot\nDisallow: /\n"
    )
    expect(hasOwnGroup(groups, "googlebot")).toBe(true)
    expect(hasOwnGroup(groups, "duckduckbot")).toBe(false)
    expect(isCrawlable(groups, "googlebot", "/urun/kupa")).toBe(false)
    expect(isCrawlable(groups, "bingbot", "/")).toBe(false)
    expect(isCrawlable(groups, "duckduckbot", "/urun/kupa")).toBe(true)
    expect(isCrawlable(groups, "*", "/sepet")).toBe(false)
  })

  it("merges the groups of one crawler and ignores comments", () => {
    const groups = parseRobots(
      "User-agent: *\nDisallow: /a # eski\n\nUser-agent: *\nDisallow: /b\n"
    )
    expect(isCrawlable(groups, "*", "/a")).toBe(false)
    expect(isCrawlable(groups, "*", "/b")).toBe(false)
  })
})
