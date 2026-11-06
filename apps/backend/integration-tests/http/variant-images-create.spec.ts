import type { CreateProductWorkflowInputDTO } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

// A product made with its variant pictures, then a step that fails: everything is undone
const failAfterCreate = createStep("test-variant-images-fail", () => {
  throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "test.fail")
})
const createThenFail = createWorkflow(
  "test-variant-images-create-then-fail",
  (input: {
    products: CreateProductWorkflowInputDTO[]
    additional_data?: Record<string, unknown>
  }) => {
    createProductsWorkflow.runAsStep({ input })
    failAfterCreate()
    return new WorkflowResponse(undefined)
  }
)

const PURPLE = "https://cdn.example.com/bicak-mor.jpg"
const GREEN = "https://cdn.example.com/bicak-yesil.jpg"
const SHARED = "https://cdn.example.com/bicak-genel.jpg"

interface Created {
  id: string
  images: { id: string; url: string }[]
  variants: { id: string; title: string }[]
}

// A knife in two colours, each with its own picture, and one for both
const knife = (handle: string, variantImages?: unknown) => ({
  title: "Şef Bıçağı",
  handle,
  status: "draft",
  images: [{ url: SHARED }, { url: PURPLE }, { url: GREEN }],
  options: [{ title: "Renk", values: ["Mor", "Yeşil"] }],
  variants: ["Mor", "Yeşil"].map((colour) => ({
    title: colour,
    options: { Renk: colour },
    manage_inventory: false,
    prices: [{ currency_code: "try", amount: 1000 }],
  })),
  ...(variantImages === undefined ? {} : { additional_data: { variant_images: variantImages } }),
})

/** A new product's variant pictures, tied in the create's own workflow (POST /admin/products). */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    const create = (body: unknown) =>
      settle(
        http.post<{ product: Created; message?: string }>("/admin/products", body, {
          headers: admin.headers,
        })
      )
    // Each picture's address to the titles of the variants tied to it
    async function tiesOf(productId: string): Promise<Record<string, string[]>> {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "product",
          fields: ["images.url", "images.variants.title"],
          filters: { id: productId },
        })
      const found = data[0] as
        { images?: { url: string; variants?: { title: string }[] | null }[] } | undefined
      return Object.fromEntries(
        (found?.images ?? []).map((image) => [
          image.url,
          (image.variants ?? []).map((variant) => variant.title).sort(),
        ])
      )
    }
    const productsNamed = (handle: string) =>
      getContainer().resolve(Modules.PRODUCT).listProducts({ handle })

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    it("ties the pictures picked before the product existed to its new variants", async () => {
      const answer = await create(
        knife("sef-bicagi-gorselli", [
          { options: { Renk: "Mor" }, image_urls: [PURPLE] },
          { options: { Renk: "Yeşil" }, image_urls: [GREEN, PURPLE] },
        ])
      )
      expect(answer.status).toBe(200)
      expect(await tiesOf(answer.data.product.id)).toEqual({
        [SHARED]: [],
        [PURPLE]: ["Mor", "Yeşil"],
        [GREEN]: ["Yeşil"],
      })
    })

    it("creates a product without variant pictures as before", async () => {
      const answer = await create(knife("sef-bicagi-gorselsiz"))
      expect(answer.status).toBe(200)
      expect(await tiesOf(answer.data.product.id)).toEqual({
        [SHARED]: [],
        [PURPLE]: [],
        [GREEN]: [],
      })
    })

    it("refuses a picture the product lacks and leaves no product behind", async () => {
      const answer = await create(
        knife("sef-bicagi-yabanci", [
          { options: { Renk: "Mor" }, image_urls: ["https://cdn.example.com/yok.jpg"] },
        ])
      )
      expect([answer.status, answer.data.message]).toEqual([400, "catalog.variant_image_unknown"])
      expect(await productsNamed("sef-bicagi-yabanci")).toEqual([])
    })

    it("refuses a variant the product lacks and leaves no product behind", async () => {
      const answer = await create(
        knife("sef-bicagi-renksiz", [{ options: { Renk: "Kırmızı" }, image_urls: [PURPLE] }])
      )
      expect(answer.status).toBe(400)
      expect(await productsNamed("sef-bicagi-renksiz")).toEqual([])
    })

    it("refuses a malformed list before the product is made", async () => {
      const answer = await create(
        knife("sef-bicagi-bozuk", [{ options: { Renk: "Mor" }, image_urls: [] }])
      )
      expect(answer.status).toBe(400)
      expect(await productsNamed("sef-bicagi-bozuk")).toEqual([])
    })

    it("takes the ties back when a later step undoes the product", async () => {
      const products = getContainer().resolve(Modules.PRODUCT)
      const untie = jest.spyOn(products, "removeImageFromVariant")
      const { errors } = await createThenFail(getContainer()).run({
        input: {
          products: [knife("sef-bicagi-geri") as never],
          additional_data: {
            variant_images: [{ options: { Renk: "Mor" }, image_urls: [PURPLE] }],
          },
        },
        throwOnError: false,
      })
      expect(errors.length).toBeGreaterThan(0)
      expect(untie).toHaveBeenCalledTimes(1)
      const untied = (untie.mock.calls[0]?.[0] ?? []) as { image_id: string; variant_id: string }[]
      expect(untied.map((tie) => [tie.image_id.slice(0, 4), tie.variant_id.slice(0, 8)])).toEqual([
        ["img_", "variant_"],
      ])
      expect(await productsNamed("sef-bicagi-geri")).toEqual([])
      untie.mockRestore()
    })
  },
})
