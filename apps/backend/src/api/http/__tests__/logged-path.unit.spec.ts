import { loggedPath } from "../request-path"

describe("loggedPath", () => {
  it.each([
    ["/feeds/abc123/google.xml", "/feeds/:token/google.xml"],
    ["/store/storefront-layout/design/sfd_x.sig", "/store/storefront-layout/design/:token"],
    [
      "/store/storefront-layout/design/sfd_x.sig/pages/pg_1",
      "/store/storefront-layout/design/:token/pages/pg_1",
    ],
    ["/store/storefront-layout/preview/sfl_x.sig", "/store/storefront-layout/preview/:token"],
    ["/store/storefront-layout/session/abc", "/store/storefront-layout/session/:token"],
    ["/store/content/preview/cnt_x.sig", "/store/content/preview/:token"],
    ["/store/product-preview/prod_x.sig", "/store/product-preview/:token"],
  ])("masks the token in %s", (path, kept) => {
    expect(loggedPath(path)).toBe(kept)
  })

  it("keeps paths without a token as they are", () => {
    expect(loggedPath("/store/storefront-layout")).toBe("/store/storefront-layout")
    expect(loggedPath("/store/products/prod_1")).toBe("/store/products/prod_1")
  })
})
