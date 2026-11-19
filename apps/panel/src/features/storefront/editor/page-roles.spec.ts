import { describe, expect, it } from "vitest"
import { namesPage, rolePageId, roleRef } from "./page-roles"
import type { ContentPageOption } from "./use-content-pages"

const page = (id: string, handle: string): ContentPageOption => ({
  id,
  title: handle,
  handle,
  path: `/${handle}`,
  status: "published",
})

describe("the storefront's page roles (adr/0073 Açık kararlar 3)", () => {
  it("keeps a role on a page whose address changed: told by its id", () => {
    const ref = roleRef({ contact_page_id: "cnt_iletisim", contact_form_path: null }, "contact")
    expect(namesPage(ref, page("cnt_iletisim", "bize-ulasin"))).toBe(true)
    expect(namesPage(ref, page("cnt_baska", "iletisim"))).toBe(false)
  })

  it("reads a section saved before the ids as the page at the old address", () => {
    const saved = { payment_page_id: null, payment_info_path: "/odeme-secenekleri/" }
    const pages = [page("cnt_odeme", "odeme-secenekleri"), page("cnt_kargo", "kargo")]
    expect(roleRef(saved, "payment")).toEqual({ id: null, path: "/odeme-secenekleri/" })
    expect(rolePageId(saved, "payment", pages)).toBe("cnt_odeme")
    expect(rolePageId(saved, "payment", undefined)).toBeNull()
    expect(rolePageId({ shipping_info_path: "/yok" }, "shipping", pages)).toBeNull()
  })

  it("reads the old path only while the role has no id", () => {
    const saved = { shipping_page_id: "cnt_silindi", shipping_info_path: "/kargo" }
    expect(roleRef(saved, "shipping")).toEqual({ id: "cnt_silindi", path: null })
    expect(rolePageId(saved, "shipping", [page("cnt_kargo", "kargo")])).toBe("cnt_silindi")
  })
})
