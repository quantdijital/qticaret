import AxeBuilder from "@axe-core/playwright"
import { expect, pageHeading, test } from "./support/guard"

/** Screens a person spends the most time on; WCAG 2.1 A and AA rules (docs/06, docs/18). */
const SCREENS = ["/", "/products", "/orders", "/settings/store"]

for (const path of SCREENS) {
  test(`${path} has no serious accessibility issue`, async ({ page }) => {
    await page.goto(path)
    await expect(pageHeading(page)).toBeVisible()
    await page.waitForLoadState("networkidle")
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()
    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical"
    )
    expect(
      serious.map(
        (violation) =>
          `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`
      )
    ).toEqual([])
  })
}
