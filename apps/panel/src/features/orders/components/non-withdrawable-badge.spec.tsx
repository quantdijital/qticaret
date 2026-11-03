import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n"
import { NonWithdrawableBadge } from "./non-withdrawable-badge"

describe("NonWithdrawableBadge", () => {
  it("says why a line is outside the right of withdrawal, in a word and in its title", () => {
    const { rerender } = render(<NonWithdrawableBadge reason="product" />)
    expect(screen.getByText("Cayma dışı")).toBeInTheDocument()
    expect(screen.getByTitle(/Bu üründe cayma hakkı yok/)).toBeInTheDocument()

    rerender(<NonWithdrawableBadge reason="personal_addon" />)
    expect(screen.getByText("Cayma dışı · kişiye özel")).toBeInTheDocument()
    expect(screen.getByTitle(/isteğine göre hazırlanan/)).toBeInTheDocument()

    rerender(<NonWithdrawableBadge reason="gift_card_used" />)
    expect(screen.getByText("Cayma dışı · kart kullanıldı")).toBeInTheDocument()
    expect(screen.getByTitle(/Hediye kartlarından birinden harcama yapıldı/)).toBeInTheDocument()
  })

  it("says only that when no reason is known", () => {
    const { container } = render(<NonWithdrawableBadge />)
    expect(screen.getByText("Cayma dışı")).toBeInTheDocument()
    expect(container.querySelector("[title]")).toBeNull()
  })
})
