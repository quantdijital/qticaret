import { expect, test as base } from "@playwright/test"
import type { Page } from "@playwright/test"

// src/lib/i18n.ts MISSING_KEY: the panel's source is not imported into e2e
const MISSING_KEY = "i18n missing key:"
// The browser's own line for any refused request (a 401 before sign-in is expected); 5xx is checked apart
const RESOURCE_LINE = "Failed to load resource"

/** What the panel shows when something went wrong (tr.json `errors.*`). */
const ERROR_TEXTS = ["İşlem tamamlanamadı. Biraz sonra tekrar deneyin.", "Sayfa açılamadı"]

interface Guard {
  /** Fails the test if the page threw, logged an error, met a 5xx, showed an error line or a raw text key. */
  assertHealthy: () => Promise<void>
}

/** A page watched for what a person would call broken (the shop panel's guard). */
export const test = base.extend<{ guard: Guard }>({
  guard: async ({ page }, use) => {
    const problems: string[] = []
    page.on("pageerror", (error) => problems.push(`script: ${error.message}`))
    page.on("console", (message) => {
      const text = message.text()
      if (text.startsWith(MISSING_KEY)) {
        problems.push(text)
      } else if (message.type() === "error" && !text.startsWith(RESOURCE_LINE)) {
        problems.push(`console: ${text}`)
      }
    })
    page.on("response", (response) => {
      if (response.status() >= 500) {
        problems.push(
          `${String(response.status())} ${response.request().method()} ${new URL(response.url()).pathname}`
        )
      }
    })
    await use({
      assertHealthy: async () => {
        for (const text of ERROR_TEXTS) {
          await expect(page.getByText(text, { exact: true })).toHaveCount(0)
        }
        expect(problems).toEqual([])
      },
    })
  },
})

export { expect }

/** The page's own heading. */
export const pageHeading = (page: Page) => page.getByRole("heading", { level: 1 }).first()
