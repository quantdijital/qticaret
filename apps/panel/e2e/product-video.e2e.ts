import { execFileSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"
import { dialogIssues } from "./support/dialog"
import { expect, pageHeading, test } from "./support/guard"

/**
 * A product video end to end (adr/0069 slice 8): a short clip goes up
 * through the media dialog, the tile says "İşleniyor" until the server has
 * made it fit for the web, then shows its poster; the "Video" dialog shows
 * its title field, length and size; the Store API gives the ready video
 * (what the storefront reads; CI runs no storefront); removing it takes it
 * off the panel and the Store API.
 *
 * Needs ffmpeg on the machine that runs the backend (CI's e2e job installs
 * it) and here, where the clip is made: no clip is kept in the repository.
 * Writes one video on one demo product and removes it; whatever is left
 * after a failure is removed at the end.
 */

const PROCESSING_TIMEOUT_MS = 150_000
// The tile's own words (tr.json `products.videos`)
const TILE = /^1\. video/
// Marked for axe while the test runs: the video tile alone, not the pictures beside it
const VIDEO_TILE_MARK = "data-e2e-video-tile"

interface ListedVideo {
  id: string
  status: "uploaded" | "processing" | "ready" | "failed"
  error_code: string | null
}

interface StoreVideo {
  id: string
  status: string
  outputs: { mp4?: { url: string }; webm?: { url: string } } | null
  poster: { url: string } | null
}

/** A 3 s, 320×240 silent H.264 clip, made by ffmpeg from its test pattern. */
function makeClip(path: string): void {
  mkdirSync(dirname(path), { recursive: true })
  execFileSync(
    process.env["FFMPEG_PATH"] ?? "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=320x240:rate=25",
      "-t",
      "3",
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      path,
    ],
    { stdio: "pipe", timeout: 60_000 }
  )
}

/** The sales channel's publishable key, as the storefront sends it (the demo shop's first). */
async function publishableKey(page: Page): Promise<string> {
  const answer = await page.request.get("/admin/api-keys?type=publishable&limit=50")
  expect(answer.ok()).toBe(true)
  const { api_keys: keys } = (await answer.json()) as {
    api_keys: { title: string; token: string; revoked_at?: string | null }[]
  }
  const live = keys.filter((key) => !key.revoked_at)
  const key = live.find((each) => each.title === "Demo storefront") ?? live[0]
  expect(key, "the shop has a publishable key").toBeDefined()
  return key?.token ?? ""
}

/** The oldest product the storefront sells: away from the newest ones the dialog tests open. */
async function storeProduct(page: Page, key: string): Promise<{ id: string; title: string }> {
  const answer = await page.request.get(
    "/store/products?limit=1&order=created_at&fields=id,title",
    {
      headers: { "x-publishable-api-key": key },
    }
  )
  expect(answer.ok()).toBe(true)
  const { products } = (await answer.json()) as { products: { id: string; title: string }[] }
  const product = products[0]
  expect(product, "the shop sells a product").toBeDefined()
  return product ?? { id: "", title: "" }
}

async function listVideos(page: Page, productId: string) {
  const answer = await page.request.get(`/admin/products/${productId}/videos`)
  expect(answer.ok()).toBe(true)
  return (await answer.json()) as { videos: ListedVideo[]; limit: number; upload: boolean }
}

/** The product's videos as the Store API gives them: the ready ones only. */
async function storeVideos(page: Page, key: string, productId: string): Promise<StoreVideo[]> {
  const fields = [
    "id",
    "+media_videos.id",
    "+media_videos.status",
    "+media_videos.outputs",
    "+media_videos.poster",
  ].join(",")
  const answer = await page.request.get(
    `/store/products/${productId}?fields=${encodeURIComponent(fields)}`,
    { headers: { "x-publishable-api-key": key } }
  )
  expect(answer.ok()).toBe(true)
  const { product } = (await answer.json()) as { product: { media_videos?: StoreVideo[] | null } }
  return product.media_videos ?? []
}

/** Serious accessibility issues in the marked video tile (the a11y suite's rules). */
async function tileIssues(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .include(`[${VIDEO_TILE_MARK}]`)
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze()
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => violation.id)
}

test("uploads a product video, shows it once processed and removes it", async ({ page, guard }) => {
  test.setTimeout(PROCESSING_TIMEOUT_MS + 90_000)
  const clip = test.info().outputPath("urun-videosu.mp4")
  makeClip(clip)

  const key = await publishableKey(page)
  const product = await storeProduct(page, key)
  const before = await listVideos(page, product.id)
  expect(before.upload, "the backend can take a clip (ffmpeg on its machine)").toBe(true)
  expect(before.videos).toEqual([])

  try {
    await page.goto(`/products/${product.id}`)
    await expect(pageHeading(page)).toHaveText(product.title)
    await page.waitForLoadState("networkidle")

    // The gallery's one way in (docs/18 §7): the media dialog takes the clip too
    await page.getByRole("button", { name: /^Görsel ya da video ekle: / }).click()
    const picker = page.getByRole("dialog", { name: "Görsel ya da video ekle" })
    await expect(picker).toBeVisible()
    await picker.getByRole("tab", { name: "Bilgisayardan yükle" }).click()
    const uploaded = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === `/admin/products/${product.id}/videos`
    )
    await picker.getByLabel("Bilgisayardan görsel seç").setInputFiles(clip)
    const response = await uploaded
    expect(response.status()).toBe(202)
    const { video } = (await response.json()) as { video: ListedVideo }
    expect(video.status).toBe("uploaded")
    // Only a clip: nothing is left to choose, the dialog closes
    await expect(picker).toBeHidden()

    // Recorded, not ready: the tile says so until the job has made it
    await expect(page.getByRole("button", { name: "1. video, İşleniyor" })).toBeVisible()
    await expect
      .poll(
        async () =>
          (await listVideos(page, product.id)).videos.find((each) => each.id === video.id)?.status,
        { timeout: PROCESSING_TIMEOUT_MS, intervals: [2_000] }
      )
      .not.toMatch(/^(uploaded|processing)$/)
    const done = (await listVideos(page, product.id)).videos.find((each) => each.id === video.id)
    expect(done, `processed: ${done?.error_code ?? "no error"}`).toMatchObject({ status: "ready" })

    // Ready: the poster, no word on the tile (the list is read again every 5 s)
    const tile = page.getByRole("button", { name: "1. video", exact: true })
    await expect(tile).toBeVisible({ timeout: 15_000 })
    await expect(tile.locator("img")).toBeVisible()
    await tile.evaluate(
      (button, mark) => button.closest("li")?.setAttribute(mark, ""),
      VIDEO_TILE_MARK
    )
    expect(await tileIssues(page)).toEqual([])

    // What the storefront reads: the ready video, its MP4 and its poster
    const shown = (await storeVideos(page, key, product.id)).find((each) => each.id === video.id)
    expect(shown?.status).toBe("ready")
    expect(shown?.outputs?.mp4?.url).toMatch(/\.mp4$/)
    expect(shown?.poster?.url).toBeTruthy()

    // The "Video" dialog: title, length, size, state
    await tile.click()
    const dialog = page.getByRole("dialog", { name: "Video" })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel("Başlık", { exact: true })).toBeVisible()
    const facts = dialog.locator("dl")
    await expect(facts).toContainText(/Süre\s*0:0[234]/)
    await expect(facts).toContainText(/Boyut\s*320 × 240/)
    await expect(facts).toContainText("Hazır")
    await page.waitForLoadState("networkidle")
    expect(await dialogIssues(page)).toEqual([])
    await guard.assertHealthy()

    // Removed, asked first: gone from the gallery and from the Store API
    await dialog.getByRole("button", { name: "Videoyu kaldır" }).click()
    const confirm = page.getByRole("alertdialog", { name: "Video kaldırılsın mı?" })
    await confirm.getByRole("button", { name: "Videoyu kaldır" }).click()
    await expect(page.getByText("Video kaldırıldı.")).toBeVisible()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole("button", { name: TILE })).toHaveCount(0)
    expect((await storeVideos(page, key, product.id)).map((each) => each.id)).not.toContain(
      video.id
    )
    await guard.assertHealthy()
  } finally {
    // Whatever this run left on the product (a failure midway) goes with it: it had none
    for (const left of (await listVideos(page, product.id)).videos) {
      await page.request.delete(`/admin/products/${product.id}/videos/${left.id}`)
    }
  }
})
