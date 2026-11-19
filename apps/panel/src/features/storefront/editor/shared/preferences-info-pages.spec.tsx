import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { URL, answer, form as card, renderPanel as renderPage } from "./preferences-panel.fixtures"
import type { Init } from "./preferences-panel.fixtures"

const fetchMock = vi.hoisted(() => vi.fn<(url: string, init?: Init) => Promise<unknown>>())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const TITLE = "Ödeme ve kargo sayfaları"
const PAYMENT = "Ödeme seçenekleri sayfası"
const SHIPPING = "Kargo ve teslimat sayfası"

const picker = (name: string) => screen.getByRole("combobox", { name })

describe("the editor's storefront preferences: payment and shipping pages (adr/0046 Ek 2026-11-05)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    answer(fetchMock)
  })

  it("points the facts at the shop's own pages, kept by their ids", async () => {
    renderPage()
    await waitFor(() => {
      expect(picker(PAYMENT)).toHaveTextContent("Ödeme seçenekleri")
    })
    expect(picker(SHIPPING)).toHaveTextContent("Kargo ve teslimat")

    await userEvent.click(picker(PAYMENT))
    await userEvent.click(await screen.findByRole("option", { name: /^Destek/ }))
    await userEvent.click(within(card(TITLE)).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { payment_page_id: "cnt_destek", shipping_page_id: "cnt_kargo" },
      })
    })
  })

  it("saves none as no page", async () => {
    renderPage()
    await waitFor(() => {
      expect(picker(SHIPPING)).toHaveTextContent("Kargo ve teslimat")
    })

    await userEvent.click(picker(SHIPPING))
    await userEvent.click(await screen.findByRole("option", { name: "Hiçbiri" }))
    expect(picker(SHIPPING)).toHaveTextContent("Hiçbiri")
    await userEvent.click(within(card(TITLE)).getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(URL, {
        method: "POST",
        body: { payment_page_id: "cnt_odeme", shipping_page_id: null },
      })
    })
  })

  it("reads a section saved before the ids as the pages at the old addresses", async () => {
    answer(fetchMock, {
      payment_page_id: null,
      shipping_page_id: null,
      payment_info_path: "/odeme-secenekleri",
      shipping_info_path: "/yok-boyle-sayfa",
    })
    renderPage()

    await waitFor(() => {
      expect(picker(PAYMENT)).toHaveTextContent("Ödeme seçenekleri")
    })
    // No page at that address: none to show
    expect(picker(SHIPPING)).toHaveTextContent("Hiçbiri")
  })
})
