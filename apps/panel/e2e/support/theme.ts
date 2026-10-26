import type { Page } from "@playwright/test"

export const MODES = ["light", "dark"] as const
export type Mode = (typeof MODES)[number]

/**
 * The page painted in `mode`, whatever the shop saved: the appearance
 * settings are answered with it (read only, nothing is written). A check
 * run in the saved mode alone misses what the other breaks (CI's fresh
 * shop is light; a developer's may be dark).
 */
export async function inMode(page: Page, mode: Mode): Promise<void> {
  await page.route("**/admin/platform-settings/appearance", async (route) => {
    const response = await route.fetch()
    const body = (await response.json()) as { values: Record<string, unknown> }
    await route.fulfill({ response, json: { ...body, values: { ...body.values, mode } } })
  })
}
