import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { URL_REGISTRY_MODULE } from "../../src/modules/url-registry"
import type UrlRegistryModuleService from "../../src/modules/url-registry/service"
import runClaimScript from "../../src/scripts/claim-catalog-paths"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Record_ {
  id: string
  handle: string
}

/** F3.1: category paths carry the tree; records from before F3.1 are brought in line. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }

    const registry = () => getContainer().resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
    const pathOf = (path: string) => registry().resolvePath({ locale: "tr", path })
    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const createCategory = async (body: Record<string, unknown>) =>
      (
        await post<{ product_category: Record_ }>("/admin/product-categories", {
          is_active: true,
          ...body,
        })
      ).data.product_category
    // Written past the workflows, as records made before F3.1 were
    const products = () => getContainer().resolve(Modules.PRODUCT)

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    it("carries the tree in a category's path and moves the subtree with a rename", async () => {
      const kitchen = await createCategory({ name: "Mutfak" })
      const knives = await createCategory({
        name: "Mutfak Bıçakları",
        parent_category_id: kitchen.id,
      })

      expect(knives.handle).toBe("mutfak-bicaklari")
      expect(await pathOf("/kategori/mutfak/mutfak-bicaklari")).toMatchObject({
        entity_id: knives.id,
        status: "active",
      })

      const renamed = await post(`/admin/product-categories/${kitchen.id}`, {
        handle: "mutfak-gerecleri",
      })

      expect(renamed.status).toBe(200)
      expect(await pathOf("/kategori/mutfak-gerecleri/mutfak-bicaklari")).toMatchObject({
        entity_id: knives.id,
        status: "active",
      })
      expect(await pathOf("/kategori/mutfak/mutfak-bicaklari")).toMatchObject({
        entity_id: knives.id,
        status: "reserved",
      })
    })

    it("moves the subtree's paths when a category gets a new parent", async () => {
      const home = await createCategory({ name: "Ev" })
      const kitchen = await createCategory({ name: "Mutfak" })
      const knives = await createCategory({ name: "Bıçaklar", parent_category_id: kitchen.id })

      const moved = await post(`/admin/product-categories/${kitchen.id}`, {
        parent_category_id: home.id,
      })

      expect(moved.status).toBe(200)
      expect(await pathOf("/kategori/ev/mutfak")).toMatchObject({ entity_id: kitchen.id })
      expect(await pathOf("/kategori/ev/mutfak/bicaklar")).toMatchObject({
        entity_id: knives.id,
        status: "active",
      })
      expect(await pathOf("/kategori/mutfak/bicaklar")).toMatchObject({ status: "reserved" })
    })

    it("skips a descendant whose handle predates F3.1 instead of refusing the parent", async () => {
      const kitchen = await createCategory({ name: "Mutfak" })
      const [legacy] = await products().createProductCategories([
        { name: "Şef", handle: "şef", is_active: true, parent_category_id: kitchen.id },
      ])

      const renamed = await post(`/admin/product-categories/${kitchen.id}`, { handle: "mutfak-2" })

      expect(renamed.status).toBe(200)
      expect(legacy?.id).toBeDefined()
      expect(await pathOf("/kategori/mutfak-2")).toMatchObject({ entity_id: kitchen.id })
    })

    it("claims the paths of older records with the script, and runs again safely", async () => {
      const [product] = await products().createProducts([
        { title: "Eski Ürün", handle: "eski-urun", status: "draft" },
      ])
      await products().createProductCategories([{ name: "Şef", handle: "şef", is_active: true }])
      const run = () => runClaimScript({ container: getContainer(), args: [] })

      await run()
      await run()

      expect(await pathOf("/urun/eski-urun")).toEqual({
        entity_type: "product",
        entity_id: product?.id,
        status: "active",
      })
    })
  },
})
