import { measureGrowth } from "@qticaret/testing"
import {
  compilePattern,
  locationOf,
  matchPattern,
  normalizePath,
  orderPatterns,
  parseRequestPath,
  parseSource,
  parseTarget,
  pickRule,
  prefixesOf,
} from "../redirects"
import type { RedirectRule } from "../redirects"

const rule = (overrides: Partial<RedirectRule>): RedirectRule => ({
  id: "redir_1",
  source: "/eski",
  match: "exact",
  target: "/yeni",
  status: 301,
  query_policy: "keep",
  query_keep: null,
  ...overrides,
})

const request = (raw: string) => {
  const parsed = parseRequestPath(raw)
  if (!parsed) {
    throw new Error(`unparseable ${raw}`)
  }
  return parsed
}

describe("normalizePath", () => {
  it.each([
    ["/Urun/Sef-Bicagi/", "/urun/sef-bicagi"],
    ["//kategori///bicak", "/kategori/bicak"],
    ["/kategori/b%C4%B1%C3%A7ak", "/kategori/bıçak"],
    ["/", "/"],
    ["/eski%20sayfa.html", "/eski sayfa.html"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizePath(raw)).toBe(expected)
  })

  it.each([
    "urun/x",
    "/a/../admin",
    "/a/./b",
    "/a%2Fb",
    "/a%5Cb",
    "/a%0Ab",
    "/a%E0%A4%A",
    // A lone surrogate, a C1 control, a bidi override, an encoded `?`
    "/zz\ud800",
    "/a%C2%85b",
    "/a\u202eb",
    "/a%3Fb",
    `/${"a".repeat(600)}`,
  ])("refuses %s", (raw) => {
    expect(normalizePath(raw)).toBeNull()
  })
})

describe("parseRequestPath", () => {
  it("splits the query and drops the fragment", () => {
    const parsed = request("/Eski-Urun/?utm_source=x&a=1#bolum")
    expect(parsed.path).toBe("/eski-urun")
    expect(parsed.query.toString()).toBe("utm_source=x&a=1")
  })
})

describe("prefixesOf", () => {
  it("lists the ancestors nearest first", () => {
    expect(prefixesOf("/a/b/c")).toEqual(["/a/b/c", "/a/b", "/a"])
  })
})

describe("patterns", () => {
  it("compiles placeholders and a final rest", () => {
    expect(compilePattern("/eski/:slug/*")).toEqual([
      { kind: "literal", value: "eski" },
      { kind: "param", name: "slug" },
      { kind: "rest" },
    ])
  })

  it.each(["/:a/:b", "/eski/*/x", "/eski/:a/:a", "/eski/:1x", "/eski/ab*", "/eski/a:b"])(
    "refuses %s",
    (source) => {
      expect(compilePattern(source)).toBeNull()
    }
  )

  it("matches segment by segment", () => {
    const pattern = compilePattern("/eski/:slug/*") ?? []
    expect(matchPattern(pattern, "/eski/bicak/a/b")).toEqual({ slug: "bicak", "*": "a/b" })
    expect(matchPattern(pattern, "/eski/bicak")).toBeNull()
    expect(matchPattern(pattern, "/yeni/bicak/a")).toBeNull()
    expect(matchPattern(compilePattern("/eski/:slug") ?? [], "/eski/bicak/fazla")).toBeNull()
  })

  it("takes a long hostile path in linear time", () => {
    const pattern = compilePattern("/a/:b/:c/*") ?? []
    const path = (size: number) => `/a${"/x".repeat(size)}`
    expect(matchPattern(pattern, path(250))).not.toBeNull()
    const hostile = (size: number) => {
      const long = path(size)
      return () => matchPattern(pattern, long)
    }
    expect(measureGrowth(hostile, 250)).toMatchObject({ linear: true })
  })

  it("tries more literal patterns first, whatever their age", () => {
    const ordered = orderPatterns([
      {
        ...rule({ id: "broad", match: "pattern", source: "/eski/:a/:b" }),
        created_at: "2026-01-01",
      },
      {
        ...rule({ id: "narrow", match: "pattern", source: "/eski/kategori/:slug" }),
        created_at: "2026-06-01",
      },
    ])
    expect(ordered.map(({ id }) => id)).toEqual(["narrow", "broad"])
  })
})

describe("parseSource", () => {
  it.each([
    ["https://eski-site.com/Urun/Kirmizi.html", "exact", "/urun/kirmizi.html"],
    ["/eski-kategori/*", "prefix", "/eski-kategori"],
    ["/eski/:slug", "pattern", "/eski/:slug"],
  ] as const)("%s (%s) → %s", (raw, match, expected) => {
    expect(parseSource(raw, match)).toEqual({ ok: true, value: expected })
  })

  it.each([
    ["/urun.php?id=12", "exact", "seo.redirect_source_query"],
    ["/", "exact", "seo.redirect_source_root"],
    ["/admin/orders", "prefix", "seo.redirect_source_reserved"],
    ["/sepet", "exact", "seo.redirect_source_reserved"],
    ["/eski/*", "exact", "seo.redirect_source_wildcard"],
    ["/:a/:b", "pattern", "seo.redirect_pattern_invalid"],
    ["/a/../b", "exact", "seo.redirect_source_invalid"],
  ] as const)("%s (%s) is refused with %s", (raw, match, key) => {
    expect(parseSource(raw, match)).toEqual({ ok: false, key })
  })
})

describe("parseTarget", () => {
  const exact = { source: "/eski", match: "exact", status: 301 } as const

  it("keeps a site path and its query, normalised", () => {
    expect(parseTarget("/Arama?q=bıçak", exact)).toEqual({
      ok: true,
      value: "/arama?q=b%C4%B1%C3%A7ak",
    })
  })

  it("has none for a 410", () => {
    expect(parseTarget("/x", { ...exact, status: 410 })).toEqual({ ok: true, value: null })
  })

  it.each([
    ["https://rakip.com/x", "seo.redirect_target_invalid"],
    ["//rakip.com/x", "seo.redirect_target_invalid"],
    ["javascript:alert(1)", "seo.redirect_target_invalid"],
    ["/admin", "seo.redirect_target_invalid"],
    ["", "seo.redirect_target_required"],
    ["/eski", "seo.redirect_self"],
  ])("refuses %s", (target, key) => {
    expect(parseTarget(target, exact)).toEqual({ ok: false, key })
  })

  it("refuses a prefix sending under itself and a pattern matching its own target", () => {
    expect(parseTarget("/eski/yeni", { source: "/eski", match: "prefix", status: 301 })).toEqual({
      ok: false,
      key: "seo.redirect_self",
    })
    expect(
      parseTarget("/eski/:slug", { source: "/eski/:slug", match: "pattern", status: 301 })
    ).toEqual({ ok: false, key: "seo.redirect_self" })
  })

  it("refuses placeholders the source does not have", () => {
    expect(
      parseTarget("/urun/:ad", { source: "/eski/:slug", match: "pattern", status: 301 })
    ).toEqual({ ok: false, key: "seo.redirect_target_placeholder" })
  })
})

describe("locationOf", () => {
  it("keeps, drops or lists the request's query; the target's own wins", () => {
    const req = request("/eski?utm_source=x&q=eski&page=2")
    expect(locationOf(rule({ target: "/yeni?q=yeni" }), req)).toBe(
      "/yeni?q=yeni&utm_source=x&page=2"
    )
    expect(locationOf(rule({ query_policy: "drop" }), req)).toBe("/yeni")
    expect(locationOf(rule({ query_policy: "keep_list", query_keep: ["utm_source"] }), req)).toBe(
      "/yeni?utm_source=x"
    )
  })

  it("carries a prefix rule's remainder and a pattern's values, encoded", () => {
    const prefix = rule({ match: "prefix", source: "/eski-kategori", target: "/kategori" })
    expect(locationOf(prefix, request("/eski-kategori/bıçak/sef"))).toBe(
      "/kategori/b%C4%B1%C3%A7ak/sef"
    )
    const pattern = rule({ match: "pattern", source: "/eski/:slug", target: "/urun/:slug" })
    expect(locationOf(pattern, request("/eski/kupa"), { slug: "kupa" })).toBe("/urun/kupa")
  })

  it("has none for a 410", () => {
    expect(locationOf(rule({ status: 410, target: null }), request("/eski"))).toBeNull()
  })
})

describe("pickRule", () => {
  const candidates = [
    rule({ id: "short", match: "prefix", source: "/a" }),
    rule({ id: "long", match: "prefix", source: "/a/b" }),
    rule({ id: "exact", source: "/a/b/c" }),
  ]
  const patterns = orderPatterns([rule({ id: "pattern", match: "pattern", source: "/a/:x/d" })])

  it("prefers the exact rule, then the longest prefix, then a pattern", () => {
    expect(pickRule("/a/b/c", candidates, patterns)?.rule.id).toBe("exact")
    expect(pickRule("/a/b/z", candidates, patterns)?.rule.id).toBe("long")
    expect(pickRule("/a/q/d", candidates.slice(2), patterns)?.params).toEqual({ x: "q" })
    expect(pickRule("/ab", candidates, [])).toBeNull()
  })
})
