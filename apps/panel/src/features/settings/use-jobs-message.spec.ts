import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { i18next as i18n } from "@/lib/i18n"
import { useJobsMessage } from "./use-jobs-message"

const staff = vi.hoisted(() => ({ audit: true }))
vi.mock("@/features/auth/api/staff", () => ({ useCan: () => staff.audit }))

const KEYS = [
  "settings.seo.style.failed",
  "settings.accounting.package.later",
  "products.bulk.background",
  "orders.export.later",
  "reports.export.later",
  "seo.sitemap.queued",
  "attributes.facts.background",
]

describe("useJobsMessage", () => {
  it("points a role with the audit log to its jobs tab", () => {
    staff.audit = true
    const { result } = renderHook(() => useJobsMessage())

    expect(result.current("orders.export.later")).toBe("orders.export.later")
    expect(i18n.t(result.current("orders.export.later"))).toContain("Denetim kaydı > İşler")
  })

  it("gives any other role the news without a page it cannot open (the owner, 2026-11-23)", () => {
    staff.audit = false
    const { result } = renderHook(() => useJobsMessage())

    for (const key of KEYS) {
      expect(i18n.exists(key)).toBe(true)
      expect(i18n.exists(result.current(key))).toBe(true)
      expect(i18n.t(result.current(key))).not.toMatch(/İşler/)
    }
  })
})
