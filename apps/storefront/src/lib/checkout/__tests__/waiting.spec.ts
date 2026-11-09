import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { WAIT_DELAYS, nextWaitingPath, resultViewOf, triesOf, waitDelay } from "../waiting"

/** adr/0026 Ek 2026-11-06: the card payment's waiting page never spins for ever. */
describe("the payment's waiting page", () => {
  it("waits about two minutes in all, with growing pauses", () => {
    const total = WAIT_DELAYS.reduce((sum, delay) => sum + delay, 0)
    expect(total).toBeGreaterThanOrEqual(110)
    expect(total).toBeLessThanOrEqual(130)
    expect([...WAIT_DELAYS]).toEqual([...WAIT_DELAYS].sort((a, b) => a - b))
    expect(waitDelay(0)).toBe(2)
    expect(waitDelay(99)).toBe(20)
    expect(waitDelay(-3)).toBe(2)
  })

  it("reads the count of looks from the address, digits only and never past the last", () => {
    expect(triesOf("3")).toBe(3)
    expect(triesOf("3<x>")).toBe(3)
    expect(triesOf("999")).toBe(WAIT_DELAYS.length)
    expect(triesOf(null)).toBe(0)
    expect(triesOf("")).toBe(0)
  })

  it("looks again while nothing is known, then says the order comes by e-mail", () => {
    const pending = { state: "pending" } as const
    expect(nextWaitingPath(pending, 0, null)).toBe("/odeme/durum?d=bekliyor&deneme=1")
    expect(nextWaitingPath(pending, WAIT_DELAYS.length - 1, null)).toBe(
      `/odeme/durum?d=bekliyor&deneme=${String(WAIT_DELAYS.length)}`
    )
    expect(nextWaitingPath(pending, WAIT_DELAYS.length, null)).toBe("/odeme/durum?d=gecikti")
    // iyzico's review: no use waiting
    expect(nextWaitingPath(pending, 0, "review")).toBe("/odeme/durum?d=gecikti")
  })

  it("says at once when the money is being given back", () => {
    expect(nextWaitingPath({ state: "refund" }, 0, null)).toBe("/odeme/durum?d=iade")
    expect(nextWaitingPath({ state: "pending" }, 3, "refund")).toBe("/odeme/durum?d=iade")
  })

  it("refreshes a pending page after its pause, toward the next look", () => {
    const first = resultViewOf("bekliyor", "1", t)
    const last = resultViewOf("bekliyor", String(WAIT_DELAYS.length), t)

    expect(first).toEqual({
      view: { state: "pending", retryPath: "/odeme/sonuc?deneme=1", backPath: "/" },
      refreshSeconds: 2,
    })
    expect(last.refreshSeconds).toBe(20)
    expect(last.view.retryPath).toBe(`/odeme/sonuc?deneme=${String(WAIT_DELAYS.length)}`)
  })

  it("ends a long wait with the payment taken, the order lookup and no spinner", () => {
    const { view, refreshSeconds } = resultViewOf("gecikti", null, t)

    expect(refreshSeconds).toBeNull()
    expect(view).toMatchObject({
      state: "late",
      retryPath: null,
      backPath: "/siparis",
      backLabel: "Siparişimi bul",
      help: { path: "/", label: t("not_found.home") },
    })
    expect(t("checkout.result_late")).toBe("Ödemeniz alındı, siparişiniz oluşturuluyor")
    // An address that names no state is a late one, never a page that spins
    expect(resultViewOf("<script>", null, t).view.state).toBe("late")
  })

  it("leads a refunded payment back to the cart, with the shop's contact page", () => {
    expect(resultViewOf("iade", null, t).view).toMatchObject({
      state: "refund",
      backPath: "/sepet",
      backLabel: "Sepete dön",
      help: { path: "/iletisim", label: "Bize yazın" },
    })
    expect(resultViewOf("hata", null, t).view).toEqual({
      state: "failed",
      retryPath: null,
      backPath: "/odeme",
    })
  })
})
