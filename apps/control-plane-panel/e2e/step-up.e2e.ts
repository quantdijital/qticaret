import { readFileSync } from "node:fs"
import { expect, pageHeading, test } from "./support/guard"
import { OWNER_FILE } from "./support/paths"

/**
 * The re-authentication dialog against the real control plane (adr/0061
 * Ek C4): a sensitive change is refused with 428, the dialog takes a
 * recovery code, the proof comes back and the change is made again. Here:
 * new recovery codes on "Hesabım". A wrong code first, said in the dialog.
 */
test("asks for a code, obtains a proof and makes the change", async ({ page, guard }) => {
  const { recoveryCodes } = JSON.parse(readFileSync(OWNER_FILE, "utf8")) as {
    recoveryCodes: string[]
  }
  await page.goto("/account")
  await expect(pageHeading(page)).toHaveText("Hesabım")

  await page.getByRole("button", { name: "Yeni kurtarma kodları" }).click()
  const dialog = page.getByRole("dialog", { name: "Kimliğinizi doğrulayın" })
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Kurtarma kodu kullan" }).click()
  await dialog.getByLabel("Kurtarma kodu").fill("WRONG-CODE-0000")
  await dialog.getByRole("button", { name: "Doğrula" }).click()
  await expect(dialog.getByRole("alert")).toContainText("Kod doğru değil")

  await dialog.getByLabel("Kurtarma kodu").fill(recoveryCodes[0] ?? "")
  await dialog.getByRole("button", { name: "Doğrula" }).click()

  const codes = page.getByRole("dialog", { name: "Yeni kurtarma kodlarınız" })
  await expect(codes).toBeVisible()
  await expect(codes.getByRole("list", { name: "Kurtarma kodları" })).not.toContainText(
    recoveryCodes[0] ?? ""
  )
  await codes.getByRole("button", { name: "Kaydettim" }).click()
  await guard.assertHealthy()
})
