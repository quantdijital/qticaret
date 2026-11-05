import { randomUUID } from "node:crypto"
import { z } from "@medusajs/framework/zod"
import { CSV_BOM, toCsv } from "../../../lib/security"
import { runSeoAudit } from "../../seo/audit"
import type { JobType } from "./types"

// The job's summary shows this many of each finding's items; the report has the rest
const SUMMARY_ITEMS = 10

const COLUMNS = [
  "rule_id",
  "severity",
  "reason",
  "subject",
  "count",
  "target",
  "entity_kind",
  "entity_id",
] as const

/**
 * The store-wide SEO audit (docs/14 §3.9): its findings in the summary for
 * the panel, every listed item in a `;`-separated CSV (formula-safe, F2.9)
 * to work through. Paths and page names only: no personal data. Run each
 * night after the assessments, and from the SEO page on request.
 */
export const seoAudit: JobType<Record<string, never>> = {
  input: z.object({}).strict(),
  singleton: true,
  scheduled: true,
  resultTtlDays: 30,
  containsPersonalData: false,
  execute: async ({ container, progress, resultFile }) => {
    await progress(5)
    const findings = await runSeoAudit(container, { progress })
    const file = await resultFile(`seo-audit-${randomUUID()}.csv`, "text/csv")
    await file.write(
      CSV_BOM +
        toCsv(
          [
            [...COLUMNS],
            ...findings.flatMap((each) =>
              each.items.map((item) => [
                each.ruleId,
                each.severity,
                item.reason,
                item.subject,
                item.count === undefined ? "" : String(item.count),
                item.target ?? "",
                item.entity?.kind ?? "",
                item.entity?.id ?? "",
              ])
            ),
          ],
          ";"
        )
    )
    return {
      summary: {
        findings: findings.map((each) => ({
          ...each,
          items: each.items.slice(0, SUMMARY_ITEMS),
        })),
      },
    }
  },
}
