import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { REPORT_KEY } from "@/features/storefront/gallery/api"
import type { ApplyReport } from "@/features/storefront/gallery/api"
import { EditorNotices } from "./editor-notices"

function notices(report: ApplyReport | null, pendingMenus: unknown[] | null = null) {
  const client = new QueryClient()
  client.setQueryData(REPORT_KEY, report)
  render(
    <QueryClientProvider client={client}>
      <EditorNotices pendingMenus={pendingMenus} onDropMenus={vi.fn()} />
    </QueryClientProvider>
  )
  return client
}

const REPORT: ApplyReport = {
  name: "Grafit",
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
    expect(note).toHaveTextContent("‘Grafit’ taslağa uygulandı.")
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

  it("draws no note without a report, and the waiting menus beside one", () => {
    notices(null, [{}, {}])

    expect(screen.queryByText(/taslağa uygulandı/)).toBeNull()
    expect(screen.getAllByRole("status")).toHaveLength(1)
  })
})
