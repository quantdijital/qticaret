import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { createTemporaryAdmin, removeTemporaryAdmin, signInAdmin } from "./admin"
import type { AdminApi } from "./admin"
import { storeGet } from "./catalog"

/**
 * Paying by card in the local PayTR's frame (`pnpm dev:paytr`, adr/0028;
 * packages/testing/src/paytr/README.md). `/odeme/kart` frames PayTR's
 * card form; once it is sent, the card bank's 3-D Secure page opens in the
 * same frame, and its "Onayla" sends the whole window back to the shop.
 * The card's number decides the bank's answer.
 */

const PROVIDER = "pp_paytr_paytr"
/** The card form's frame on `/odeme/kart`. */
export const PAYTR_FRAME = 'iframe[title="Güvenli kart ödeme formu"]'

/**
 * Numbers the local PayTR answers by (its README's table, `cards.ts`
 * there). Written out here: the storefront does not depend on `@qticaret/testing`.
 */
export const PAYTR_CARDS = {
  /** PayTR's own test card (Axess, Visa): paid. */
  paid: "4355084355084358",
  /** A Visa in no program: the bank refuses it (`failed_reason_code` 0). */
  refused: "4129111111111111",
} as const

export interface TestCard {
  number: string
  owner: string
  /** AA/YY, ahead of today. */
  expiry: string
  cvv: string
}

const DEFAULT_CARD: TestCard = {
  number: PAYTR_CARDS.paid,
  owner: "Uçtan Uca",
  expiry: "12/30",
  cvv: "000",
}

/**
 * Fills the card form, sends it, and confirms on the bank's page with a
 * six-digit code (any passes). The shopper is then on their way back to
 * the shop: the order's page for a paid card, the failure page otherwise.
 */
export async function payWithTestCard(page: Page, card: Partial<TestCard> = {}): Promise<void> {
  const { number, owner, expiry, cvv } = { ...DEFAULT_CARD, ...card }
  const frame = page.frameLocator(PAYTR_FRAME)
  await frame.getByLabel("Kart üzerindeki ad soyad", { exact: true }).fill(owner)
  await frame.getByLabel("Kart numarası", { exact: true }).fill(number)
  await frame.getByLabel("Son kullanma tarihi", { exact: true }).fill(expiry)
  await frame.getByLabel("CVV", { exact: true }).fill(cvv)
  await frame.getByRole("button", { name: "Ödeme yap", exact: true }).click()
  // The form's own complaint (role=alert) would keep it here: the bank's page shows the card was taken
  await expect(frame.getByRole("heading", { name: "Ödeme doğrulama" })).toBeVisible()
  await frame.getByLabel("Doğrulama şifresi", { exact: true }).fill("123456")
  await frame.getByRole("button", { name: "Onayla", exact: true }).click()
}

/** On checkout's payment step: PayTR chosen, the terms accepted, on to the framed card form. */
export async function startCardPayment(page: Page): Promise<void> {
  await page.locator(`input[value="${PROVIDER}"]`).check()
  const accept = page.locator('input[name="accept"]')
  if (await accept.count()) {
    await accept.check()
  }
  await page
    .locator("main form button[type=submit]")
    .filter({ hasText: "Kart bilgilerine geç" })
    .click()
  await expect(page).toHaveURL(/\/odeme\/kart$/)
}

// `pnpm dev:paytr`'s account, fake and readable on purpose (packages/testing/src/dev/paytr.ts).
// Test mode off, as its README asks: the form then comes empty, as the live one does
const DEV_PAYTR = {
  settings: { merchant_id: "100001", test_mode: false },
  secrets: { merchant_key: "gelistirme-sahte-anahtar", merchant_salt: "gelistirme-sahte-tuz" },
}

/** The fake PayTR account connected when no PayTR account is (and left so: it is the dev account). */
export async function connectFakePaytr(api: AdminApi): Promise<void> {
  const { accounts } = await api.get<{ accounts: { provider: string; state: string }[] }>(
    "/admin/integrations/credentials"
  )
  if (accounts.find((each) => each.provider === "paytr")?.state === "connected") {
    return
  }
  const saved = await api.postProved<{ account: { state: string } }>(
    "/admin/integrations/credentials/paytr",
    DEV_PAYTR
  )
  expect(saved.account.state, "the fake PayTR answers the backend's check").toBe("connected")
}

/**
 * Checkout offers PayTR: as the shop stands, else once a temporary owner
 * (`admin.ts`) has connected the fake account. Medusa's CLI makes and
 * removes that owner, seconds each, so only when it is needed.
 */
export async function ensureFakePaytr(): Promise<void> {
  const { card_providers } = await storeGet<{ card_providers: string[] }>(
    "/store/payment/methods",
    {}
  )
  if (card_providers.includes(PROVIDER)) {
    return
  }
  const admin = createTemporaryAdmin()
  try {
    const api = await signInAdmin(admin)
    try {
      await connectFakePaytr(api)
    } finally {
      await api.dispose()
    }
  } finally {
    removeTemporaryAdmin(admin.email)
  }
}
