import { readFileSync } from "node:fs"
import type { Page } from "@playwright/test"

/** How a page is brought to rest before its style is read. */

// Motion off: transitions and animations end where they rest, no caret blinks
const STILL = `*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important;scroll-behavior:auto!important}`

/**
 * The storefront's error page title (`app/error.tsx`: the backend busy or
 * away, its rate limit among them): a page drawn so is no capture of it.
 */
const ERROR_TITLE = (
  JSON.parse(
    readFileSync(new URL("../../src/lib/i18n/tr.json", import.meta.url), "utf8")
  ) as Record<string, string>
)["error.title"]

/** Waits between attempts when the storefront answers with its error page. */
const RETRY_MS = [15_000, 30_000, 60_000]

async function loadOnce(page: Page, url: string): Promise<string | null> {
  const response = await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 })
  const status = response?.status() ?? 0
  if (status === 429 || status >= 500) {
    return `HTTP ${status}`
  }
  if (ERROR_TITLE && (await page.getByText(ERROR_TITLE, { exact: true }).count()) > 0) {
    return "the storefront drew its error page"
  }
  return null
}

/**
 * Loads a page and lets it come to rest: network idle, fonts, images in
 * view, motion off, two frames. The storefront's error page (the backend
 * rate-limiting a burst of loads, a cold compile) is waited out and asked
 * again; still there after the last wait, it fails the capture.
 */
export async function settle(page: Page, url: string, log: (text: string) => void): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    const failed = await loadOnce(page, url)
    if (failed === null) {
      break
    }
    const wait = RETRY_MS[attempt]
    if (wait === undefined) {
      throw new Error(
        `${failed} on every attempt: the backend is busy or rate-limiting; wait a minute and run again`
      )
    }
    log(`  ${failed}; asking again in ${wait / 1000} s`)
    await page.waitForTimeout(wait)
  }
  await page.addStyleTag({ content: STILL })
  await page.evaluate(async () => {
    await document.fonts.ready
    window.scrollTo(0, 0)
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
  })
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined)
}
