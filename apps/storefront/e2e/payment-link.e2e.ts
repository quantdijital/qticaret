import { expect, test } from "@playwright/test"
import { collectErrors } from "./support"

/**
 * A payment link's page, `/ode/<token>` (adr/0051). The dev database has
 * `orders.payment_links` off, so the backend answers every token with its
 * one 404 and the "cannot be used" page is the only state reachable here;
 * the order, moved prices, the button's answers and the locked cart are
 * the unit tests' (lib/views, app/actions, the theme's render).
 */

// The backend's shape (`pl_<22>.<end>.<mac>`), signed by no one; upper case on purpose
const FORGED = `/ode/pl_${"A".repeat(22)}.mhx2k1.${"A".repeat(43)}`

test("a payment link that opens nothing says so: one wording, never indexed, its token told to no page", async ({
  page,
}) => {
  const errors = collectErrors(page)
  // A forged token asks the backend (404); a malformed one asks nothing
  for (const path of [FORGED, "/ode/bozuk"]) {
    const response = await page.goto(path)
    expect(response?.status()).toBe(200)
    // The token's case is the token's: no 301 to lower case
    expect(new URL(page.url()).pathname).toBe(path)
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer")
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /^noindex,\s*nofollow$/
    )
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer")
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Bu ödeme bağlantısı kullanılamıyor"
    )
    await expect(page.locator("main form")).toHaveCount(0)
    await expect(
      page.locator("main").getByRole("link", { name: "Ana sayfaya dön" })
    ).toHaveAttribute("href", "/")
  }
  expect(errors).toEqual([])
})
