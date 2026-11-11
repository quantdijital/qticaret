import { readFileSync, writeFileSync } from "node:fs"
import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { OWNER_FILE } from "./paths"
import { totp } from "./totp"

interface OwnerFile {
  email: string
  recoveryCodes: string[]
  totpKey: string
  /** The last 30-second step whose code was spent: each code is taken once (Ek C4). */
  lastStep: number
}

const STEP_MS = 30_000

/**
 * Answers the step-up dialog with the app's code for a step not spent yet
 * (waiting for the next one when needed), as a person with the app would.
 * The proof then holds five minutes in the page's memory.
 */
export async function proveStepUp(page: Page): Promise<void> {
  const owner = JSON.parse(readFileSync(OWNER_FILE, "utf8")) as OwnerFile
  const dialog = page.getByRole("dialog", { name: "Kimliğinizi doğrulayın" })
  await expect(dialog).toBeVisible()
  let step = Math.floor(Date.now() / STEP_MS)
  if (step <= owner.lastStep) {
    await page.waitForTimeout((owner.lastStep + 1) * STEP_MS - Date.now() + 500)
    step = Math.floor(Date.now() / STEP_MS)
  }
  writeFileSync(OWNER_FILE, JSON.stringify({ ...owner, lastStep: step }))
  await dialog.getByLabel("Doğrulama kodu").fill(totp(owner.totpKey))
  await dialog.getByRole("button", { name: "Doğrula" }).click()
  await expect(dialog).toBeHidden()
}
