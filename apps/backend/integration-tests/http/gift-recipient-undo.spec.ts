import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { WorkflowResponse, createStep, createWorkflow } from "@medusajs/framework/workflows-sdk"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { GIFT_RECIPIENT_KEY } from "../../src/lib/promotions/gift-sale"
import type { GiftRecipient } from "../../src/lib/promotions/gift-sale"
import {
  setGiftRecipientStep,
  setGiftRecipientWorkflow,
} from "../../src/workflows/gift-cards/cart-gifts"
import type { SetGiftRecipientInput } from "../../src/workflows/gift-cards/cart-gifts"
import { createAdminUser } from "../helpers/admin"
import { giftCardProduct, giftCart } from "../helpers/gift-sale"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(180 * 1000)

const gift = (email: string): GiftRecipient => ({
  recipient_email: email,
  recipient_name: null,
  message: null,
  sender_name: null,
})

// A step after the recipient's that fails: the run takes the recipient back
const failAfterStep = createStep("test-gift-undo-fail", () => {
  throw new Error("a later step failed")
})

const setThenFailWorkflow = createWorkflow(
  "test-gift-recipient-undo",
  (input: SetGiftRecipientInput) => {
    const result = setGiftRecipientStep(input)
    failAfterStep()
    return new WorkflowResponse(result)
  }
)

/**
 * adr/0025 Ek 2026-11-03, fixed 2026-11-03: Medusa merges a line's metadata,
 * so undoing a recipient must take the new key out (or put the old value
 * back), not write the earlier metadata over it.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let shop: StockShop

    const flag = (enabled: boolean) =>
      settle(
        http.post("/admin/features/promotions.gift_cards", { enabled }, { headers: admin.headers })
      )
    const metadataOf = async (cartId: string, lineId: string) => {
      const { data } = await getContainer()
        .resolve(ContainerRegistrationKeys.QUERY)
        .graph({ entity: "cart", fields: ["items.id", "items.metadata"], filters: { id: cartId } })
      const items = (
        data[0] as { items: { id: string; metadata: Record<string, unknown> | null }[] }
      ).items
      return items.find((item) => item.id === lineId)?.metadata ?? null
    }

    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      admin = await createAdminUser(http, container)
      await flag(true)
    })
    afterEach(async () => {
      await flag(false)
    })

    it("takes a fresh recipient out of the line, and puts an earlier one back, when a later step fails", async () => {
      const { variants } = await giftCardProduct(http, admin.headers, shop)
      const { cartId, lineOf } = await giftCart(getContainer(), shop, [
        { variant_id: variants["250"], quantity: 1 },
        { variant_id: variants["500"], quantity: 1 },
      ])
      const bare = lineOf(variants["250"])
      const named = lineOf(variants["500"])
      const input = (lineId: string, email: string): SetGiftRecipientInput => ({
        cart_id: cartId,
        line_id: lineId,
        sales_channel_ids: [shop.salesChannelId],
        gift: gift(email),
      })
      const run = (lineId: string, email: string) =>
        setThenFailWorkflow(getContainer()).run({
          input: input(lineId, email),
          throwOnError: false,
        })

      // A line with no recipient yet: undone, it has none again
      const first = await run(bare, "zeynep.kaya@example.com")
      // A line with a recipient: undone, that recipient is back, exactly
      await setGiftRecipientWorkflow(getContainer()).run({
        input: input(named, "ayse.yilmaz@example.com"),
      })
      const second = await run(named, "mehmet.demir@example.com")

      expect(first.errors.length).toBeGreaterThan(0)
      expect(second.errors.length).toBeGreaterThan(0)
      expect(await metadataOf(cartId, bare)).not.toHaveProperty(GIFT_RECIPIENT_KEY)
      expect((await metadataOf(cartId, named))?.[GIFT_RECIPIENT_KEY]).toEqual(
        gift("ayse.yilmaz@example.com")
      )
    })
  },
})
