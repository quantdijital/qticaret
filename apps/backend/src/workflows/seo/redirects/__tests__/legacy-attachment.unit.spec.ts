import type { MedusaContainer } from "@medusajs/framework/types"
import { attachmentTarget } from "../legacy-attachment"
import type { Follow } from "../legacy-pages"
import type { Resolution } from "../resolve"

const entity = (path: string, entity_type: string, entity_id: string): Resolution => ({
  type: "entity",
  path,
  entity_type,
  entity_id,
})
const NOT_FOUND: Resolution = { type: "not_found", path: null }

/** A shop whose paths answer as `pages` says, `moved` the records a WordPress migration made. */
function shop(pages: Record<string, Resolution>, moved: string[]) {
  const asked: { path: string; legacy: boolean | undefined }[] = []
  const follow: Follow = (request, options) => {
    asked.push({ path: request.path, legacy: options?.legacy })
    return Promise.resolve(pages[request.path] ?? NOT_FOUND)
  }
  const listMigrationItems = jest.fn((filters: { kind: string; target_id: string }) =>
    Promise.resolve(
      moved.includes(`${filters.kind}:${filters.target_id}`) ? [{ id: "mitem_1" }] : []
    )
  )
  const container = { resolve: () => ({ listMigrationItems }) } as unknown as MedusaContainer
  const target = (path: string) => attachmentTarget(container, follow, path)
  return { target, asked, listMigrationItems }
}

describe("a WordPress attachment page's answer (adr/0059 Ek 2026-11-06)", () => {
  const pages: Record<string, Resolution> = {
    "/urun/dokum-tava": entity("/urun/dokum-tava", "product", "prod_1"),
    "/tava-bakimi": {
      type: "redirect",
      path: "/tava-bakimi",
      status: 301,
      location: "/blog/tava-bakimi",
    },
    "/blog/tava-bakimi": entity("/blog/tava-bakimi", "post", "post_1"),
    "/hakkimizda": entity("/hakkimizda", "page", "page_1"),
    "/mutfak/tavalar": {
      type: "redirect",
      path: "/mutfak/tavalar",
      status: 301,
      location: "/kategori/mutfak/tavalar",
    },
    "/kategori/mutfak/tavalar": entity("/kategori/mutfak/tavalar", "product_category", "pcat_1"),
    "/urun/yeni-urun": entity("/urun/yeni-urun", "product", "prod_new"),
    "/eski-kampanya": { type: "gone", path: "/eski-kampanya" },
  }
  const moved = ["product:prod_1", "post:post_1", "page:page_1", "category:pcat_1"]

  it("leads to the moved record's page today, in one hop", async () => {
    const { target } = shop(pages, moved)
    expect(await target("/urun/dokum-tava/tava")).toEqual({
      location: "/urun/dokum-tava",
      status: 301,
    })
    // A parent whose old path moved on: straight to where it went
    expect(await target("/tava-bakimi/kapak")).toEqual({
      location: "/blog/tava-bakimi",
      status: 301,
    })
    expect(await target("/tava-bakimi/attachment/kapak")).toEqual({
      location: "/blog/tava-bakimi",
      status: 301,
    })
    expect(await target("/hakkimizda/ekip")).toEqual({ location: "/hakkimizda", status: 301 })
  })

  it("asks the parent without the old platform's rules, so it never recurses", async () => {
    const { target, asked } = shop(pages, moved)
    await target("/a/b/c/d")
    expect(asked).toEqual([{ path: "/a/b/c", legacy: false }])
    asked.length = 0
    await target("/tava-bakimi/kapak")
    expect(asked).toEqual([
      { path: "/tava-bakimi", legacy: false },
      { path: "/blog/tava-bakimi", legacy: false },
    ])
  })

  it("answers nothing under a category, a record never moved, a gone or unknown parent", async () => {
    const { target, listMigrationItems } = shop(pages, moved)
    for (const path of [
      "/mutfak/tavalar/tava",
      "/kategori/mutfak/tavalar/x",
      "/urun/yeni-urun/tava",
      "/eski-kampanya/afis",
      "/hic-olmayan/tava",
      "/tava",
    ]) {
      expect({ path, answer: await target(path) }).toEqual({ path, answer: null })
    }
    // Only the product asked whether it moved: a category is no file's parent
    expect(listMigrationItems).toHaveBeenCalledTimes(1)
    expect(listMigrationItems.mock.calls[0]?.[0]).toMatchObject({
      kind: "product",
      target_id: "prod_new",
      status: "done",
    })
  })
})
