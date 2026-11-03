import type { Page } from "@playwright/test"

/** Errors the page logs, apart from a browser extension's or a dev server's own noise. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error" && !/hydrat|Download the React DevTools/i.test(message.text())) {
      errors.push(message.text())
    }
  })
  page.on("pageerror", (error) => {
    errors.push(error.message)
  })
  return errors
}

/** The cookie banner at the foot of every page (it stays in the page, closed, once answered). */
export const cookieBanner = (page: Page) => page.locator('section[aria-labelledby="cerez-baslik"]')

/** Answers the cookie banner so it does not cover what a test clicks. */
export async function dismissCookies(page: Page): Promise<void> {
  const button = cookieBanner(page).locator('button[name="choice"][value="necessary"]')
  if (await button.isVisible()) {
    await button.click()
    await page.waitForLoadState("networkidle")
  }
}
