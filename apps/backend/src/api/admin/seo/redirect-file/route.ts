import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ValidationError } from "../../../../lib/errors"
import { serverErrorMessage } from "../../../../lib/errors/messages"
import { SEO_REDIRECTS_MODULE } from "../../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../../modules/seo-redirects/service"
import { toRedirectRule } from "../../../../modules/seo-redirects/service"
import { readRedirectCsv, writeRedirectCsv } from "../../../../workflows/seo/redirects/csv"
import { importRedirectsWorkflow } from "../../../../workflows/seo/redirects/workflows"
import { isDashboardRequest } from "../../../http/dashboard-messages"
import type { AdminPostRedirectImportType } from "../redirects/validators"

// Far beyond any shop's rule set; an export never runs unbounded
const MAX_EXPORT = 50_000

/** Every rule as the import reads it back (docs/13 §4); formulas escaped for Excel. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
  const rules = await service.listSeoRedirects({}, { order: { source: "ASC" }, take: MAX_EXPORT })
  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader("Content-Disposition", 'attachment; filename="yonlendirmeler.csv"')
  res.setHeader("Cache-Control", "no-store")
  res.send(writeRedirectCsv(rules.map(toRedirectRule)))
}

/**
 * A redirect file (docs/13 §4): every row or none. The answer says what
 * the file would do or did, and each faulty row by its line: a sentence
 * for the panel, the key for an API client (adr/0021).
 */
export async function POST(
  req: MedusaRequest<AdminPostRedirectImportType>,
  res: MedusaResponse
): Promise<void> {
  const { csv, dry_run } = req.validatedBody
  const read = readRedirectCsv(csv)
  if ("fileProblem" in read) {
    throw new ValidationError(read.fileProblem, { field: "csv" })
  }
  const { result } = await importRedirectsWorkflow(req.scope).run({
    input: { rows: read.rows, dry_run: dry_run || read.problems.length > 0 },
  })
  const sentences = isDashboardRequest(req)
  const problems = [...read.problems, ...result.problems]
    .sort((a, b) => a.line - b.line)
    .map((problem) => ({
      line: problem.line,
      code: problem.key,
      message: sentences ? serverErrorMessage(problem.key, "tr") : problem.key,
      field: problem.field ?? null,
    }))
  res.json({
    dry_run,
    applied: !dry_run && problems.length === 0,
    rows: read.rows.length + read.problems.length,
    created: result.created,
    updated: result.updated,
    problems,
  })
}
