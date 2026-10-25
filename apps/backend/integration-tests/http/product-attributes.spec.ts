import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../src/modules/product-attributes"
import type ProductAttributesModuleService from "../../src/modules/product-attributes/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront, createTestProduct } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Template {
  id: string
  definitions: { id: string; key: string }[]
}

interface ProductAttributes {
  template: { id: string } | null
  values: Record<string, unknown>
}

// Sector-neutral sample attributes: one of each type
const DEFINITIONS = [
  {
    key: "material",
    label: "Malzeme",
    type: "select",
    is_required: true,
    is_seo_highlight: true,
    options: [
      { value: "steel", label: "Çelik" },
      { value: "wood", label: "Ahşap" },
    ],
  },
  { key: "length_cm", label: "Uzunluk", type: "number", unit: "cm" },
  { key: "dishwasher", label: "Bulaşık makinesi", type: "boolean" },
  {
    key: "uses",
    label: "Kullanım",
    type: "multi_select",
    options: [
      { value: "kitchen", label: "Mutfak" },
      { value: "outdoor", label: "Dış mekân" },
    ],
  },
]

/** F2.4 (adr/0013): attribute templates, product values and the Store API. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let storefront: Storefront

    const createTemplate = async (definitions: unknown[] = DEFINITIONS) =>
      (
        await http.post<{ attribute_template: Template }>(
          "/admin/attribute-templates",
          { name: "Örnek şablon", handle: `ornek-${randomUUID()}`, definitions },
          { headers: admin.headers }
        )
      ).data.attribute_template

    async function newProduct(): Promise<string> {
      const variantId = await createTestProduct(getContainer(), storefront.salesChannelId, {
        handle: `urun-${randomUUID()}`,
        price: 1000,
      })
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "product_variant",
        fields: ["product_id"],
        filters: { id: variantId },
      })
      return (data[0] as { product_id: string }).product_id
    }

    const setAttributes = (productId: string, body: unknown) =>
      settle(
        http.post<ProductAttributes & { message?: string }>(
          `/admin/products/${productId}/attributes`,
          body,
          { headers: admin.headers }
        )
      )

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      storefront = await createStorefront(getContainer())
    })

    it("gives a product values from a template and shows them in the Store API (F2 KK)", async () => {
      const template = await createTemplate()
      const productId = await newProduct()

      const saved = await setAttributes(productId, {
        template_id: template.id,
        values: { material: "steel", length_cm: 20.5, uses: ["kitchen", "outdoor"] },
      })
      const fields = [
        "+attribute_values.value_text",
        "+attribute_values.value_number",
        "+attribute_values.value_options",
        "+attribute_values.definition.key",
        "+attribute_values.definition.label",
        "+attribute_values.definition.unit",
        "+attribute_values.definition.options",
      ].join(",")
      const store = await http.get<{
        product: {
          attribute_values?: { definition: Record<string, unknown>; value_text: string | null }[]
        }
      }>(`/store/products/${productId}?fields=${fields}`, { headers: storefront.headers })

      expect(saved.status).toBe(200)
      expect(saved.data.values).toEqual({
        material: "steel",
        length_cm: 20.5,
        uses: ["kitchen", "outdoor"],
      })
      const values = store.data.product.attribute_values ?? []
      const material = values.find((value) => value.value_text === "steel")
      expect(material?.definition).toMatchObject({ key: "material", label: "Malzeme" })
      // The option's label reaches the storefront with the stored value
      expect(material?.definition["options"]).toEqual(
        expect.arrayContaining([{ value: "steel", label: "Çelik" }])
      )
    })

    it("keeps values left out, clears one with null and checks each against its definition", async () => {
      const template = await createTemplate()
      const productId = await newProduct()
      await setAttributes(productId, {
        template_id: template.id,
        values: { material: "steel", length_cm: 10 },
      })

      const partial = await setAttributes(productId, {
        template_id: template.id,
        values: { length_cm: null, dishwasher: true },
      })
      const unknownOption = await setAttributes(productId, {
        template_id: template.id,
        values: { material: "plastic" },
      })
      const requiredCleared = await setAttributes(productId, {
        template_id: template.id,
        values: { material: null },
      })

      expect(partial.data.values).toEqual({ material: "steel", dishwasher: true })
      expect(unknownOption.status).toBe(400)
      expect(unknownOption.data.message).toBe("product_attributes.option_unknown")
      expect(requiredCleared.status).toBe(400)
    })

    it("drops the old template's values when the template changes or is removed", async () => {
      const first = await createTemplate()
      const second = await createTemplate([{ key: "color_name", label: "Renk", type: "text" }])
      const productId = await newProduct()
      await setAttributes(productId, { template_id: first.id, values: { material: "wood" } })

      const unconfirmed = await setAttributes(productId, {
        template_id: second.id,
        values: { color_name: "Kırmızı" },
      })
      const switched = await setAttributes(productId, {
        template_id: second.id,
        values: { color_name: "Kırmızı" },
        confirm_template_change: true,
      })
      const removed = await setAttributes(productId, {
        template_id: null,
        confirm_template_change: true,
      })

      expect(unconfirmed.status).toBe(409)
      expect(unconfirmed.data.message).toBe("product_attributes.template_change_unconfirmed")
      expect(switched.data).toMatchObject({
        template: { id: second.id },
        values: { color_name: "Kırmızı" },
      })
      expect(removed.data).toEqual({ template: null, values: {} })
    })

    it("locks a definition's type while products use it and removes its values only on confirmation", async () => {
      const template = await createTemplate()
      const productId = await newProduct()
      await setAttributes(productId, {
        template_id: template.id,
        values: { material: "steel", length_cm: 5 },
      })
      const ids = Object.fromEntries(template.definitions.map((item) => [item.key, item.id]))
      const update = (body: unknown) =>
        settle(
          http.post<{ message?: string }>(`/admin/attribute-templates/${template.id}`, body, {
            headers: admin.headers,
          })
        )
      const withIds = DEFINITIONS.map((item) => ({ ...item, id: ids[item.key] }))

      const typeChange = await update({
        definitions: withIds.map((item) =>
          item.key === "length_cm" ? { ...item, type: "text", unit: null } : item
        ),
      })
      const withoutLength = withIds.filter((item) => item.key !== "length_cm")
      const unconfirmed = await update({ definitions: withoutLength })
      const confirmed = await update({ definitions: withoutLength, confirm_delete_values: true })
      const after = await http.get<ProductAttributes>(`/admin/products/${productId}/attributes`, {
        headers: admin.headers,
      })

      expect(typeChange.status).toBe(409)
      expect(typeChange.data.message).toBe("product_attributes.type_locked")
      expect(unconfirmed.status).toBe(409)
      expect(unconfirmed.data.message).toBe("product_attributes.values_exist")
      expect(confirmed.status).toBe(200)
      expect(after.data.values).toEqual({ material: "steel" })
    })

    it("refuses to delete a template in use, and records attribute changes before and after", async () => {
      const template = await createTemplate()
      const productId = await newProduct()
      await setAttributes(productId, { template_id: template.id, values: { material: "steel" } })
      await setAttributes(productId, { template_id: template.id, values: { material: "wood" } })

      const inUse = await settle(
        http.delete(`/admin/attribute-templates/${template.id}`, { headers: admin.headers })
      )
      let diff: unknown
      for (let attempt = 0; attempt < 30 && diff === undefined; attempt++) {
        const { data } = await http.get<{
          audit_entries: { action: string; changes: { diff?: Record<string, unknown> } }[]
        }>(`/admin/audit-log?resource_id=${productId}&kind=mutation`, { headers: admin.headers })
        diff = data.audit_entries.find((entry) => entry.changes.diff?.["value.material"])?.changes
          .diff
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      expect(inUse.status).toBe(409)
      expect(diff).toEqual({ "value.material": { before: "steel", after: "wood" } })
    })

    it("deletes a product's values with the product", async () => {
      const template = await createTemplate()
      const productId = await newProduct()
      await setAttributes(productId, { template_id: template.id, values: { material: "steel" } })
      const service =
        getContainer().resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
      const before = await service.listAttributeValues({})

      await http.delete(`/admin/products/${productId}`, { headers: admin.headers })
      let after = before
      for (let attempt = 0; attempt < 30 && after.length === before.length; attempt++) {
        after = await service.listAttributeValues({})
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      expect(before).toHaveLength(1)
      expect(after).toHaveLength(0)
    })

    it.each([
      "*attribute_values",
      "*attribute_values.definition",
      "attribute_values.*",
      "+attribute_values.definition.is_required",
      "+attribute_values.definition.template.id",
      "+attribute_values.definition.values.id",
      "*attribute_template",
    ])("refuses store fields %s on the product list and detail", async (field) => {
      const productId = await newProduct()
      const list = await settle(
        http.get(`/store/products?fields=${field}`, { headers: storefront.headers })
      )
      const detail = await settle(
        http.get(`/store/products/${productId}?fields=${field}`, { headers: storefront.headers })
      )

      expect(list.status).toBe(400)
      expect(detail.status).toBe(400)
    })

    it("keeps options in use, keys and units of attributes with values; a key can be re-added", async () => {
      const template = await createTemplate()
      const productId = await newProduct()
      await setAttributes(productId, {
        template_id: template.id,
        values: { material: "steel", length_cm: 3 },
      })
      const ids = Object.fromEntries(template.definitions.map((item) => [item.key, item.id]))
      const withIds = DEFINITIONS.map((item) => ({ ...item, id: ids[item.key] }))
      const update = (definitions: unknown[], confirm = false) =>
        settle(
          http.post<{ message?: string }>(
            `/admin/attribute-templates/${template.id}`,
            { definitions, ...(confirm ? { confirm_delete_values: true } : {}) },
            { headers: admin.headers }
          )
        )

      const dropUsed = await update(
        withIds.map((item) =>
          item.key === "material" ? { ...item, options: [{ value: "wood", label: "Ahşap" }] } : item
        )
      )
      const renamed = await update(
        withIds.map((item) => (item.key === "length_cm" ? { ...item, key: "length" } : item))
      )
      const readded = await update(
        [
          ...withIds.filter((item) => item.key !== "length_cm"),
          { key: "length_cm", label: "Uzunluk", type: "number", unit: "mm" },
        ],
        true
      )

      expect(dropUsed.status).toBe(409)
      expect(dropUsed.data.message).toBe("product_attributes.option_in_use")
      expect(renamed.status).toBe(409)
      expect(renamed.data.message).toBe("product_attributes.definition_locked")
      expect(readded.status).toBe(200)
    })
  },
})
