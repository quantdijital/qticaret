import { describe, expect, it } from "vitest"
import { breadcrumbJsonLd } from "../breadcrumbs"

describe("breadcrumbJsonLd", () => {
  it("lists the steps with absolute addresses, in order", () => {
    const [block] = breadcrumbJsonLd("magaza.example", [
      { name: "Ana sayfa", path: "/" },
      { name: "Blog", path: "/blog" },
    ])
    expect(block).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { position: 1, name: "Ana sayfa", item: "https://magaza.example/" },
        { position: 2, name: "Blog", item: "https://magaza.example/blog" },
      ],
    })
  })

  it("says nothing without a canonical host", () => {
    expect(breadcrumbJsonLd(null, [{ name: "Blog", path: "/blog" }])).toEqual([])
  })
})
