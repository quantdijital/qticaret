import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { WorkflowResponse, createStep, createWorkflow } from "@medusajs/framework/workflows-sdk"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { convertAttributeDefinitionStep } from "../../src/workflows/product-attributes/steps/convert-attribute-definition"
import type { ConvertAttributeDefinitionInput } from "../../src/workflows/product-attributes/steps/convert-attribute-definition"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront, createTestProduct } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Definition {
  id: string
  key: string
  type: string
  options: { value: string; label: string }[] | null
  is_filterable: boolean
}

const OPTIONS = [{ value: "n690", label: "N690 Böhler" }]
const MAPPING = [
  { from: "N690 Böhler", to: "n690" },
  { from: "Böhler N690", to: "n690" },
  { from: "Ergonomik sap", to: null },
]

// A later step that fails: the conversion before it must undo itself in full
const failAfterStep = createStep("test-attribute-convert-fails-after", () => {
  throw new Error("a later step failed")
})
const convertThenFail = createWorkflow(
  "test-attribute-convert-then-fail",
  (input: ConvertAttributeDefinitionInput) => {
    convertAttributeDefinitionStep(input)
    failAfterStep()
    return new WorkflowResponse(null)
  }
)

async function productIdOf(container: MedusaContainer, variantId: string): Promise<string> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant",
    fields: ["product_id"],
    filters: { id: variantId },
  })
  return (data[0] as { product_id: string }).product_id
}

/** adr/0013 Ek 2026-11-05: a text attribute with values turned into a filterable single choice. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("maps every stored text to an option or clears it, refuses gaps and undoes itself", async () => {
      const container = getContainer()
      const admin = await createAdminUser(http, container)
      const storefront = await createStorefront(container)
      const post = <T>(url: string, body: unknown) =>
        settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
      const get = <T>(url: string) => http.get<T>(url, { headers: admin.headers })

      const created = await post<{ attribute_template: { id: string; definitions: Definition[] } }>(
        "/admin/attribute-templates",
        {
          name: "Bıçak",
          handle: `bicak-${randomUUID()}`,
          definitions: [
            { key: "namlu_celigi", label: "Namlu çeliği", type: "text" },
            { key: "namlu_boyu", label: "Namlu boyu", type: "number", unit: "cm" },
          ],
        }
      )
      const template = created.data.attribute_template
      const steel = template.definitions.find((each) => each.key === "namlu_celigi")
      const length = template.definitions.find((each) => each.key === "namlu_boyu")
      const products: string[] = []
      for (const text of ["N690 Böhler", "Böhler N690", "Ergonomik sap"]) {
        const variantId = await createTestProduct(container, storefront.salesChannelId, {
          handle: `bicak-${randomUUID()}`,
          price: 1000,
        })
        const productId = await productIdOf(container, variantId)
        await post(`/admin/products/${productId}/attributes`, {
          template_id: template.id,
          values: { namlu_celigi: text, namlu_boyu: 9 },
        })
        products.push(productId)
      }
      const url = (definitionId: string) =>
        `/admin/attribute-templates/${template.id}/definitions/${definitionId}/convert`
      const valuesOf = async () =>
        Promise.all(
          products.map(async (id) => {
            const { data } = await get<{ values: Record<string, unknown> }>(
              `/admin/products/${id}/attributes`
            )
            return data.values["namlu_celigi"] ?? null
          })
        )
      const definitionOf = async () => {
        const { data } = await get<{ attribute_template: { definitions: Definition[] } }>(
          `/admin/attribute-templates/${template.id}`
        )
        return data.attribute_template.definitions.find((each) => each.key === "namlu_celigi")
      }

      const notText = await post(url(length?.id ?? ""), { options: OPTIONS, mapping: [] })
      const gap = await post(url(steel?.id ?? ""), {
        options: OPTIONS,
        mapping: MAPPING.slice(0, 2),
        is_filterable: true,
      })
      const strayOption = await post(url(steel?.id ?? ""), {
        options: OPTIONS,
        mapping: [...MAPPING.slice(1), { from: "N690 Böhler", to: "m390" }],
      })
      const afterRefusals = { definition: await definitionOf(), values: await valuesOf() }

      const failed = await convertThenFail(container).run({
        input: {
          template_id: template.id,
          definition_id: steel?.id ?? "",
          options: OPTIONS,
          mapping: MAPPING,
          is_filterable: true,
        },
        throwOnError: false,
      })
      const afterUndo = { definition: await definitionOf(), values: await valuesOf() }

      const converted = await post<{ attribute_template: { definitions: Definition[] } }>(
        url(steel?.id ?? ""),
        { options: OPTIONS, mapping: MAPPING, is_filterable: true }
      )
      const store = await http.get<{
        product: { attribute_values: { value_text: string | null }[] }
      }>(`/store/products/${products[0] ?? ""}?fields=+attribute_values.value_text`, {
        headers: storefront.headers,
      })

      expect(notText.status).toBe(409)
      expect(notText.data.message).toBe("product_attributes.convert_text_only")
      expect(gap.status).toBe(400)
      expect(gap.data.message).toBe("product_attributes.convert_unmapped")
      expect(strayOption.status).toBe(400)
      expect(strayOption.data.message).toBe("product_attributes.option_unknown")
      expect(afterRefusals.definition).toMatchObject({ type: "text", is_filterable: false })
      expect(afterRefusals.values).toEqual(["N690 Böhler", "Böhler N690", "Ergonomik sap"])

      expect(failed.errors.length).toBeGreaterThan(0)
      expect(afterUndo.definition).toMatchObject({
        type: "text",
        options: null,
        is_filterable: false,
      })
      expect(afterUndo.values).toEqual(["N690 Böhler", "Böhler N690", "Ergonomik sap"])

      expect(converted.status).toBe(200)
      expect(
        converted.data.attribute_template.definitions.find((each) => each.key === "namlu_celigi")
      ).toMatchObject({ type: "select", options: OPTIONS, is_filterable: true })
      expect(await valuesOf()).toEqual(["n690", "n690", null])
      expect(store.data.product.attribute_values.map((value) => value.value_text)).toContain("n690")
    })
  },
})
