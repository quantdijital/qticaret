import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { cookieBanner, DEMO_PRODUCT } from "./support"

/**
 * The conversion tags (docs/20 "vitrin dönüşüm olayları", D9): nothing of
 * Google's or Meta's loads before the visitor's cookie answer, and with
 * the shop's ids unset (the dev database connects none) nothing loads at
 * all, whatever the answer. The events' payloads and the gate itself are
 * the unit tests' (`lib/analytics`).
 */

const THIRD_PARTY = /googletagmanager|google-analytics|analytics\.google|facebook\.(net|com)/

/** Every request the page makes to a tag's host. */
function tagRequests(page: Page): string[] {
  const seen: string[] = []
  page.on("request", (request) => {
    if (THIRD_PARTY.test(request.url())) {
      seen.push(request.url())
    }
  })
  return seen
}

async function noTags(page: Page): Promise<void> {
  await expect(page.locator("script[src]")).not.toHaveCount(0)
  const sources = await page
    .locator("script[src]")
    .evaluateAll((scripts) => scripts.map((script) => (script as HTMLScriptElement).src))
  expect(sources.filter((src) => THIRD_PARTY.test(src))).toEqual([])
  const globals = await page.evaluate(() => ({
    dataLayer: "dataLayer" in window,
    gtag: "gtag" in window,
    fbq: "fbq" in window,
  }))
  expect(globals).toEqual({ dataLayer: false, gtag: false, fbq: false })
}

test("no tag before the cookie answer, and none at all while the shop connects none", async ({
  page,
}) => {
  const requests = tagRequests(page)
  const response = await page.goto(DEMO_PRODUCT)
  await page.waitForLoadState("networkidle")
  await expect(cookieBanner(page)).toBeVisible()
  await noTags(page)
  // The policy opens no tag host while none is connected
  const policy = response?.headers()["content-security-policy"] ?? ""
  expect(policy).not.toMatch(THIRD_PARTY)

  // Everything allowed: still nothing, the shop has no ids
  await cookieBanner(page).locator('button[name="choice"][value="all"]').click()
  await page.waitForLoadState("networkidle")
  await page.goto("/arama?q=gomlek")
  await page.waitForLoadState("networkidle")
  await noTags(page)
  expect(requests).toEqual([])
})
