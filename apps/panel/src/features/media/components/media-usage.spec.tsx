import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { MediaUsage } from "./media-usage"

// A link shows where it goes: the page and its search
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    children,
  }: {
    to: string
    search?: Record<string, string>
    children: ReactNode
  }) => (
    <a href={`${to}${search ? `?${new URLSearchParams(search).toString()}` : ""}`}>{children}</a>
  ),
}))

describe("MediaUsage", () => {
  it("names a category's picture and the ETBİS QR code, each linked to its page", () => {
    render(
      <MediaUsage
        usage={[
          { kind: "category", id: "pcat_1", label: "Mutfak" },
          { kind: "etbis_qr", id: null, label: null },
        ]}
      />
    )

    expect(screen.getByRole("link", { name: "Mutfak" })).toHaveAttribute(
      "href",
      "/categories?selected=pcat_1"
    )
    expect(screen.getByText("Kategori görseli")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Mağazanın ETBİS karekodu" })).toHaveAttribute(
      "href",
      "/settings/store?part=legal"
    )
    expect(screen.getByText("ETBİS karekodu")).toBeInTheDocument()
  })
})
