import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { balanceOf } from "../../src/lib/ai-credits/balance"
import {
  adjust,
  cancelOrder,
  grantPurchase,
  markOrderPaid,
  requestOrder,
} from "../../src/lib/ai-credits/grant"
import { aiCreditsIn } from "../../src/workflows/modules"
import {
  adjustKey,
  entriesOf,
  expectLedgerMatchesWallet,
  istanbul,
  setMonthlyGrant,
  shopId,
  walletOf,
} from "../helpers/ai-credits"

jest.setTimeout(240 * 1000)

const PACK = {
  id: "kredi-500",
  name: "500 kredi",
  credits: 500,
  amount: 75_000,
  currency: "TRY" as const,
}

// Written by code point: a control character
const BELL = String.fromCharCode(0x07)

/**
 * What the credits take from their callers, on the real database (PR #368
 * review D1–D3 and the shop's scope on requests): a refused input writes
 * nothing, a reference names one move, a correction's key corrects once.
 */
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    const c = () => getContainer()
    const NOW = istanbul("2026-11-10", "12:00")
    const buy = (tenantId: string, credits: number, grantRef: string) =>
      grantPurchase(c(), { tenantId, credits, grantRef, actor: "usr_test", now: NOW })

    it("D1: a top-up's reference is its own, never the platform's, and names one top-up", async () => {
      const tenantId = shopId()
      for (const reserved of [`plan:${tenantId}:2026-12`, "adjust:x", "order:aiord_1", "Order:x"]) {
        await expect(buy(tenantId, 5, reserved)).rejects.toThrow("cp.ai_credit_grant_ref_reserved")
      }
      await expect(buy(tenantId, 5, "eft 42")).rejects.toThrow("cp.ai_credit_grant_ref_invalid")
      expect(await entriesOf(c(), tenantId)).toEqual([])

      expect((await buy(tenantId, 5, "EFT-42")).applied).toBe(true)
      expect((await buy(tenantId, 5, "EFT-42")).applied).toBe(false)
      // The same reference for another amount or another shop is not this top-up
      await expect(buy(tenantId, 6, "EFT-42")).rejects.toThrow("cp.ai_credit_grant_ref_conflict")
      const other = shopId()
      await expect(buy(other, 5, "EFT-42")).rejects.toThrow("cp.ai_credit_grant_ref_conflict")
      expect(await entriesOf(c(), other)).toEqual([])
      expect((await walletOf(c(), tenantId))?.purchased_balance).toBe(5)
      await expectLedgerMatchesWallet(c(), tenantId)
    })

    it("D2: text with a control character or too long is refused whole, and nothing is written", async () => {
      const tenantId = shopId()
      await buy(tenantId, 10, "eft-10")
      const correction = {
        tenantId,
        amount: -1,
        bucket: "purchased" as const,
        actor: "usr_staff",
        now: NOW,
      }
      await expect(
        adjust(c(), { ...correction, key: adjustKey(), note: `hata${BELL}` })
      ).rejects.toThrow("cp.ai_credit_note_invalid")
      await expect(
        adjust(c(), { ...correction, key: adjustKey(), note: "x".repeat(501) })
      ).rejects.toThrow("cp.ai_credit_note_invalid")
      await expect(
        adjust(c(), { ...correction, key: adjustKey(), note: "not", actor: "u".repeat(129) })
      ).rejects.toThrow("cp.ai_credit_actor_invalid")
      await expect(adjust(c(), { ...correction, key: "not-a-uuid", note: "not" })).rejects.toThrow(
        "cp.ai_credit_key_invalid"
      )
      await expect(
        requestOrder(c(), { tenantId, pack: PACK, requestedBy: `usr${BELL}`, now: NOW })
      ).rejects.toThrow("cp.ai_credit_requested_by_invalid")

      const order = await requestOrder(c(), { tenantId, pack: PACK, requestedBy: null, now: NOW })
      await expect(
        markOrderPaid(c(), {
          orderId: order.id,
          actor: "usr_finance",
          method: "bank_transfer",
          reference: "r".repeat(257),
          now: NOW,
        })
      ).rejects.toThrow("cp.ai_credit_reference_invalid")
      expect((await aiCreditsIn(c()).orderOf(tenantId, order.id)).status).toBe("pending")
      expect((await entriesOf(c(), tenantId)).map((each) => each.kind)).toEqual(["grant_purchase"])
      expect((await walletOf(c(), tenantId))?.purchased_balance).toBe(10)
    })

    it("D3: one move is at most 1,000,000 credits; a month's grant at most GRANT_LIMIT_MAX", async () => {
      const tenantId = shopId()
      await expect(buy(tenantId, 1_000_001, "eft-big")).rejects.toThrow(
        "cp.ai_credit_amount_invalid"
      )
      await expect(
        requestOrder(c(), {
          tenantId,
          pack: { ...PACK, credits: 1_000_001 },
          requestedBy: null,
          now: NOW,
        })
      ).rejects.toThrow("cp.ai_credit_amount_invalid")
      expect((await buy(tenantId, 1_000_000, "eft-max")).balance).toBe(1_000_000)
      await expect(
        adjust(c(), {
          tenantId,
          key: adjustKey(),
          amount: -1_000_001,
          bucket: "purchased",
          note: "fazla",
          actor: "usr_staff",
          now: NOW,
        })
      ).rejects.toThrow("cp.ai_credit_amount_invalid")

      // A stored grant past the ceiling (written before it, or by hand) fills at most the ceiling
      const granted = shopId()
      await setMonthlyGrant(c(), granted, 150_000)
      expect((await balanceOf(c(), granted, NOW)).plan.balance).toBe(100_000)
      await expectLedgerMatchesWallet(c(), granted)
    })

    it("O2: a correction's key corrects once; sent again it answers applied: false with the first row", async () => {
      const tenantId = shopId()
      await buy(tenantId, 10, "eft-10")
      const input = {
        tenantId,
        key: adjustKey(),
        amount: 4,
        bucket: "purchased" as const,
        note: "telafi",
        actor: "usr_staff",
        now: NOW,
      }
      const first = await adjust(c(), input)
      expect(first).toMatchObject({ applied: true, balance: 14 })
      expect(await adjust(c(), input)).toEqual({
        applied: false,
        entryId: first.entryId,
        balance: 14,
      })
      // The same key for another amount is not this correction
      await expect(adjust(c(), { ...input, amount: 5 })).rejects.toThrow(
        "cp.ai_credit_grant_ref_conflict"
      )
      expect((await entriesOf(c(), tenantId)).filter((each) => each.kind === "adjust")).toEqual([
        expect.objectContaining({ amount: 4, grant_ref: `adjust:${input.key}` }),
      ])
      await expectLedgerMatchesWallet(c(), tenantId)
    })

    it("a shop reads and cancels only its own request; the staff's paths name none", async () => {
      const tenantId = shopId()
      const other = shopId()
      const order = await requestOrder(c(), { tenantId, pack: PACK, requestedBy: null, now: NOW })
      const credits = aiCreditsIn(c())
      await expect(credits.orderOf(other, order.id)).rejects.toThrow("cp.ai_credit_order_not_found")
      await expect(
        cancelOrder(c(), { tenantId: other, orderId: order.id, actor: "usr_other", now: NOW })
      ).rejects.toThrow("cp.ai_credit_order_not_found")
      expect((await credits.orderAsStaff(order.id)).status).toBe("pending")
      expect(
        (await cancelOrder(c(), { tenantId, orderId: order.id, actor: "usr_owner", now: NOW }))
          .status
      ).toBe("cancelled")
    })
  },
})
