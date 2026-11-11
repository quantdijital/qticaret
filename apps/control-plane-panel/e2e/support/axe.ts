import AxeBuilder from "@axe-core/playwright"
import type { Page } from "@playwright/test"

/** WCAG 2.1 A and AA (docs/18 §8): the serious and critical issues on the page as it is. */
export async function seriousIssues(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze()
  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`
    )
}
