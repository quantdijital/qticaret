import { expect, test as base } from "@playwright/test"
import type { Page } from "@playwright/test"

/** What the panel shows when something went wrong (tr.json `errors.*`). */
const ERROR_TEXTS = ["Bilgiler yüklenemedi.", "İşlem tamamlanamadı. Biraz sonra tekrar deneyin."]

interface Guard {
  /** Fails the test if the page threw, the API answered 5xx or an error message shows. */
  assertHealthy: () => Promise<void>
}

/**
 * A page watched for what a person would call broken: a script error, a
 * server error behind it, the panel's own error lines on screen.
 */
export const test = base.extend<{ guard: Guard }>({
  guard: async ({ page }, use) => {
    const problems: string[] = []
    page.on("pageerror", (error) => problems.push(`script: ${error.message}`))
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

/** The page's own heading: what every screen's PageHeader shows. */
export const pageHeading = (page: Page) => page.getByRole("heading", { level: 1 }).first()
