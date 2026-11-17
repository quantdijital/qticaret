import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { DesignCard as Design } from "./api"
import { DesignCard } from "./design-card"
import { design, summary } from "./gallery.fixtures"

const fetchMock = vi.hoisted(() => vi.fn())
const toastSuccess = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: vi.fn() } }))

function card(look: Design, savedFull = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onApply = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <DesignCard design={look} savedFull={savedFull} busy={false} onApply={onApply} />
    </QueryClientProvider>
  )
  return { onApply }
}

const AUTO = design("sfd_auto", {
  kind: "auto",
  name: null,
  created_at: "2026-11-17T11:20:00.000Z",
  summary: summary({ edited: true, reason: "preset_apply" }),
})

describe("DesignCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ design: null })
    toastSuccess.mockReset()
  })

  it("names a look, its date, where it came from and where it stands", async () => {
    const user = userEvent.setup()
    const { onApply } = card(
      design("sfd_1", { in_draft: true, edited: true, live: true, summary: summary() })
    )

    const article = screen.getByRole("article", { name: "Bayram vitrini" })
    expect(within(article).getByText("17 Kasım 14:20 · Sade görünümünden")).toBeVisible()
    expect(within(article).getByText("Yayında")).toBeVisible()
    expect(within(article).getByText("Taslakta, düzenlenmiş")).toBeVisible()
    expect(within(article).queryByText("Otomatik")).toBeNull()

    await user.click(
      within(article).getByRole("button", { name: "‘Bayram vitrini’ görünümünü taslağa al" })
    )
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ id: "sfd_1" }), "Bayram vitrini")
  })

  it("renames a named look once the name differs", async () => {
    const user = userEvent.setup()
    card(design("sfd_1"))

    await user.click(screen.getByRole("button", { name: "‘Bayram vitrini’ için işlemler" }))
    await user.click(await screen.findByRole("menuitem", { name: "Adını değiştir" }))
    const dialog = await screen.findByRole("dialog", { name: "Görünümün adını değiştir" })
    const save = within(dialog).getByRole("button", { name: "Kaydet" })
    expect(save).toBeDisabled()
    const field = within(dialog).getByRole("textbox", { name: "Ad" })
    await user.clear(field)
    await user.type(field, "Yılbaşı vitrini")
    await user.click(save)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/storefront-designs/sfd_1", {
        method: "POST",
        body: { name: "Yılbaşı vitrini" },
      })
    })
    expect(toastSuccess).toHaveBeenCalledWith("‘Yılbaşı vitrini’ kaydedildi.")
  })

  it("keeps an automatic save by name, the name it is shown under offered as it is", async () => {
    const user = userEvent.setup()
    card(AUTO)

    const name = "Sade, 17 Kasım 14:20, düzenlenmiş"
    expect(screen.getByRole("article", { name })).toContainElement(screen.getByText("Otomatik"))
    await user.click(screen.getByRole("button", { name: `‘${name}’ için işlemler` }))
    await user.click(await screen.findByRole("menuitem", { name: "Adıyla sakla" }))
    const dialog = await screen.findByRole("dialog", { name: "Adıyla sakla" })
    expect(
      within(dialog).getByText(
        "Adı verilen otomatik kayıt kalıcı olur ve adlı kayıt sınırına sayılır."
      )
    ).toBeVisible()
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/storefront-designs/sfd_auto", {
        method: "POST",
        body: { name },
      })
    })
  })

  it("cannot keep an automatic save by name when the named looks are full", async () => {
    const user = userEvent.setup()
    card(AUTO, true)

    await user.click(screen.getByRole("button", { name: /için işlemler$/ }))
    expect(await screen.findByRole("menuitem", { name: "Adıyla sakla" })).toHaveAttribute(
      "aria-disabled",
      "true"
    )
    expect(screen.getByRole("menuitem", { name: "Sil" })).not.toHaveAttribute("aria-disabled")
  })

  it("asks before deleting a look for good", async () => {
    const user = userEvent.setup()
    card(design("sfd_1"))

    await user.click(screen.getByRole("button", { name: "‘Bayram vitrini’ için işlemler" }))
    await user.click(await screen.findByRole("menuitem", { name: "Sil" }))
    const ask = await screen.findByRole("alertdialog", { name: "‘Bayram vitrini’ silinsin mi?" })
    expect(
      within(ask).getByText(
        "Kayıtlı görünüm kalıcı olarak silinir; geri alınamaz. Yayındaki görünüm değişmez."
      )
    ).toBeVisible()
    expect(fetchMock).not.toHaveBeenCalled()
    await user.click(within(ask).getByRole("button", { name: "Görünümü sil" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/storefront-designs/sfd_1", {
        method: "DELETE",
      })
    })
    expect(toastSuccess).toHaveBeenCalledWith("‘Bayram vitrini’ silindi.")
  })
})
