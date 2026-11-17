import { readFileSync } from "node:fs"
import type { Page } from "@playwright/test"

/**
 * What a gallery thumbnail leaves out: it shows the look as a shopper
 * meets it, not the visit it was drawn on. The draft preview's notice, the
 * cookie card (not answered: nothing is posted) and the dev server's badge
 * are hidden, then the images that moved into view are waited for.
 */

const NOTICE = (
  JSON.parse(
    readFileSync(new URL("../../src/lib/i18n/tr.json", import.meta.url), "utf8")
  ) as Record<string, string>
)["preview.design_notice"]

// The dev server's own badge (`next dev`), never in a shop
const DEV_BADGE = "nextjs-portal{display:none!important}"

export async function asShopperSees(page: Page): Promise<void> {
  await page.addStyleTag({ content: DEV_BADGE })
  await page.evaluate(async (notice) => {
    const hide = (el: Element | null | undefined) => {
      if (el instanceof HTMLElement) {
        el.style.setProperty("display", "none", "important")
      }
    }
    const status = Array.from(document.querySelectorAll('[role="status"]')).find(
      (el) => el.textContent.trim() === notice
    )
    // The notice's own row (its container), so its spacing goes with it
    hide(status?.parentElement?.childElementCount === 1 ? status.parentElement : status)
    hide(document.getElementById("cerez-baslik")?.closest("[aria-labelledby]"))
    window.scrollTo(0, 0)
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
    const pending = Array.from(document.images).filter(
      (img) => !img.complete && img.getBoundingClientRect().top < window.innerHeight
    )
    await Promise.all(
      pending.map(
        (img) =>
          new Promise((done) => {
            img.addEventListener("load", done, { once: true })
            img.addEventListener("error", done, { once: true })
            setTimeout(done, 5_000)
          })
      )
    )
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  }, NOTICE ?? "")
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined)
}

/**
 * The file names of the pictures drawn in view (the image optimiser's
 * address unwrapped), so a thumbnail's photo credits can be listed.
 */
export async function picturesInView(page: Page): Promise<string[]> {
  const sources = await page.evaluate(() =>
    Array.from(document.images)
      .filter((img) => {
        const box = img.getBoundingClientRect()
        const shown = getComputedStyle(img).visibility !== "hidden"
        return (
          shown && box.width > 0 && box.height > 0 && box.top < innerHeight && box.left < innerWidth
        )
      })
      .map((img) => img.currentSrc || img.src)
  )
  const names = sources.map((src) => {
    const url = new URL(src)
    const inner = url.pathname.startsWith("/_next/image") ? url.searchParams.get("url") : null
    const path = inner ? new URL(inner, url).pathname : url.pathname
    return decodeURIComponent(path.slice(path.lastIndexOf("/") + 1))
  })
  return [...new Set(names)].sort()
}
