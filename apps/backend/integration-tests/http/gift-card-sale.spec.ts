import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import giftCardIssue from "../../src/subscribers/gift-card-issue"
import { issueOrderGiftCards, sweepGiftCards } from "../../src/workflows/gift-cards/issue-and-send"
import { eraseGiftRecipients } from "../../src/workflows/gift-cards/kvkk"
import { createAdminUser } from "../helpers/admin"
import { NO_TURNSTILE } from "../helpers/challenge"
import { eventually } from "../helpers/eventually"
import {
  BANK_TRANSFER,
  cardsOfLine,
  giftCardProduct,
  giftCart,
  orderLines,
} from "../helpers/gift-sale"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { stockShop, stockedProduct } from "../helpers/stock"
import type { StockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { loadTrAddressFixture } from "../helpers/tr-address"

jest.setTimeout(240 * 1000)

const RECIPIENT = "zeynep.kaya@example.com"
const CODE = /GIFT(?:-[2-9A-HJ-NP-Z]{4}){4}/gu

type Answer = { message?: string; type?: string } & Record<string, unknown>

/** adr/0025 Ek 2026-11-03: gift cards sold on the storefront, issued once paid. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail
    let admin: { headers: Record<string, string> }
    let store: Storefront
    let shop: StockShop

    const flag = (enabled: boolean) =>
      settle(
        http.post("/admin/features/promotions.gift_cards", { enabled }, { headers: admin.headers })
      )
    const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
      settle(http.post<Answer>(url, body, { headers: { ...store.headers, ...headers } }))
    const setGift = (cartId: string, lineId: string, body: unknown) =>
      post(`/store/carts/${cartId}/line-items/${lineId}/gift`, body)
    const startPayment = (cartId: string, providerId: string) =>
      post(`/store/carts/${cartId}/payment-session`, { provider_id: providerId })
    const balance = (code: string, headers: Record<string, string> = {}) =>
      post("/store/gift-cards/balance", { code }, headers)
    const adminCard = async (value: number) =>
      (
        await http.post<{ gift_card: { code: string } }>(
          "/admin/gift-cards",
          { currency_code: "try", value },
          { headers: admin.headers }
        )
      ).data.gift_card.code
    const mailsTo = (to: string) =>
      fake.messages.filter((mail) => mail.to.includes(to) && mail.template === "gift_card.issued")

    const relaxed = process.env["RATE_LIMIT_RELAXED"]
    beforeAll(async () => {
      fake = await startFakeMail()
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "mailpit",
        MAILPIT_URL: fake.url,
        EMAIL_FROM: "bildirim@platform.example",
      })
    })
    afterAll(async () => {
      for (const name of ["EMAIL_TRANSPORT", "MAILPIT_URL", "EMAIL_FROM"]) {
        Reflect.deleteProperty(process.env, name)
      }
      await fake.close()
    })
    beforeEach(async () => {
      const container = getContainer()
      await loadTrAddressFixture(container)
      shop = await stockShop(container)
      store = await createStorefront(container)
      admin = await createAdminUser(http, container)
      fake.messages.length = 0
      await http.post(
        "/admin/platform-settings/bank_transfer",
        {
          enabled: true,
          account_holder: "Örnek Ticaret A.Ş.",
          bank_name: "Örnek Bankası",
          iban: "TR330006100519786457841326",
          deadline_hours: 24,
        },
        { headers: admin.headers }
      )
    })
    // The flag lives in settings, whose cache outlives the database reset between tests
    afterEach(async () => {
      if (relaxed === undefined) {
        delete process.env["RATE_LIMIT_RELAXED"]
      } else {
        process.env["RATE_LIMIT_RELAXED"] = relaxed
      }
      await flag(false)
    })

    it("marks a gift card product behind the flag, as digital, and shows the mark alone to the storefront", async () => {
      const refused = await giftCardProduct(http, admin.headers, shop)
      await flag(true)
      const { productId, marked } = await giftCardProduct(http, admin.headers, shop)
      const catalog = await settle(
        http.get<Record<string, unknown>>(`/admin/products/${productId}/catalog`, {
          headers: admin.headers,
        })
      )
      const physical = await settle(
        http.post(
          `/admin/products/${productId}/catalog`,
          { kind: "physical" },
          { headers: admin.headers }
        )
      )
      const core = await settle(
        http.post(`/admin/products/${productId}`, { is_giftcard: true }, { headers: admin.headers })
      )
      const shown = await settle(
        http.get<{ product: { product_extension: unknown } }>(
          `/store/products/${productId}?fields=id,product_extension.is_gift_card`,
          { headers: store.headers }
        )
      )
      const more = await settle(
        http.get(`/store/products/${productId}?fields=product_extension.*`, {
          headers: store.headers,
        })
      )

      expect(refused.marked).toBe(400)
      expect(marked).toBe(200)
      expect(catalog.data).toMatchObject({ is_gift_card: true, kind: "digital" })
      expect(physical.data).toMatchObject({ message: "catalog.gift_card_kind" })
      expect(core.data).toMatchObject({ message: "catalog.core_gift_card" })
      // The mark and the row's id Medusa adds: none of the shop's other columns
      expect(shown.data.product.product_extension).toEqual({
        id: expect.any(String) as unknown,
        is_gift_card: true,
      })
      expect(more.status).toBe(400)
    })

    it("takes a recipient on a gift line only, and holds the payment until each line has one", async () => {
      await flag(true)
      const { variants } = await giftCardProduct(http, admin.headers, shop)
      const { cartId, lineOf } = await giftCart(getContainer(), shop, [
        { variant_id: variants["500"], quantity: 1 },
      ])
      const line = lineOf(variants["500"])
      const cup = await stockedProduct(getContainer(), shop, "kupa-hediye", 5, 120)
      const { cartId: other, lineOf: otherLine } = await giftCart(getContainer(), shop, [
        { variant_id: cup.variantId, quantity: 1 },
      ])

      const notGift = await setGift(other, otherLine(cup.variantId), { recipient_email: RECIPIENT })
      const badEmail = await setGift(cartId, line, { recipient_email: "zeynep" })
      const link = await setGift(cartId, line, {
        recipient_email: RECIPIENT,
        message: "bkz. https://kotu.example",
      })
      const waiting = await startPayment(cartId, BANK_TRANSFER)
      const saved = await setGift(cartId, line, {
        recipient_email: " Zeynep.Kaya@Example.com ",
        recipient_name: "Zeynep",
        message: "İyi ki doğdun!",
        sender_name: "Ayşe",
      })
      const listed = await settle(
        http.get<{ gift_lines: unknown[] }>(`/store/carts/${cartId}/gift-lines`, {
          headers: store.headers,
        })
      )
      const started = await startPayment(cartId, BANK_TRANSFER)
      await flag(false)
      const hidden = await setGift(cartId, line, { recipient_email: RECIPIENT })

      expect([notGift.status, notGift.data.message]).toEqual([400, "gift_card.not_gift_line"])
      expect([badEmail.status, badEmail.data.message]).toEqual([
        400,
        "gift_card.recipient_email_invalid",
      ])
      expect(link.data.message).toBe("gift_card.text_link")
      expect([waiting.status, waiting.data.message]).toEqual([400, "gift_card.recipient_required"])
      expect(saved.status).toBe(200)
      expect(listed.data.gift_lines).toEqual([
        {
          line_id: line,
          product_id: expect.any(String) as unknown,
          variant_id: variants["500"],
          recipient: {
            recipient_email: RECIPIENT,
            recipient_name: "Zeynep",
            message: "İyi ki doğdun!",
            sender_name: "Ayşe",
          },
        },
      ])
      expect(started.status).toBe(200)
      expect(hidden.status).toBe(404)
    })

    it("issues one card per unit once the transfer is confirmed, never twice, and mails the recipient", async () => {
      await flag(true)
      const container = getContainer()
      const { variants } = await giftCardProduct(http, admin.headers, shop)
      const { cartId, lineOf } = await giftCart(container, shop, [
        { variant_id: variants["500"], quantity: 2 },
      ])
      await setGift(cartId, lineOf(variants["500"]), {
        recipient_email: RECIPIENT,
        sender_name: "Ayşe",
        message: "Mutlu yıllar",
      })
      await startPayment(cartId, BANK_TRANSFER)
      const placed = await post(`/store/carts/${cartId}/complete`, {})
      const orderId = (placed.data["order"] as { id: string }).id
      const [line] = await orderLines(container, orderId)
      const lineId = line?.id ?? ""
      // Placed but not paid: nothing yet, however often it is asked
      await issueOrderGiftCards(container, orderId)
      const beforePaid = await cardsOfLine(container, lineId)

      await http.post(
        `/admin/orders/${orderId}/bank-transfer/confirm`,
        {},
        { headers: admin.headers }
      )
      const mails = await eventually(
        () => Promise.resolve(mailsTo(RECIPIENT)),
        (found) => found.length > 0,
        100
      )
      // The capture's event twice at once, and the sweep's way once more
      const event = { name: "payment.captured", data: { id: "" } }
      const { data: paid } = await http.get<{
        order: { payment_collections: { payments: { id: string }[] }[] }
      }>(`/admin/orders/${orderId}?fields=payment_collections.payments.id`, {
        headers: admin.headers,
      })
      event.data.id = paid.order.payment_collections[0]?.payments[0]?.id ?? ""
      const args = { event, container, pluginOptions: {} } as unknown as Parameters<
        typeof giftCardIssue
      >[0]
      await Promise.all([giftCardIssue(args), giftCardIssue(args)])
      const swept = await sweepGiftCards(container, new Date())
      const cards = await cardsOfLine(container, lineId)
      const [recorded] = await orderLines(container, orderId)
      const codes = mails[0]?.text.match(CODE) ?? []
      const checked = await balance(codes[0]?.toLowerCase() ?? "")
      // KVKK erasure of the buyer's orders: the recipient goes, the cards stay
      await eraseGiftRecipients(container, [orderId])
      const [erased] = await orderLines(container, orderId)

      expect(beforePaid).toHaveLength(0)
      expect(swept).toEqual({ orders: 1, issued: 0, failed: 0 })
      expect(cards).toHaveLength(2)
      expect(cards.map((card) => [card.value, card.reference_id])).toEqual([
        [500, orderId],
        [500, orderId],
      ])
      expect(new Set(cards.map((card) => card.code)).size).toBe(2)
      expect((recorded?.metadata as Record<string, unknown>)["qt_gift_cards"]).toEqual(
        expect.arrayContaining(cards.map((card) => ({ id: card.id, last4: card.code.slice(-4) })))
      )
      expect(JSON.stringify(recorded?.metadata)).not.toContain(cards[0]?.code)
      expect(mailsTo(RECIPIENT)).toHaveLength(1)
      expect(mails[0]?.subject).toContain("Ayşe")
      expect([...codes].sort()).toEqual(cards.map((card) => card.code).sort())
      expect(checked.data).toEqual({ balance: 500, currency_code: "try", expires_at: null })
      expect(erased?.metadata).toMatchObject({
        qt_gift: { erased: true },
        qt_gift_cards: (recorded?.metadata as Record<string, unknown>)["qt_gift_cards"],
      })
      expect(JSON.stringify(erased?.metadata)).not.toContain(RECIPIENT)
      expect(JSON.stringify(erased?.metadata)).not.toContain("Mutlu")
    })

    it("never takes gift cards or store credit for a gift card", async () => {
      await flag(true)
      const container = getContainer()
      const { variants } = await giftCardProduct(http, admin.headers, shop)
      const ready = async (code: string) => {
        const { cartId, lineOf } = await giftCart(container, shop, [
          { variant_id: variants["250"], quantity: 1 },
        ])
        await setGift(cartId, lineOf(variants["250"]), { recipient_email: RECIPIENT })
        const added = await post(`/store/carts/${cartId}/gift-cards`, { code })
        expect(added.status).toBe(200)
        return cartId
      }
      const whole = await ready(await adminCard(1000))
      const part = await ready(await adminCard(100))

      const credit = await startPayment(whole, "credit")
      const transfer = await startPayment(part, BANK_TRANSFER)

      expect([credit.status, credit.data.message]).toEqual([
        400,
        "gift_card.not_payable_with_credit",
      ])
      expect([transfer.status, transfer.data.message]).toEqual([
        400,
        "gift_card.not_payable_with_credit",
      ])
    })

    it("answers a balance by code, 404 for an unknown one or while cards are off, and asks Turnstile past three tries", async () => {
      await flag(true)
      const code = await adminCard(250)

      const found = await balance(code)
      const unknown = await balance("GIFT-AAAA-BBBB-CCCC-DDDD")
      process.env["RATE_LIMIT_RELAXED"] = "0"
      // Past three asks from this address (this file's earlier ones count too), Turnstile first
      const asks = [await balance(code, NO_TURNSTILE)]
      while (asks.length < 4 && asks.at(-1)?.status !== 428) {
        asks.push(await balance(code, NO_TURNSTILE))
      }
      const proven = asks.at(-1)
      // The token a test site key's widget gives opens it
      const withToken = await balance(code)
      await flag(false)
      const off = await balance(code)

      expect(found.data).toEqual({ balance: 250, currency_code: "try", expires_at: null })
      expect([unknown.status, unknown.data.message]).toEqual([404, "gift_card.unknown"])
      expect(asks.slice(0, -1).every((ask) => ask.status === 200)).toBe(true)
      expect([proven?.status, proven?.data.message]).toEqual([428, "fraud.turnstile_required"])
      expect(proven?.data).toMatchObject({ turnstile: { action: "gift_card" } })
      expect(withToken.status).toBe(200)
      expect(off.status).toBe(404)
      expect(off.data).not.toHaveProperty("balance")
    })
  },
})
