import type { ICartModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ADDONS_KEY } from "../../src/lib/catalog/addons"
import {
  planLineAddonsStep,
  resetLineStep,
  setLineAddonsWorkflow,
} from "../../src/workflows/addons/set-line"
import type { SetLineAddonsInput } from "../../src/workflows/addons/set-line"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { readyCart } from "../helpers/paytr"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

interface LineRow {
  id: string
  unit_price: unknown
  is_custom_price: boolean
  metadata: Record<string, unknown> | null
}

// Another key written on the line after the add-ons' reset, before the run fails
const writeNoteStep = createStep(
  "test-addon-undo-note",
  async (input: { line_id: string }, { container }) => {
    await container
      .resolve<ICartModuleService>(Modules.CART)
      .updateLineItems(input.line_id, { metadata: { note: "meanwhile" } })
    return new StepResponse(null)
  }
)

const failAfterStep = createStep("test-addon-undo-fail", () => {
  throw new Error("a later step failed")
})

const resetThenFailWorkflow = createWorkflow(
  "test-addon-line-undo",
  (input: SetLineAddonsInput) => {
    const plan = planLineAddonsStep(input)
    resetLineStep(plan)
    writeNoteStep({ line_id: input.line_id })
    failAfterStep()
    return new WorkflowResponse(plan)
  }
)

/**
 * adr/0052, fixed 2026-11-03: Medusa merges a line's metadata, so undoing
 * an add-on reset puts `qt_addons` back and leaves the line's other keys
 * as they are by then, not as they were before the reset.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop

    const flag = (enabled: boolean) =>
      settle(http.post("/admin/features/catalog.addons", { enabled }, { headers: admin.headers }))
    const lineOf = async (cartId: string): Promise<LineRow> => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({
          entity: "cart",
          fields: ["items.id", "items.unit_price", "items.is_custom_price", "items.metadata"],
          filters: { id: cartId },
        })
      const line = (data[0] as { items: LineRow[] }).items[0]
      if (!line) {
        throw new Error("the cart has no line")
      }
      return line
    }

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      admin = await createAdminUser(http, container)
      await flag(true)
    })
    // Flags live in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      await flag(false)
    })

    it("puts the line's add-ons and price back and keeps a key written meanwhile when a later step fails", async () => {
      const container = getContainer()
      const product = await stockedProduct(container, shop, "ek-geri-al", 10, 1000)
      const saved = await settle(
        http.post<{ addons?: { id: string }[] }>(
          `/admin/products/${product.productId}/catalog`,
          { addons: [{ kind: "text", label: "Ürün üzerine yazı", price: 35 }] },
          { headers: admin.headers }
        )
      )
      const addonId = saved.data.addons?.[0]?.id ?? ""
      const cartId = await readyCart(container, shop, product.variantId)
      const lineId = (await lineOf(cartId)).id
      const input = (selections: SetLineAddonsInput["selections"]): SetLineAddonsInput => ({
        cart_id: cartId,
        line_id: lineId,
        sales_channel_ids: [shop.salesChannelId],
        selections,
      })
      await setLineAddonsWorkflow(container).run({
        input: input([{ addon_id: addonId, value: "Ada" }]),
      })
      await container
        .resolve<ICartModuleService>(Modules.CART)
        .updateLineItems(lineId, { metadata: { note: "before" } })
      const before = await lineOf(cartId)

      const undone = await resetThenFailWorkflow(container).run({
        input: input([]),
        throwOnError: false,
      })
      const after = await lineOf(cartId)

      expect(saved.status).toBe(200)
      expect(before.metadata?.[ADDONS_KEY]).toMatchObject({ base: 1000 })
      expect(undone.errors.length).toBeGreaterThan(0)
      expect(after.metadata?.[ADDONS_KEY]).toEqual(before.metadata?.[ADDONS_KEY])
      expect(after.metadata?.["note"]).toBe("meanwhile")
      expect([Number(after.unit_price), after.is_custom_price]).toEqual([1035, true])
    })
  },
})
