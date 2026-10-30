import { mkdirSync, writeFileSync } from "node:fs"
import { expect, test as setup } from "@playwright/test"
import { createTemporaryAdmin } from "./support/admin"
import { totp } from "./support/totp"
import { ADMIN_FILE, AUTH_DIR, SESSION_FILE } from "./support/paths"

// Medusa's CLI boots the whole backend twice (the user, then its role): tens of seconds each
const CLI_TIMEOUT_MS = 180_000

/** One temporary admin per run, signed in through the login page as a person would. */
setup("signs a temporary admin in", async ({ page }) => {
  setup.setTimeout(CLI_TIMEOUT_MS)
  const admin = createTemporaryAdmin()
  mkdirSync(AUTH_DIR, { recursive: true })
  writeFileSync(ADMIN_FILE, JSON.stringify({ email: admin.email }))
  const signIn = async (code?: string) => {
    await page.goto("/login")
    await page.getByLabel("E-posta").fill(admin.email)
    await page.getByLabel("Şifre").fill(admin.password)
    await page.getByRole("button", { name: "Giriş yap" }).click()
    if (code !== undefined) {
      await page.getByLabel("Doğrulama kodu").fill(code)
      await page.getByRole("button", { name: "Doğrula ve gir" }).click()
    }
    await page.waitForURL((url) => !url.pathname.startsWith("/login"))
  }
  await signIn()
  // 2FA on in this environment (adr/0040): set up as a person would, then in with a code
  if (new URL(page.url()).pathname === "/security/setup") {
    const key = (await page.getByLabel("Kurulum anahtarı").innerText()).replace(/\s+/g, "")
    await page.getByLabel("Uygulamadaki 6 haneli kod").fill(totp(key))
    // Setting it up asks the password too: a session alone must not enrol an app
    await page.getByLabel("Şifreniz").fill(admin.password)
    await page.getByRole("button", { name: "Doğrula" }).click()
    await page.getByRole("checkbox", { name: "Kodları güvenli bir yere kaydettim" }).check()
    await page.getByRole("button", { name: "Devam" }).click()
    await page.getByRole("button", { name: "Yeniden giriş yap" }).click()
    await page.waitForURL((url) => url.pathname.startsWith("/login"))
    // The next step's code: the setup's own was just used
    await signIn(totp(key, 1))
  }
  await expect(page.getByRole("navigation", { name: "Ana menü" })).toBeVisible()
  await page.context().storageState({ path: SESSION_FILE })
})
