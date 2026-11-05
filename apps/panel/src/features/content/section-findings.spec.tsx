import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import type { Assessment, SeoIssue } from "@/features/seo/api/advisor"
import { useSectionFindings } from "./section-findings"

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() } } }))

const issue = (severity: SeoIssue["severity"], action?: string): SeoIssue => ({
  ruleId: "A-TEST-01",
  severity,
  category: "meta",
  params: {},
  ...(action ? { fix: { kind: "manual" as const, action } } : {}),
})

const TARGETS = {
  edit_title: "content-seo",
  use_template_description: "content-seo",
  edit_author: "content-summary",
  add_image: "content-cover-section",
}

function findingsFor(issues: SeoIssue[]) {
  const client = new QueryClient()
  const assessment: Assessment = {
    score: 70,
    grade: "good",
    issues,
    categories: {},
    weights: { structured: 0, meta: 0, images: 0, content: 0, links: 0, technical: 0 },
  }
  client.setQueryData(["seo", "assessment", "post", "cnt_1", "v1"], assessment)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(
    () => useSectionFindings({ kind: "post", id: "cnt_1", version: "v1", targets: TARGETS }),
    { wrapper }
  ).result.current
}

describe("useSectionFindings", () => {
  it("counts the advisor's findings by the section their fix lives in; an urgent one asks attention", () => {
    const findings = findingsFor([
      issue("medium", "edit_title"),
      issue("high", "use_template_description"),
      issue("low", "add_image"),
      issue("critical", "edit_body"),
      issue("critical"),
    ])
    expect(findings("content-seo")).toEqual({ count: 2, attention: true })
    expect(findings("content-cover-section")).toEqual({ count: 1, attention: false })
    expect(findings("content-summary")).toEqual({ count: 0, attention: false })
  })
})
