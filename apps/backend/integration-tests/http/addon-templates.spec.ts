import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { BANK_TRANSFER, orderLines } from "../helpers/gift-sale"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { readyCart } from "../helpers/paytr"
import { sheetClient } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

/**
 * The product ↔ add-on template link's entry point (`links/product-addon-template.ts`),
 * named here: importing a link definition outside the app evaluates it before its
 * modules' linkables exist.
 */
const PRODUCT_ADDON_TEMPLATE_LINK = "product_addon_template"

type Answer = { message?: string } & Record<string, unknown>
interface Addon {
  id: string
  kind: string
  label: string
  price?: number
}
interface Template {
  id: string
  name: string
  addons: Addon[]
  product_count: number
  attribute_templates: { id: string; name: string }[]
}
interface Catalog {
  addons: Addon[]
  addon_templates: { id: string; via: string; addons: Addon[] }[]
  addons_hidden: number
}

const ENGRAVING = {
  kind: "text",
  label: "Bıçağa isim kazıma",
  price: 150,
  non_withdrawable: true,
  text: { max_length: 30 },
}
const OWN = {
  kind: "choice",
  label: "Kılıf",
  choices: [
    { label: "Siyah", price: 300 },
    { label: "Kahve", price: 250 },
  ],
}

let made = 0

async function cartLine(container: MedusaContainer, cartId: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "cart",
    fields: ["items.id", "items.unit_price", "items.is_custom_price", "items.metadata"],
    filters: { id: cartId },
  })
  const line = (
    data[0] as {
      items: { id: string; unit_price: unknown; is_custom_price: boolean; metadata: unknown }[]
    }
  ).items[0]
  if (!line) {
    throw new Error("the cart has no line")
  }
  return { ...line, unit_price: Number(line.unit_price) }
}

/**
 * adr/0052 Ek 2026-11-23: add-on templates, defined once and linked to
 * products live (directly, in bulk, through an attribute template);
 * priced on the server as a product's own; orders keep what they recorded.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop
    const sheets = sheetClient(http, getContainer, () => admin.headers)

    const staff = (url: string, body: unknown, headers = admin.headers) =>
      settle(http.post<Answer>(url, body, { headers }))
    const read = <T>(url: string) => settle(http.get<T>(url, { headers: admin.headers }))
    const flag = (enabled: boolean) => staff("/admin/features/catalog.addons", { enabled })
    const post = (url: string, body: unknown) =>
      settle(http.post<Answer>(url, body, { headers: store.headers }))
    const storeAddons = (productId: string) =>
      settle(
        http.get<{ addons: Addon[] }>(`/store/products/${productId}/addons`, {
          headers: store.headers,
        })
      )
    const catalog = async (productId: string) =>
      (await read<Catalog>(`/admin/products/${productId}/catalog`)).data
    const product = (price = 1000) =>
      stockedProduct(getContainer(), shop, `sablon-${String((made += 1))}`, 50, price)
    const createTemplate = async (addons: unknown[] = [ENGRAVING], name = "Kazıma") =>
      (await staff("/admin/addon-templates", { name, addons })).data["addon_template"] as Template
    const link = (productId: string, ids: string[]) =>
      staff(`/admin/products/${productId}/addon-templates`, { template_ids: ids })

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      store = await createStorefront(container)
      admin = await createAdminUser(http, container)
      await staff("/admin/platform-settings/bank_transfer", {
        enabled: true,
        account_holder: "Örnek Ticaret A.Ş.",
        bank_name: "Örnek Bankası",
        iban: "TR330006100519786457841326",
        deadline_hours: 24,
      })
    })
    // Flags live in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await flag(false)
    })

    it("creates, reads, updates and deletes templates, checked as a product's add-ons", async () => {
      const off = await staff("/admin/addon-templates", { name: "Kazıma", addons: [ENGRAVING] })
      await flag(true)
      const empty = await staff("/admin/addon-templates", { name: "Boş", addons: [] })
      const paidRequired = await staff("/admin/addon-templates", {
        name: "Zorunlu",
        addons: [{ ...ENGRAVING, required: true }],
      })
      const noName = await staff("/admin/addon-templates", { name: " ", addons: [ENGRAVING] })
      const created = await createTemplate()
      const list = await read<{ addon_templates: Template[]; count: number }>(
        "/admin/addon-templates"
      )
      const renamed = await staff(`/admin/addon-templates/${created.id}`, {
        name: "İsim kazıma",
        addons: [{ ...ENGRAVING, id: created.addons[0]?.id, price: 175 }],
      })
      const removed = await settle(
        http.delete<Answer>(`/admin/addon-templates/${created.id}`, { headers: admin.headers })
      )
      const gone = await read<Answer>(`/admin/addon-templates/${created.id}`)

      expect([off.status, off.data.message]).toEqual([400, "catalog.addons_disabled"])
      // A template is made by its name first and filled on its page
      expect(empty.status).toBe(200)
      expect([paidRequired.status, paidRequired.data.message]).toEqual([
        400,
        "addons.required_must_be_free",
      ])
      expect([noName.status, noName.data.message]).toEqual([400, "addon_templates.name_invalid"])
      expect(created).toMatchObject({ name: "Kazıma", product_count: 0, attribute_templates: [] })
      expect(created.addons).toEqual([
        expect.objectContaining({ id: expect.any(String) as unknown, price: 150 }) as unknown,
      ])
      // By name: "Boş" (made empty above) before "Kazıma"
      expect(list.data.addon_templates.map((each) => each.name)).toEqual(["Boş", "Kazıma"])
      expect(renamed.data["addon_template"]).toMatchObject({
        name: "İsim kazıma",
        addons: [expect.objectContaining({ id: created.addons[0]?.id, price: 175 })],
      })
      expect(removed.status).toBe(200)
      expect(gone.status).toBe(404)
    })

    it("links a template to a product live: the store reads it, an edit reaches every product", async () => {
      await flag(true)
      const template = await createTemplate()
      const a = await product()
      const b = await product()
      await staff(`/admin/products/${a.productId}/catalog`, { addons: [OWN] })
      const linkedA = await link(a.productId, [template.id])
      await link(b.productId, [template.id])
      const unknown = await link(b.productId, ["adtpl_yok"])
      const before = await storeAddons(a.productId)
      await staff(`/admin/addon-templates/${template.id}`, {
        addons: [{ ...ENGRAVING, id: template.addons[0]?.id, price: 200 }],
      })
      const afterA = await storeAddons(a.productId)
      const afterB = await storeAddons(b.productId)
      const listed = await read<{ addon_templates: Template[] }>("/admin/addon-templates")
      const unlinked = await link(a.productId, [])
      const afterUnlink = await storeAddons(a.productId)

      expect(linkedA.status).toBe(200)
      expect((linkedA.data as unknown as Catalog).addon_templates).toEqual([
        expect.objectContaining({ id: template.id, via: "product" }) as unknown,
      ])
      expect(unknown.status).toBe(404)
      // Own first, then the template's, ids as stored
      expect(before.data.addons.map((addon) => addon.label)).toEqual([
        "Kılıf",
        "Bıçağa isim kazıma",
      ])
      expect(before.data.addons[1]?.id).toBe(template.addons[0]?.id)
      expect(afterA.data.addons[1]).toMatchObject({ price: 200 })
      expect(afterB.data.addons).toEqual([expect.objectContaining({ price: 200 })])
      expect(listed.data.addon_templates[0]?.product_count).toBe(2)
      expect(unlinked.status).toBe(200)
      expect(afterUnlink.data.addons.map((addon) => addon.label)).toEqual(["Kılıf"])
    })

    it("keeps five add-ons in all: linking, own saves and template growth are refused past it", async () => {
      await flag(true)
      const two = await createTemplate([ENGRAVING, { ...ENGRAVING, label: "Arka yüz kazıma" }])
      const p = await product()
      await staff(`/admin/products/${p.productId}/catalog`, {
        addons: [OWN, { ...OWN, label: "Kutu" }, { ...OWN, label: "Bağ" }],
      })
      const fits = await link(p.productId, [two.id])
      const ownOver = await staff(`/admin/products/${p.productId}/catalog`, {
        addons: [
          OWN,
          { ...OWN, label: "Kutu" },
          { ...OWN, label: "Bağ" },
          { ...OWN, label: "Not" },
        ],
      })
      const grows = await staff(`/admin/addon-templates/${two.id}`, {
        addons: [
          ...two.addons.map((addon) => ({ ...ENGRAVING, id: addon.id, label: addon.label })),
          { ...ENGRAVING, label: "Üçüncü" },
        ],
      })
      const other = await createTemplate([ENGRAVING], "Tek")
      const linkOver = await link(p.productId, [two.id, other.id])

      expect(fits.status).toBe(200)
      expect([ownOver.status, ownOver.data.message]).toEqual([400, "addons.too_many"])
      expect([grows.status, grows.data.message]).toEqual([400, "addon_templates.too_many"])
      expect([linkOver.status, linkOver.data.message]).toEqual([400, "addons.too_many"])
      expect((await catalog(p.productId)).addons).toHaveLength(3)
    })

    it("gives an attribute template's products its carried templates", async () => {
      await flag(true)
      const template = await createTemplate()
      const attributes = await staff("/admin/attribute-templates", {
        name: "Bıçak",
        handle: `bicak-${String((made += 1))}`,
        definitions: [],
      })
      const attributeId = (attributes.data["attribute_template"] as { id: string }).id
      const p = await product()
      await staff(`/admin/products/${p.productId}/attributes`, { template_id: attributeId })
      const carried = await staff(`/admin/attribute-templates/${attributeId}/addon-templates`, {
        addon_template_ids: [template.id],
      })
      const unknown = await staff(`/admin/attribute-templates/${attributeId}/addon-templates`, {
        addon_template_ids: ["adtpl_yok"],
      })
      const shown = await storeAddons(p.productId)
      const card = await catalog(p.productId)
      const listed = await read<{ addon_templates: Template[] }>("/admin/addon-templates")
      await settle(http.delete(`/admin/addon-templates/${template.id}`, { headers: admin.headers }))
      const afterDelete = await storeAddons(p.productId)
      const attributeAfter = await read<{ attribute_template: { addon_template_ids: unknown } }>(
        `/admin/attribute-templates/${attributeId}`
      )

      expect(carried.status).toBe(200)
      expect(unknown.status).toBe(404)
      expect(shown.data.addons.map((addon) => addon.id)).toEqual([template.addons[0]?.id])
      expect(card.addon_templates).toEqual([
        expect.objectContaining({ id: template.id, via: "attribute_template" }) as unknown,
      ])
      expect(listed.data.addon_templates[0]?.attribute_templates).toEqual([
        { id: attributeId, name: "Bıçak" },
      ])
      expect(afterDelete.data.addons).toEqual([])
      expect(attributeAfter.data.attribute_template.addon_template_ids).toBeNull()
    })

    it("links in bulk and skips a product it would take past five", async () => {
      await flag(true)
      const template = await createTemplate()
      const a = await product()
      const full = await product()
      await staff(`/admin/products/${full.productId}/catalog`, {
        addons: Array.from({ length: 5 }, (_, index) => ({
          ...OWN,
          label: `Kılıf ${String(index)}`,
        })),
      })
      const job = await staff("/admin/async-jobs", {
        type: "catalog.bulk_edit",
        input: {
          product_ids: [a.productId, full.productId],
          change: { action: "addon_template", mode: "add", template_id: template.id },
        },
      })
      const done = await sheets.settled((job.data["async_job"] as SheetJob).id)
      const shownA = await storeAddons(a.productId)
      const shownFull = await storeAddons(full.productId)

      expect(job.status).toBe(202)
      expect(done.result_summary).toMatchObject({ changed: 1, skipped: 1, failed: 0 })
      expect(shownA.data.addons.map((addon) => addon.id)).toEqual([template.addons[0]?.id])
      expect(shownFull.data.addons).toHaveLength(5)
    })

    it("prices a template add-on on the server; an order keeps it after the template changes or goes", async () => {
      await flag(true)
      const template = await createTemplate()
      const p = await product(1000)
      await link(p.productId, [template.id])
      const cartId = await readyCart(getContainer(), shop, p.variantId, undefined, 1)
      const lineId = (await cartLine(getContainer(), cartId)).id
      const priced = await post(`/store/carts/${cartId}/line-items/${lineId}/addons`, {
        selections: [{ addon_id: template.addons[0]?.id, value: "Ahmet" }],
        unit_price: 1,
      })
      const picked = await post(`/store/carts/${cartId}/line-items/${lineId}/addons`, {
        selections: [{ addon_id: template.addons[0]?.id, value: "Ahmet" }],
      })
      const line = await cartLine(getContainer(), cartId)
      // The template's price changes before payment: the cart is repriced, as for own add-ons
      await staff(`/admin/addon-templates/${template.id}`, {
        addons: [{ ...ENGRAVING, id: template.addons[0]?.id, price: 160 }],
      })
      const stale = await post(`/store/carts/${cartId}/payment-session`, {
        provider_id: BANK_TRANSFER,
      })
      const started = await post(`/store/carts/${cartId}/payment-session`, {
        provider_id: BANK_TRANSFER,
      })
      const placed = await post(`/store/carts/${cartId}/complete`, {})
      const orderId = (placed.data["order"] as { id: string } | undefined)?.id ?? ""
      await staff(`/admin/addon-templates/${template.id}`, {
        addons: [{ ...ENGRAVING, id: template.addons[0]?.id, price: 999, label: "Başka" }],
      })
      await settle(http.delete(`/admin/addon-templates/${template.id}`, { headers: admin.headers }))
      const [sold] = await orderLines(getContainer(), orderId)

      expect(priced.status).toBe(400)
      expect(picked.status).toBe(200)
      expect(line).toMatchObject({ unit_price: 1150, is_custom_price: true })
      expect([stale.status, stale.data.message]).toEqual([409, "cart.prices_changed"])
      expect(started.status).toBe(200)
      expect(placed.status).toBe(200)
      expect((sold?.metadata as Record<string, unknown>)["qt_addons"]).toMatchObject({
        base: 1000,
        non_withdrawable: true,
        items: [
          expect.objectContaining({
            addon_id: template.addons[0]?.id,
            label: "Bıçağa isim kazıma",
            amount: 160,
          }),
        ],
      })
    })

    it("stops a cart whose template add-on was unlinked", async () => {
      await flag(true)
      const template = await createTemplate()
      const p = await product(1000)
      await link(p.productId, [template.id])
      const cartId = await readyCart(getContainer(), shop, p.variantId, undefined, 1)
      const lineId = (await cartLine(getContainer(), cartId)).id
      await post(`/store/carts/${cartId}/line-items/${lineId}/addons`, {
        selections: [{ addon_id: template.addons[0]?.id, value: "Ahmet" }],
      })
      await link(p.productId, [])
      const stopped = await post(`/store/carts/${cartId}/payment-session`, {
        provider_id: BANK_TRANSFER,
      })

      expect([stopped.status, stopped.data.message]).toEqual([400, "addons.unavailable"])
    })

    it("refuses an add-on id the template never had; new ones get the server's", async () => {
      await flag(true)
      const template = await createTemplate()
      const foreign = await staff(`/admin/addon-templates/${template.id}`, {
        addons: [{ ...ENGRAVING, id: "ad_yabanci" }],
      })
      const onCreate = await staff("/admin/addon-templates", {
        name: "Kimlikli",
        addons: [{ ...ENGRAVING, id: "ad_kendi" }],
      })
      const added = await staff(`/admin/addon-templates/${template.id}`, {
        addons: [
          { ...ENGRAVING, id: template.addons[0]?.id },
          { ...ENGRAVING, label: "İkinci" },
        ],
      })
      const ids = (added.data["addon_template"] as Template).addons.map((each) => each.id)

      expect([foreign.status, foreign.data.message]).toEqual([400, "addon_templates.id_unknown"])
      expect([onCreate.status, onCreate.data.message]).toEqual([400, "addon_templates.id_unknown"])
      expect(added.status).toBe(200)
      expect(ids[0]).toBe(template.addons[0]?.id)
      expect(ids[1]).toMatch(/^ad_[0-9a-f]{12}$/)
    })

    it("leaves no link to a template deleted while it was being linked", async () => {
      await flag(true)
      const template = await createTemplate()
      const p = await product()
      const [linked, removed] = await Promise.all([
        link(p.productId, [template.id]),
        settle(
          http.delete<Answer>(`/admin/addon-templates/${template.id}`, { headers: admin.headers })
        ),
      ])
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: PRODUCT_ADDON_TEMPLATE_LINK,
          fields: ["product_id", "addon_template_id"],
          filters: { addon_template_id: template.id },
        })
      const shown = await storeAddons(p.productId)

      expect(removed.status).toBe(200)
      // The link went first (and the delete dismissed it), found the template gone, or
      // met the delete's lock: the platform's "busy, try again" answer (503 errors.busy)
      expect([200, 404, 503]).toContain(linked.status)
      if (linked.status === 503) {
        expect(linked.data.message).toBe("errors.busy")
      }
      expect(data).toEqual([])
      expect(shown.data.addons).toEqual([])
    })

    it("refuses a bulk link at once while add-ons are off", async () => {
      await flag(true)
      const template = await createTemplate()
      const p = await product()
      await flag(false)
      const job = await staff("/admin/async-jobs", {
        type: "catalog.bulk_edit",
        input: {
          product_ids: [p.productId],
          change: { action: "addon_template", mode: "add", template_id: template.id },
        },
      })
      const done = await sheets.settled((job.data["async_job"] as SheetJob).id)

      expect(done.status).toBe("failed")
      expect(done.error_code).toBe("catalog.addons_disabled")
    })

    it("keeps templates the owner's and admin's: operations staff are refused", async () => {
      await flag(true)
      const template = await createTemplate()
      const p = await product()
      const ops = await createAdminUser(http, getContainer(), "operations")
      const create = await staff(
        "/admin/addon-templates",
        { name: "X", addons: [ENGRAVING] },
        ops.headers
      )
      const update = await staff(
        `/admin/addon-templates/${template.id}`,
        { name: "Y" },
        ops.headers
      )
      const linked = await staff(
        `/admin/products/${p.productId}/addon-templates`,
        { template_ids: [template.id] },
        ops.headers
      )
      const removed = await settle(
        http.delete(`/admin/addon-templates/${template.id}`, { headers: ops.headers })
      )

      expect(create.status).toBe(403)
      expect(update.status).toBe(403)
      expect(linked.status).toBe(403)
      expect(removed.status).toBe(403)
    })
  },
})
