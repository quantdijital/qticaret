import { mkdirSync, writeFileSync } from "node:fs"
import { expect, test as setup } from "@playwright/test"
import { createTemporaryAdmin } from "./support/admin"
import { ADMIN_FILE, AUTH_DIR, SESSION_FILE } from "./support/paths"

// Medusa's CLI boots the whole backend to make the user: tens of seconds on a busy machine
const CLI_TIMEOUT_MS = 120_000

/** One temporary admin per run, signed in through the login page as a person would. */
setup("signs a temporary admin in", async ({ page }) => {
  setup.setTimeout(CLI_TIMEOUT_MS)
  const admin = createTemporaryAdmin()
  mkdirSync(AUTH_DIR, { recursive: true })
  writeFileSync(ADMIN_FILE, JSON.stringify({ email: admin.email }))
  await page.goto("/login")
  await page.getByLabel("E-posta").fill(admin.email)
  await page.getByLabel("Şifre").fill(admin.password)
  await page.getByRole("button", { name: "Giriş yap" }).click()
  await page.waitForURL((url) => !url.pathname.startsWith("/login"))
  await expect(page.getByRole("navigation", { name: "Ana menü" })).toBeVisible()
  await page.context().storageState({ path: SESSION_FILE })
})
