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
  it("says how many pages the look opened as drafts, each a link to its settings", () => {
    show(
      report({
        made_pages: [
          { ref: "page:hakkimizda", page_id: "cnt_about", name: "Hakkımızda" },
          { ref: "page:kargo-ve-teslimat", page_id: "cnt_ship", name: "Kargo ve Teslimat" },
        ],
      })
    )

    expect(
      screen.getByText(
        "2 sayfa taslak olarak açıldı. Yayına almak için sayfayı açın ve sayfa ayarlarından Yayında'yı seçin:"
      )
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Kargo ve Teslimat" })).toHaveAttribute(
      "href",
      "/storefront/editor?icerik=cnt_ship&ayar=sayfa"
    )
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

describe("the note of a look's style taken alone (owner, 2026-11-28)", () => {
  it("says only the style came in and the sections stayed", () => {
    show(report({ name: "Tezgâh", scope: "style" }))

    expect(
      screen.getByText(
        "‘Tezgâh’ görünümünün stili taslağa uygulandı; bölümleriniz olduğu gibi kaldı."
      )
    ).toBeInTheDocument()
    expect(screen.queryByText("‘Tezgâh’ taslağa uygulandı.")).toBeNull()
  })
})
