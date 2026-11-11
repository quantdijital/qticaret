import { mkdirSync, writeFileSync } from "node:fs"
import { expect, test as setup } from "@playwright/test"
import { createTemporaryOwner } from "./support/owner"
import { AUTH_DIR, OWNER_FILE, SESSION_FILE } from "./support/paths"
import { totp } from "./support/totp"

// Medusa's CLI boots the whole control plane for the owner: tens of seconds
const CLI_TIMEOUT_MS = 180_000

/**
 * One temporary owner per run, signed in as a person would: e-mail and
 * password, the mandatory 2FA setup on the panel's own page (its key read
 * from the page, the codes worked out here), the recovery codes kept, then
 * a new sign-in with the app's code.
 */
setup("signs a temporary owner in, setting 2FA up", async ({ page }) => {
  setup.setTimeout(CLI_TIMEOUT_MS)
  const owner = createTemporaryOwner()
  mkdirSync(AUTH_DIR, { recursive: true })
  writeFileSync(OWNER_FILE, JSON.stringify({ email: owner.email }))
  const signIn = async (code?: string) => {
    await page.goto("/login")
    await page.getByLabel("E-posta").fill(owner.email)
    // Exact: the field's own button is "Şifreyi göster"
    await page.getByLabel("Şifre", { exact: true }).fill(owner.password)
    await page.getByRole("button", { name: "Giriş yap" }).click()
    if (code !== undefined) {
      await page.getByLabel("Doğrulama kodu").fill(code)
      await page.getByRole("button", { name: "Doğrula ve gir" }).click()
    }
    await page.waitForURL((url) => !url.pathname.startsWith("/login"))
  }

  await signIn()
  await expect(page).toHaveURL(/\/security\/setup$/)
  const key = (await page.getByLabel("Kurulum anahtarı").innerText()).replace(/\s+/g, "")
  await page.getByLabel("Uygulamadaki 6 haneli kod").fill(totp(key))
  // The setup asks the password too: a session alone must not enrol an app
  await page.getByLabel("Şifreniz").fill(owner.password)
  await page.getByRole("button", { name: "Doğrula" }).click()
  const codes = (await page.getByRole("list", { name: "Kurtarma kodları" }).innerText())
    .split(/\s+/)
    .filter(Boolean)
  expect(codes.length).toBeGreaterThan(1)
  await page.getByRole("checkbox", { name: "Kodları güvenli bir yere kaydettim" }).check()
  await page.getByRole("button", { name: "Devam" }).click()
  await page.getByRole("button", { name: "Yeniden giriş yap" }).click()
  await page.waitForURL((url) => url.pathname.startsWith("/login"))

  // The next step's code: the setup's own was just spent (each code is taken once)
  await signIn(totp(key, 1))
  await expect(page.getByRole("navigation", { name: "Ana menü" })).toBeVisible()
  // The app's key too (C11: the wizard's step-ups take its codes; the recovery
  // codes are replaced by step-up.e2e.ts), and the last time step spent
  writeFileSync(
    OWNER_FILE,
    JSON.stringify({
      email: owner.email,
      recoveryCodes: codes,
      totpKey: key,
      lastStep: Math.floor(Date.now() / 30_000) + 1,
    })
  )
  await page.context().storageState({ path: SESSION_FILE })
})
