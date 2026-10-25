import { describe, expect, it } from "vitest"
import { EMPTY_REDIRECT, formOf, inputOf, redirectSchema } from "./form"

const issues = (values: Record<string, unknown>) => {
  const result = redirectSchema.safeParse({ ...EMPTY_REDIRECT, ...values })
  return result.success ? [] : result.error.issues.map((issue) => issue.message)
}

describe("redirect form", () => {
  it("needs a path or an old address as the source, and a target unless 410", () => {
    expect(issues({ source: "eski", target: "/yeni" })).toEqual(["seo.redirects.form.sourceSlash"])
    expect(issues({ source: "https://eski.com/a", target: "/yeni" })).toEqual([])
    expect(issues({ source: "/eski" })).toEqual(["seo.redirects.form.targetRequired"])
    expect(issues({ source: "/eski", target: "yeni" })).toEqual(["seo.redirects.form.targetSlash"])
    expect(issues({ source: "/eski", status: "410" })).toEqual([])
  })

  it("asks for names when only listed parameters are kept", () => {
    expect(issues({ source: "/a", target: "/b", query_policy: "keep_list" })).toEqual([
      "seo.redirects.form.keepRequired",
    ])
  })

  it("sends no target for a 410 and the listed names once", () => {
    expect(
      inputOf({
        ...EMPTY_REDIRECT,
        source: "/a",
        target: "/b",
        status: "410",
        query_policy: "keep_list",
        query_keep: "utm_source, utm_source utm_medium",
      })
    ).toEqual({
      match: "exact",
      source: "/a",
      status: 410,
      target: null,
      query_policy: "keep_list",
      query_keep: ["utm_source", "utm_medium"],
    })
  })

  it("shows a stored prefix with its wildcard", () => {
    expect(
      formOf({
        id: "redir_1",
        source: "/eski",
        match: "prefix",
        target: "/yeni",
        status: 301,
        query_policy: "keep",
        query_keep: [],
        origin: "manual",
        hit_count: 0,
        last_hit_at: null,
        created_at: "2026-10-26T00:00:00Z",
        shadowed: false,
      })
    ).toMatchObject({ source: "/eski/*", status: "301", target: "/yeni" })
  })
})
