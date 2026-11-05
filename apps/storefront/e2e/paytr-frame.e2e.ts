import { expect, test } from "@playwright/test"
import type { Frame, Page } from "@playwright/test"
import { purchasePath, stockedProduct } from "./catalog"
import {
  PAYTR_CARDS,
  PAYTR_FRAME,
  ensureFakePaytr,
  payWithTestCard,
  startCardPayment,
} from "./paytr"
import { addressAndShipping, addToCart, dismissCookies } from "./support"

/** From a product to the framed card form (`/odeme/kart`), as a guest. */
async function toCardForm(page: Page): Promise<void> {
  await ensureFakePaytr()
  await page.goto(purchasePath(await stockedProduct()))
  await dismissCookies(page)
  await addToCart(page)
  await page.getByRole("dialog").getByRole("link", { name: "Ödemeye geç" }).click()
  await expect(page).toHaveURL(/\/odeme/)
  await addressAndShipping(page, {
    email: `e2e-${String(Date.now())}@quantdijital.com`,
    first_name: "Uçtan",
    last_name: "Uca",
    phone: "05321234567",
  })
  await startCardPayment(page)
}

/**
 * A card the bank refuses, in the local PayTR's frame (`pnpm dev:paytr`,
 * its README's refused card): the form takes it, the bank's 3-D Secure
 * page asks its code, and the bank's no brings the shopper to the
 * storefront's failure page (`/odeme/sonuc/hata` → `/odeme/durum?d=hata`)
 * with the cart kept to try again. No order is made. A paid card is the
 * payment link test's (`payment-link-flow.e2e.ts`).
 */
test("a refused card ends on the failure page, the cart kept", async ({ page }) => {
  // Connecting PayTR, if the shop has none, takes a temporary owner (Medusa's CLI, seconds each)
  test.setTimeout(120_000)
  await toCardForm(page)
  await payWithTestCard(page, { number: PAYTR_CARDS.refused })

  await expect(page).toHaveURL(/\/odeme\/durum\?d=hata$/, { timeout: 30_000 })
  await expect(page.locator("h1")).toHaveText("Ödeme alınamadı")
  await expect(
    page.getByText(
      "Kartınızdan ücret alınmadı. Sepetiniz duruyor; tekrar deneyebilir ya da başka bir yöntem seçebilirsiniz."
    )
  ).toBeVisible()
  await expect(page.getByRole("link", { name: "Ödeme adımına dön" })).toHaveAttribute(
    "href",
    "/odeme"
  )
  // The cart is still there, its line to pay for again
  await page.goto("/sepet")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sepetim")
  await expect(page.getByRole("button", { name: /ürününü sepetten kaldır$/ })).toHaveCount(1)
})

/** The frame's own height against its page's: the body, margins included, as PayTR measures it. */
async function fitOf(page: Page, frame: Frame) {
  const box = await page.locator(PAYTR_FRAME).boundingBox()
  const inner = await frame.evaluate(() => {
    const style = getComputedStyle(document.body)
    const body =
      document.body.offsetHeight + parseFloat(style.marginTop) + parseFloat(style.marginBottom)
    return { body: Math.ceil(body), view: window.innerHeight }
  })
  return { frame: Math.round(box?.height ?? 0), ...inner }
}

/**
 * The card form takes its page's height (PayTR's iframe-resizer messages,
 * docs/entegrasyonlar/paytr.md): on a phone the page scrolls, not a box
 * inside it, and on a desktop no empty space stands under the form. The
 * frame follows the form as it changes (the card's installments) and as
 * the window's width does.
 */
test("the card form fits its frame at phone, tablet and desktop widths", async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1280, height: 900 })
  await toCardForm(page)
  const frame = await (await page.locator(PAYTR_FRAME).elementHandle()).contentFrame()
  if (!frame) {
    throw new Error("the card form's frame has no page")
  }
  await expect(page.frameLocator(PAYTR_FRAME).getByLabel("Kart numarası")).toBeVisible()

  const fits = async (label: string) => {
    await expect
      .poll(
        async () => {
          const fit = await fitOf(page, frame)
          return Math.abs(fit.view - fit.body) <= 2 && fit.frame === fit.view
        },
        { message: `${label}: the frame is as tall as its page`, timeout: 10_000 }
      )
      .toBe(true)
    return fitOf(page, frame)
  }

  const desktop = await fits("1280")
  await page.setViewportSize({ width: 768, height: 1024 })
  await fits("768")
  await page.setViewportSize({ width: 390, height: 844 })
  const phone = await fits("390")
  // A narrower form is a taller one
  expect(phone.body).toBeGreaterThan(desktop.body)
  // The card's program decides the installments listed (a card in none pays at once): the
  // form changes its height, whether it came empty or with PayTR's test card, and the frame too
  await page.frameLocator(PAYTR_FRAME).getByLabel("Kart numarası").fill(PAYTR_CARDS.refused)
  const changed = await fits("390, another card")
  expect(changed.body).not.toBe(phone.body)
})
