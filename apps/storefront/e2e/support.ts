import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"

/** Errors the page logs, apart from a browser extension's or a dev server's own noise. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error" && !/hydrat|Download the React DevTools/i.test(message.text())) {
      errors.push(message.text())
    }
  })
  page.on("pageerror", (error) => {
    errors.push(error.message)
  })
  return errors
}

/** The cookie banner at the foot of every page (it stays in the page, closed, once answered). */
export const cookieBanner = (page: Page) => page.locator('section[aria-labelledby="cerez-baslik"]')

/** Answers the cookie banner so it does not cover what a test clicks. */
export async function dismissCookies(page: Page): Promise<void> {
  const button = cookieBanner(page).locator('button[name="choice"][value="necessary"]')
  if (await button.isVisible()) {
    await button.click()
    await page.waitForLoadState("networkidle")
  }
}

/** Who checks out: the address step's contact fields. */
export interface Shopper {
  email: string
  first_name: string
  last_name: string
  phone: string
}

/**
 * Checkout's address and shipping steps, as the bank transfer test fills
 * them (the first address the shop's address data offers), on to payment.
 */
export async function addressAndShipping(page: Page, shopper: Shopper): Promise<void> {
  await page.fill("#email", shopper.email)
  await page.fill("#first_name", shopper.first_name)
  await page.fill("#last_name", shopper.last_name)
  await page.fill("#phone", shopper.phone)
  await page.selectOption("#province", { index: 1 })
  await expect(page.locator("#district option")).not.toHaveCount(1)
  await page.selectOption("#district", { index: 1 })
  await expect(page.locator("#neighborhood option")).not.toHaveCount(1)
  await page.selectOption("#neighborhood", { index: 1 })
  await page.fill("#address_1", "Deneme Sokak No: 1")
  await page.locator("main form button[type=submit]").click()
  await expect(page).toHaveURL(/adim=kargo/)
  await page.locator("main form button[type=submit]").click()
  await expect(page).toHaveURL(/\/odeme$/)
}
