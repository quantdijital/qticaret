import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import type { ApplyReport as Report } from "./api"
import { ApplyReport } from "./apply-report"

const report = (more: Partial<Report>): Report => ({
  name: "Katalog",
  auto_saved: null,
  saved_name: null,
  skipped: [],
  kept: [],
  ...more,
})

const show = (value: Report) => render(<ApplyReport report={value} onClose={() => undefined} />)

describe("the apply's note on content pages (adr/0073 Ek 2026-11-19 (2) K6)", () => {
  it("says a page the look opened is a draft, and how to put it live", () => {
    show(
      report({ made_pages: [{ ref: "page:hakkimizda", page_id: "cnt_about", name: "Hakkımızda" }] })
    )

    expect(
      screen.getByText(
        "Hakkımızda sayfası taslak olarak açıldı; yayına almak için sayfa ayarlarından Yayında'yı seçin."
      )
    ).toBeInTheDocument()
  })

  it("says the shop's own page text was kept, by the look's name or else the address", () => {
    show(
      report({
        texts_kept: [{ ref: "page:hakkimizda", name: "Hakkımızda" }, { ref: "page:hikayemiz" }],
      })
    )

    expect(
      screen.getByText(
        "Hakkımızda sayfasının kendi metni korundu; görünüm yalnız düzeni değiştirdi."
      )
    ).toBeInTheDocument()
    expect(screen.getByText(/^hikayemiz sayfasının kendi metni korundu/)).toBeInTheDocument()
  })

  it("says a page whose address another record holds could not be opened", () => {
    show(
      report({
        skipped: [
          { where: "pages", ref: "page:hakkimizda", name: "Hakkımızda", reason: "taken" },
          { where: "pages", ref: "page:sss", reason: "taken" },
        ],
      })
    )

    expect(
      screen.getByText(
        "Hakkımızda sayfası açılamadı: ‘hakkimizda’ adresini başka bir kayıt kullanıyor. Sayfa düzeni eklenmedi."
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "‘sss’ adresinde sayfa açılamadı: adresi başka bir kayıt kullanıyor. Sayfa düzeni eklenmedi."
      )
    ).toBeInTheDocument()
  })

  it("reads a note made before pages were opened (no made or kept lists)", () => {
    show(report({ skipped: [{ where: "pages", ref: "page:hakkimizda", name: "Hakkımızda" }] }))

    expect(screen.getByText(/Hakkımızda sayfası olmadığı için/)).toBeInTheDocument()
    expect(screen.queryByText(/taslak olarak açıldı/)).toBeNull()
  })
})
