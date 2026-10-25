import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { PRODUCT_ATTRIBUTES_MODULE } from ".."
import { uniqueViolationKeys } from "../../../lib/errors"
import type ProductAttributesModuleService from "../service"

jest.setTimeout(120 * 1000)

moduleIntegrationTestRunner<ProductAttributesModuleService>({
  moduleName: PRODUCT_ATTRIBUTES_MODULE,
  resolve: "./src/modules/product-attributes",
  testSuite: ({ service }) => {
    it("stores a template with typed definitions and values", async () => {
      const template = await service.createAttributeTemplates({ name: "Şablon", handle: "sablon" })
      const [weight] = await service.createAttributeDefinitions([
        { template_id: template.id, key: "weight_g", label: "Ağırlık", type: "number", unit: "g" },
      ])
      await service.createAttributeValues({ definition_id: weight?.id ?? "", value_number: 182.5 })

      const stored = await service.retrieveAttributeTemplate(template.id, {
        relations: ["definitions", "definitions.values"],
      })

      expect(stored.definitions[0]).toMatchObject({
        key: "weight_g",
        scope: "product",
        is_required: false,
      })
      expect(Number(stored.definitions[0]?.values[0]?.value_number)).toBe(182.5)
    })

    it("keeps keys unique within a template, not across templates", async () => {
      const [first, second] = await service.createAttributeTemplates([
        { name: "A", handle: "a" },
        { name: "B", handle: "b" },
      ])
      const definition = { key: "color_name", label: "Renk", type: "text" as const }
      await service.createAttributeDefinitions({ ...definition, template_id: first?.id ?? "" })
      await service.createAttributeDefinitions({ ...definition, template_id: second?.id ?? "" })

      const duplicate = await service
        .createAttributeDefinitions({ ...definition, template_id: first?.id ?? "" })
        .then(
          () => null,
          (error: unknown) => error
        )

      expect(uniqueViolationKeys(duplicate)).toEqual(expect.arrayContaining(["key"]))
    })

    it("refuses a second template with the same handle", async () => {
      await service.createAttributeTemplates({ name: "A", handle: "ayni" })

      const duplicate = await service.createAttributeTemplates({ name: "B", handle: "ayni" }).then(
        () => null,
        (error: unknown) => error
      )

      expect(uniqueViolationKeys(duplicate)).toEqual(["handle"])
    })
  },
})
