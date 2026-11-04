import { randomUUID } from "node:crypto"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront, createTestProduct } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Template {
  id: string
  groups: { key: string; name: string; rank: number }[] | null
  definitions: { id: string; key: string; group: string | null }[]
}

const GROUPS = [
  { key: "blade", name: "Bıçak", rank: 0 },
  { key: "handle", name: "Sap", rank: 1 },
]

const DEFINITIONS = [
  { key: "length_cm", label: "Uzunluk", type: "number", unit: "cm", group: "blade" },
  { key: "steel", label: "Çelik", type: "text", group: "blade" },
  { key: "handle_wood", label: "Sap ağacı", type: "text", group: "handle" },
  { key: "note", label: "Not", type: "text" },
]

/** adr/0013 Ek 2026-11-04: a template's spec table sections, each attribute in one or none. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("keeps sections with the template, refuses an unknown one and serves them in the Store API", async () => {
      const container = getContainer()
      const admin = await createAdminUser(http, container)
      const storefront = await createStorefront(container)
      const post = <T>(url: string, body: unknown) =>
        settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))

      const stray = await post("/admin/attribute-templates", {
        name: "Hatalı",
        handle: `hatali-${randomUUID()}`,
        groups: GROUPS,
        definitions: [{ key: "x", label: "X", type: "text", group: "blade_2" }],
      })
      const created = await post<{ attribute_template: Template }>("/admin/attribute-templates", {
        name: "Bıçak şablonu",
        handle: `bicak-${randomUUID()}`,
        groups: GROUPS,
        definitions: DEFINITIONS,
      })
      const template = created.data.attribute_template
      const variantId = await createTestProduct(container, storefront.salesChannelId, {
        handle: `urun-${randomUUID()}`,
        price: 1000,
      })
      const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
        entity: "product_variant",
        fields: ["product_id"],
        filters: { id: variantId },
      })
      const productId = (data[0] as { product_id: string }).product_id
      await post(`/admin/products/${productId}/attributes`, {
        template_id: template.id,
        values: { length_cm: 21, steel: "N690", handle_wood: "Ceviz", note: "El yapımı" },
      })
      const fields = [
        "+attribute_values.value_text",
        "+attribute_values.definition.key",
        "+attribute_values.definition.group",
        "+attribute_values.definition.template.groups",
      ].join(",")
      const store = await http.get<{
        product: {
          attribute_values: {
            definition: { key: string; group: string | null; template: { groups: unknown } }
          }[]
        }
      }>(`/store/products/${productId}?fields=${fields}`, { headers: storefront.headers })
      const reachOut = await settle(
        http.get(`/store/products/${productId}?fields=+attribute_values.definition.template.name`, {
          headers: storefront.headers,
        })
      )
      // Renamed, reordered, one taken away without the definitions: its attributes show in none
      const updated = await post<{ attribute_template: Template }>(
        `/admin/attribute-templates/${template.id}`,
        { groups: [{ key: "handle", name: "Sap ve gövde", rank: 0 }] }
      )
      // Definitions sent without `group` keep theirs
      const kept = await post<{ attribute_template: Template }>(
        `/admin/attribute-templates/${template.id}`,
        {
          definitions: updated.data.attribute_template.definitions.map(({ id, key }) => ({
            id,
            key,
            label: key,
            type: key === "length_cm" ? "number" : "text",
            ...(key === "length_cm" ? { unit: "cm" } : {}),
          })),
        }
      )
      const groupOf = (each: Template, key: string) =>
        each.definitions.find((definition) => definition.key === key)?.group

      expect(stray.status).toBe(400)
      expect(stray.data.message).toBe("product_attributes.group_unknown")
      expect(created.status).toBe(200)
      expect(template.groups).toEqual(GROUPS)
      expect(groupOf(template, "steel")).toBe("blade")
      expect(groupOf(template, "note")).toBeNull()
      const byKey = new Map(
        store.data.product.attribute_values.map((value) => [value.definition.key, value.definition])
      )
      expect(byKey.get("length_cm")?.group).toBe("blade")
      expect(byKey.get("handle_wood")?.template.groups).toEqual(GROUPS)
      expect(reachOut.status).toBe(400)
      expect(updated.data.attribute_template.groups).toEqual([
        { key: "handle", name: "Sap ve gövde", rank: 0 },
      ])
      expect(groupOf(updated.data.attribute_template, "steel")).toBeNull()
      expect(groupOf(updated.data.attribute_template, "handle_wood")).toBe("handle")
      expect(groupOf(kept.data.attribute_template, "handle_wood")).toBe("handle")
    })
  },
})
