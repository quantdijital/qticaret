import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { REPORT_KEY } from "@/features/storefront/gallery/api"
import type { ApplyReport } from "@/features/storefront/gallery/api"
import { EditorNotices } from "./editor-notices"
import { GoneRecordsContext } from "./gone-records-context"
import { DOC } from "./theme-editor.fixtures"

function notices(
  report: ApplyReport | null,
  pendingMenus: unknown[] | null = null,
  gone: ReadonlySet<string> = new Set(),
  onOpenSection = vi.fn()
) {
  const client = new QueryClient()
  client.setQueryData(REPORT_KEY, report)
  render(
    <QueryClientProvider client={client}>
      <GoneRecordsContext.Provider value={gone}>
        <EditorNotices
          doc={DOC}
          onOpenSection={onOpenSection}
          pendingMenus={pendingMenus}
          onDropMenus={vi.fn()}
        />
      </GoneRecordsContext.Provider>
    </QueryClientProvider>
  )
  return client
}

const REPORT: ApplyReport = {
  name: "Katalog",
  auto_saved: { id: "sfd_kept", kind: "auto", name: null },
  saved_name: null,
  skipped: [
    { where: "home.0", ref: "kategoriler" },
    { where: "home.0", ref: "urunler" },
    { where: "home.3", ref: "kategoriler" },
  ],
  kept: ["footer"],
}

describe("EditorNotices", () => {
  it("says what the look applied from the gallery did, until it is closed", async () => {
    const user = userEvent.setup()
    const client = notices(REPORT)

    const note = screen.getByRole("status")
    expect(note).toHaveTextContent("‘Katalog’ taslağa uygulandı.")
    expect(note).toHaveTextContent(
      "Önceki görünümünüz 'Kayıtlı görünümlerim'e otomatik kaydedildi."
    )
    expect(note).toHaveTextContent("2 bölüm eklenmedi: mağazada kategoriler, urunler yok.")
    expect(note).toHaveTextContent("Üst/alt bilginiz korundu.")

    await user.click(screen.getByRole("button", { name: "Kapat" }))
    expect(screen.queryByRole("status")).toBeNull()
    expect(client.getQueryData(REPORT_KEY)).toBeNull()
  })

  it("names the kept draft when it was kept by name, and says nothing it did not do", () => {
    notices({
      ...REPORT,
      auto_saved: { id: "sfd_kept", kind: "saved", name: "Eski vitrin" },
      saved_name: "Eski vitrin",
      skipped: [],
      kept: [],
    })

    const note = screen.getByRole("status")
    expect(note).toHaveTextContent("Önceki görünümünüz ‘Eski vitrin’ adıyla kaydedildi.")
    expect(note).not.toHaveTextContent("eklenmedi")
    expect(note).not.toHaveTextContent("korundu")
  })

  it("says a page layout was not added for a page the shop has not made, and how to add it", () => {
    notices({
      ...REPORT,
      skipped: [
        { where: "home.0", ref: "kategoriler" },
        { where: "pages", ref: "page:hakkimizda", name: "Hakkımızda" },
        { where: "pages", ref: "page:sss" },
      ],
      kept: ["pages.cnt_contact"],
    })

    const note = screen.getByRole("status")
    expect(note).toHaveTextContent(
      "Hakkımızda sayfası olmadığı için sayfa düzeni eklenmedi. Adresi ‘hakkimizda’ olan bir sayfa açıp görünümü yeniden uygulayın."
    )
    // A look that gives no name: the address alone
    expect(note).toHaveTextContent(
      "Adresi ‘sss’ olan sayfa olmadığı için sayfa düzeni eklenmedi. Bu adresle bir sayfa açıp görünümü yeniden uygulayın."
    )
    // The page is not counted among the sections left out
    expect(note).toHaveTextContent("1 bölüm eklenmedi: mağazada kategoriler yok.")
    // The shop's own page layouts kept, the header and footer not named
    expect(note).toHaveTextContent("Sayfalarınıza kendi kurduğunuz düzenler korundu.")
    expect(note).not.toHaveTextContent("Üst/alt bilginiz korundu.")
  })

  it("says a page layout was not added when fifty pages have their own (warn, don't block)", () => {
    notices({
      ...REPORT,
      skipped: [
        { where: "pages", ref: "page:hakkimizda", name: "Hakkımızda", reason: "limit" },
        { where: "pages", ref: "page:sss", reason: "limit" },
        { where: "pages", ref: "page:hikayemiz", name: "Hikâyemiz", reason: "missing" },
      ],
      kept: [],
    })

    const note = screen.getByRole("status")
    expect(note).toHaveTextContent(
      "Hakkımızda sayfasının düzeni eklenmedi: kendi düzeni olan en çok 50 sayfa olabilir."
    )
    expect(note).toHaveTextContent(
      "Adresi ‘sss’ olan sayfanın düzeni eklenmedi: kendi düzeni olan en çok 50 sayfa olabilir."
    )
    expect(note).toHaveTextContent("Hikâyemiz sayfası olmadığı için sayfa düzeni eklenmedi.")
    expect(note).not.toHaveTextContent("bölüm eklenmedi")
  })

  it("draws no note without a report, and the waiting menus beside one", () => {
    notices(null, [{}, {}])

    expect(screen.queryByText(/taslağa uygulandı/)).toBeNull()
    expect(screen.getAllByRole("status")).toHaveLength(1)
  })

  it("says a section shows a deleted record and opens it from the note (warn, don't block)", async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    notices(null, null, new Set(["girisbolumu"]), onOpen)

    const note = screen.getByRole("status")
    expect(note).toHaveTextContent(
      "Bir bölümün gösterdiği kayıt (kategori, ürün, koleksiyon, marka ya da sayfa) silinmiş."
    )
    await user.click(within(note).getByRole("button"))
    expect(onOpen).toHaveBeenCalledWith("girisbolumu")
  })

  it("draws no gone-record note while every record is there", () => {
    notices(null)

    expect(screen.queryByRole("status")).toBeNull()
  })
})
