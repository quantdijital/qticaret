import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { NewContentDialog } from "./new-content-dialog"

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
}))

const open = (kind: "page" | "post") =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NewContentDialog kind={kind} open onOpenChange={vi.fn()} />
    </QueryClientProvider>
  )

describe("NewContentDialog", () => {
  it("points a page titled like a legal text to the legal texts", async () => {
    open("page")
    await userEvent.type(screen.getByLabelText(/Başlık/), "Mesafeli Satış Sözleşmesi")

    expect(screen.getByText("Yasal metinler burada yazılmaz")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Ayarlar > Yasal" })).toHaveAttribute(
      "href",
      "/settings/legal"
    )
    // Only a pointer: the page can still be made
    expect(screen.getByRole("button", { name: "Oluştur" })).toBeEnabled()
  })

  it("says nothing for the shop's own pages and for posts", async () => {
    const { unmount } = open("page")
    await userEvent.type(screen.getByLabelText(/Başlık/), "Hakkımızda")
    expect(screen.queryByText("Yasal metinler burada yazılmaz")).not.toBeInTheDocument()
    unmount()

    open("post")
    await userEvent.type(screen.getByLabelText(/Başlık/), "Çerez politikası nedir?")
    expect(screen.queryByText("Yasal metinler burada yazılmaz")).not.toBeInTheDocument()
  })
})
