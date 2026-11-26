import type { Page } from "@playwright/test"
import { expect, test } from "./support/guard"

/**
 * The media library's clean-up (M1): a picture nothing shows is listed in
 * "Kullanılmayan", picked and deleted for good after a confirmation. The
 * test uploads its own picture and deletes it; nothing of the shop's own
 * changes (a leftover is deleted at the end).
 */

// A 1×1 PNG: the server checks the bytes and keeps it as a library picture
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
)

async function uploadPicture(page: Page, name: string): Promise<string> {
  const uploaded = await page.request.post("/admin/uploads", {
    multipart: { files: { name, mimeType: "image/png", buffer: PNG } },
  })
  expect(uploaded.ok()).toBe(true)
  const { files } = (await uploaded.json()) as { files: { id: string }[] }
  const registered = await page.request.post("/admin/media", {
    data: { file_ids: files.map((file) => file.id), library: true },
  })
  expect(registered.ok()).toBe(true)
  return ((await registered.json()) as { media: { id: string }[] }).media[0]?.id ?? ""
}

test("lists an unused picture and deletes it after asking", async ({ page, guard }) => {
  const name = `temizlik-e2e-${String(Date.now())}.png`
  const id = await uploadPicture(page, name)
  try {
    await page.goto(`/media?view=unused&q=${encodeURIComponent("temizlik-e2e")}`)
    await expect(page.getByRole("tab", { name: "Kullanılmayan" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    const tile = page.getByRole("button", { name })
    await expect(tile).toBeVisible()
    await tile.click()
    await expect(tile).toHaveAttribute("aria-pressed", "true")
    await page.getByRole("button", { name: "Kalıcı olarak sil" }).click()
    const confirm = page.getByRole("alertdialog")
    await confirm.getByRole("button", { name: "Sil" }).click()
    await expect(page.getByText("1 görsel silindi.")).toBeVisible()
    await expect(tile).toBeHidden()
    expect((await page.request.get(`/admin/media/${id}`)).status()).toBe(404)
    await guard.assertHealthy()
  } finally {
    if ((await page.request.get(`/admin/media/${id}`)).ok()) {
      await page.request.delete(`/admin/media/${id}`)
    }
  }
})
