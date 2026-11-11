import { expect, pageHeading, test } from "./support/guard"

/**
 * "Anahtarlar" against the real control plane (adr/0061 Ek C8): the
 * owner's signing and encryption keys side by side, as ids, fingerprints
 * and counts; the published list is public keys only; a rewrap asks the
 * step-up. Nothing is written: the dialog is closed unanswered.
 */
test("shows the keys without a secret and asks the step-up before a rewrap", async ({
  page,
  guard,
}) => {
  await page.goto("/keys")
  await expect(pageHeading(page)).toHaveText("Anahtarlar")
  const signing = page.locator("section", {
    has: page.getByRole("heading", { name: "İmza anahtarları" }),
  })
  const keks = page.locator("section", {
    has: page.getByRole("heading", { name: "Şifreleme anahtarları" }),
  })
  await expect(signing).toBeVisible()
  await expect(keks).toBeVisible()
  // The current KEK's fingerprint: 16 hex characters, never a 64-character key
  await expect(keks.getByText("Güncel", { exact: true })).toBeVisible()
  await expect(keks.getByText(/^[0-9a-f]{16}$/).first()).toBeVisible()
  await expect(page.getByText(/[0-9a-f]{64}/)).toHaveCount(0)

  // Side by side, one height: no empty space under the shorter card (docs/18 §2)
  const [left, right] = await Promise.all([signing.boundingBox(), keks.boundingBox()])
  expect(left?.y).toBe(right?.y)
  expect(Math.abs((left?.height ?? 0) - (right?.height ?? -10))).toBeLessThanOrEqual(1)

  await keks.getByRole("button", { name: "Yeniden sar" }).click()
  const dialog = page.getByRole("dialog", { name: "Kimliğinizi doğrulayın" })
  await expect(dialog).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(dialog).toBeHidden()
  await guard.assertHealthy()
})
