import { useQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import { assessmentQuery } from "@/features/seo/api/advisor"
import type { AdvisorKind, Severity } from "@/features/seo/api/advisor"

/** What the advisor found for one section of a content page. */
export interface SectionFindings {
  count: number
  /** One costs the page much (critical, high): the section opens. */
  attention: boolean
}

/** Nothing found, or the advisor has not answered yet. */
export const NO_FINDINGS: SectionFindings = { count: 0, attention: false }

const URGENT: ReadonlySet<Severity> = new Set(["critical", "high"])

/**
 * The advisor's findings by the section their fix lives in (the page's
 * `targets`, as its "go to field" uses them). The assessment is the
 * advisor card's own: asked once, read by both.
 */
export function useSectionFindings({
  kind,
  id,
  version,
  targets,
}: {
  kind: AdvisorKind
  id: string
  version: string | null
  targets: Readonly<Record<string, string>>
}): (section: string) => SectionFindings {
  const { data } = useQuery(assessmentQuery(kind, id, version))
  return (section) => {
    const issues = (data?.issues ?? []).filter(
      (issue) => issue.fix !== undefined && targets[issue.fix.action] === section
    )
    return {
      count: issues.length,
      attention: issues.some((issue) => URGENT.has(issue.severity)),
    }
  }
}

/** The findings said after a closed section's summary ("2 öneri"); none, nothing. */
export const findingsNote = (t: TFunction, findings: SectionFindings): string | undefined =>
  findings.count > 0 ? t("seo.advisor.issueCount", { count: findings.count }) : undefined

/** A section's summary parts in one line, with its findings after them. */
export const summaryLine = (
  t: TFunction,
  parts: readonly (string | undefined)[],
  findings: SectionFindings
): string => [...parts, findingsNote(t, findings)].filter(Boolean).join(" · ")
